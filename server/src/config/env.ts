import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  webOrigin: process.env.WEB_ORIGIN || 'http://localhost:3000',
  mongoUri: process.env.MONGODB_URI || '',
  jwtSecret: process.env.JWT_SECRET || 'dev_jwt_secret_key_ebookstore_default',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  adminPassword: process.env.ADMIN_PASSWORD || 'AdminSecurePassword2026!',
  demoPassword: process.env.DEMO_PASSWORD || 'ClienteDemoPassword2026!',
  paypalClientId: process.env.PAYPAL_CLIENT_ID || '',
  paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
  paypalMode: process.env.PAYPAL_MODE || 'sandbox',
};
