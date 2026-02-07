import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { config } from './config/index.js';
import { connectDB } from './config/db.js';
import authRoutes from './modules/auth/auth.route.js';
import shiftcareRoutes from './modules/shiftcare/shiftcare.route.js';
import userRoutes from './modules/user/user.route.js';
import csvAnalysisRoutes from './modules/csv-analysis/csvAnalysis.route.js';
import { startCsvAnalysisWorker } from './jobs/csvAnalysisWorker.js';
import { formatErrorResponse } from './helpers/errors.js';
import morgan from 'morgan';

const app = express();

// Middleware
app.use(cors(config.cors));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(
  session({
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.nodeEnv === 'production',
      httpOnly: true,
      maxAge: config.session.maxAge,
    },
  })
);

// Logging middleware
app.use(morgan('dev'));

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Config check (development only, no auth required) - shows which env vars are configured
app.get('/config-check', (req, res) => {
  if (config.nodeEnv === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }
  res.json({
    shiftcare: {
      baseUrl: config.shiftcare.baseUrl,
      accountIdConfigured: !!config.shiftcare.accountId,
      apiKeyConfigured: !!config.shiftcare.apiKey,
    },
    message: 'Check your .env file if any values are false'
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api', shiftcareRoutes);
app.use('/api', csvAnalysisRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
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
  if (err.message?.includes('Only CSV files are allowed')) {
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

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    await connectDB();
    startCsvAnalysisWorker();
    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
      console.log(`Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
