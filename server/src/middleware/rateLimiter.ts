import rateLimit, { Options } from 'express-rate-limit';
import { config } from '../config/env';

export const createAuthRateLimiter = (customOptions?: Partial<Options>) => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: config.nodeEnv === 'test' ? 100 : 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        message: 'Demasiadas solicitudes de autenticación. Por favor intenta de nuevo más tarde.',
        statusCode: 429,
      },
    },
    ...customOptions,
  });
};

export const authRateLimiter = createAuthRateLimiter();
