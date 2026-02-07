import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { config } from './config/index.js';
import { connectDB } from './config/db.js';
import authRoutes from './modules/auth/auth.route.js';
import shiftcareRoutes from './modules/shiftcare/shiftcare.route.js';
import userRoutes from './modules/user/user.route.js';
import { authenticateJWT, authorizeRoles } from './middlewares/auth.middleware.js';
import morgan from 'morgan'; // logging middlewareg

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

// File Upload analysis
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { analyzeCsv } from './utils/csvAnalyzer.js';

// Ensure uploads directory exists with proper permissions
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true, mode: 0o755 });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

app.post(
  '/api/analyze-shift-report',
  authenticateJWT,
  authorizeRoles('super_admin', 'finance'),
  upload.single('file'),
  async (req, res) => {
    const filePath = req.file?.path;
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const options = {
        userId: req.user?.userId,
        fileName: req.file.originalname,
      };
      const report = await analyzeCsv(req.file.path, options);

      // Delete file after successful analysis
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      res.json({ report });
    } catch (error) {
      console.error('Analysis failed:', error);
      
      // Ensure file is deleted even if analysis fails
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (deleteError) {
          console.error('Failed to delete uploaded file:', deleteError);
        }
      }
      
      res.status(500).json({
        error: 'Failed to analyze report',
        details: error.message,
      });
    }
  }
);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    await connectDB();
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
