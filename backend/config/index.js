import dotenv from 'dotenv';

dotenv.config();

function validateProductionConfig() {
  if (process.env.NODE_ENV !== 'production') return;

  const missing = [];
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
  if (!process.env.MONGODB_URI) missing.push('MONGODB_URI');

  if (missing.length > 0) {
    console.error(
      `FATAL: Missing required environment variables in production: ${missing.join(', ')}`
    );
    process.exit(1);
  }
}

validateProductionConfig();

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
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
  openai: {
    model: process.env.OPENAI_MODEL || 'gpt-4o',
  },
  upload: {
    maxFileSizeBytes: parseInt(process.env.MAX_CSV_FILE_SIZE_MB || '50', 10) * 1024 * 1024,
  },
  forecastActuals: {
    pageSize: parseInt(process.env.FORECAST_PAGE_SIZE || '15', 10),
  },
  standardForecast: {
    pageSize: parseInt(process.env.STANDARD_FORECAST_PAGE_SIZE || '25', 10),
  },
  crm: {
    pageSize: parseInt(process.env.CRM_PAGE_SIZE || '5000', 10),
  },
  payHours: {
    listPageSize: parseInt(process.env.PAY_HOURS_PAGE_SIZE || '5000', 10),
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  rosterCoverage: {
    /** First day of first fortnight (local date in defaultTimezone). */
    fortnightAnchorISO: process.env.ROSTER_FORTNIGHT_ANCHOR || '2025-01-06',
    defaultTimezone: process.env.ROSTER_DEFAULT_TZ || 'Australia/Brisbane',
    /** Hours / fortnight when timesheet import creates a staff row from ShiftCare Staff ID. */
    defaultContractedFortnightlyHours: parseInt(process.env.ROSTER_DEFAULT_FN_HOURS || '76', 10),
  },
};
