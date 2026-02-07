import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/kc-ai',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default-jwt-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  shiftcare: {
    baseUrl: process.env.SHIFTCARE_BASE_URL || 'https://api.shiftcare.com/api',
    accountId: process.env.SHIFTCARE_ACCOUNT_ID,  // Used as Basic Auth username
    apiKey: process.env.SHIFTCARE_API_KEY,        // Used as Basic Auth password
  },
  session: {
    secret: process.env.SESSION_SECRET || 'default-secret-change-in-production',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
  openai: {
    model: process.env.OPENAI_MODEL || 'gpt-4o',
  },
};
