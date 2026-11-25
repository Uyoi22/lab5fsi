import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { config } from '../config/env';

export class AppError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  res.status(404).json({
    success: false,
    error: {
      message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
      statusCode: 404,
    },
  });
};

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        message: 'Error de validación de datos',
        statusCode: 400,
        details: err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        statusCode: err.statusCode,
        details: err.details,
      },
    });
    return;
  }

  // Error de CORS
  if (err.message && err.message.includes('CORS')) {
    res.status(403).json({
      success: false,
      error: {
        message: 'Acceso no permitido por política CORS',
        statusCode: 403,
      },
    });
    return;
  }

  // Mongoose CastError (por ejemplo, ObjectId inválido)
  if (err.name === 'CastError') {
    res.status(400).json({
      success: false,
      error: {
        message: 'Identificador con formato inválido',
        statusCode: 400,
      },
    });
    return;
  }

  // Error no controlado
  console.error('Unhandled Error:', err);
  const isProduction = config.nodeEnv === 'production';

  res.status(500).json({
    success: false,
    error: {
      message: isProduction ? 'Error interno del servidor' : err.message || 'Error interno del servidor',
      statusCode: 500,
      ...(isProduction ? {} : { stack: err.stack }),
    },
  });
};
