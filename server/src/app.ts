import express, { Application, Request, Response, NextFunction } from 'express';
import cors, { CorsOptions } from 'cors';
import helmet from 'helmet';
import { config } from './config/env';
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import bookRoutes from './routes/book.routes';
import orderRoutes from './routes/order.routes';
import paymentRoutes from './routes/payment.routes';
import adminRoutes from './routes/admin.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export const createApp = (): Application => {
  const app = express();

  // 1. Helmet para protección de cabeceras HTTP
  app.use(helmet());

  // 2. CORS restringido a WEB_ORIGIN
  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      // Permitir peticiones sin origen (como curl, tests internos o server-to-server)
      if (!origin) {
        return callback(null, true);
      }
      if (origin === config.webOrigin) {
        return callback(null, true);
      }
      return callback(new Error('Acceso no permitido por política CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };

  app.use(cors(corsOptions));

  // 3. Parsers de cuerpo de petición
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 4. Rutas principales
  app.use(healthRoutes);
  app.use(authRoutes);
  app.use(bookRoutes);
  app.use(orderRoutes);
  app.use(paymentRoutes);
  app.use(adminRoutes);

  // 5. Manejo de 404 y Errores Centralizados
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
