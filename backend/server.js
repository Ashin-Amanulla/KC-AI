import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoose from 'mongoose';
import { config } from './config/index.js';
import { connectDB, markMongoShutdown } from './config/db.js';
import { closeRedis } from './config/redis.js';
import authRoutes from './modules/auth/auth.route.js';
import shiftcareRoutes from './modules/shiftcare/shiftcare.route.js';
import userRoutes from './modules/user/user.route.js';
import roleRoutes from './modules/role/role.route.js';
import { ensureDefaultRoles } from './modules/role/ensureDefaultRoles.js';
import csvAnalysisRoutes from './modules/csv-analysis/csvAnalysis.route.js';
import { startCsvAnalysisWorker, stopCsvAnalysisWorker } from './jobs/csvAnalysisWorker.js';
import { startPayHoursWorker, stopPayHoursWorker } from './jobs/payHoursWorker.js';
import shiftsRoutes from './modules/shifts/shift.route.js';
import holidaysRoutes from './modules/holidays/holiday.route.js';
import locationsRoutes from './modules/locations/location.route.js';
import payHoursRoutes from './modules/pay-hours/payHours.route.js';
import forecastActualsRoutes from './modules/forecast-actuals/forecastActuals.route.js';
import standardForecastRoutes from './modules/standard-forecast/standardForecast.route.js';
import staffRatesRoutes from './modules/staff-rates/staffRates.route.js';
import awardRatesRoutes from './modules/award-rates/awardRates.route.js';
import ruleEngineRoutes from './modules/rule-engine/ruleEngine.route.js';
import dashboardRoutes from './modules/dashboard/dashboard.route.js';
import rosterCoverageRoutes from './modules/roster-coverage/rosterCoverage.route.js';
import crmRoutes from './modules/crm/crm.route.js';
import cirRoutes from './modules/cir/cir.route.js';
import { formatErrorResponse, ForbiddenError } from './helpers/errors.js';
import { Holiday } from './modules/holidays/holiday.model.js';
import { attachSpreadsheetCollaborationWs } from './modules/crm/crmCollaborationWs.js';
import { apiLimiter } from './middlewares/rateLimit.js';
import { logger } from './config/logger.js';
import pinoHttp from 'pino-http';
import http from 'http';

const app = express();
let httpServer = null;
let isShuttingDown = false;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors(config.cors));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/health',
    },
  })
);

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Config check (development only, no auth required) - shows which env vars are configured
app.get('/config-check', (req, res, next) => {
  if (config.nodeEnv === 'production') {
    return next(new ForbiddenError('Not available in production'));
  }
  res.json({
    shiftcare: {
      baseUrl: config.shiftcare.baseUrl,
      accountIdConfigured: !!config.shiftcare.accountId,
      apiKeyConfigured: !!config.shiftcare.apiKey,
    },
    message: 'Check your .env file if any values are false',
  });
});

// General API rate limit
app.use('/api', apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api', locationsRoutes);
app.use('/api', shiftsRoutes);
app.use('/api', holidaysRoutes);
app.use('/api', payHoursRoutes);
app.use('/api', forecastActualsRoutes);
app.use('/api', standardForecastRoutes);
app.use('/api', staffRatesRoutes);
app.use('/api', awardRatesRoutes);
app.use('/api', ruleEngineRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', csvAnalysisRoutes);
app.use('/api/shiftcare', shiftcareRoutes);
app.use('/api', rosterCoverageRoutes);
app.use('/api', crmRoutes);
app.use('/api', cirRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  req.log?.error({ err }, 'request failed');

  if (err.code === 'LIMIT_FILE_SIZE') {
    const maxMB = Math.round(config.upload.maxFileSizeBytes / 1024 / 1024);
    return res.status(413).json({
      success: false,
      error: {
        code: 'FILE_TOO_LARGE',
        message: `File too large. Maximum size is ${maxMB}MB`,
      },
    });
  }
  if (
    err.message?.includes('Only CSV files are allowed') ||
    err.message?.includes('Only CSV or XLSX')
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
      },
    });
  }
  const { status, body } = formatErrorResponse(err);
  res.status(status).json(body);
});

const SHUTDOWN_TIMEOUT_MS = 10_000;

const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, 'shutting down');
  markMongoShutdown();

  const forceExitTimer = setTimeout(() => {
    logger.error('Shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExitTimer.unref();

  try {
    if (httpServer) {
      await new Promise((resolve, reject) => {
        httpServer.close((err) => (err ? reject(err) : resolve()));
      });
    }
    await stopPayHoursWorker();
    await stopCsvAnalysisWorker();
    await closeRedis();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    clearTimeout(forceExitTimer);
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, 'Shutdown error');
    process.exit(1);
  }
};

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    await connectDB();
    await ensureDefaultRoles();
    try {
      await Holiday.syncIndexes();
    } catch (idxErr) {
      logger.error({ err: idxErr }, 'Holiday index sync failed');
    }
    startCsvAnalysisWorker();
    startPayHoursWorker();
    httpServer = http.createServer(app);
    attachSpreadsheetCollaborationWs(httpServer);
    httpServer.listen(config.port, () => {
      logger.info({ port: config.port, env: config.nodeEnv }, 'Server started');
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
};

startServer();

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
