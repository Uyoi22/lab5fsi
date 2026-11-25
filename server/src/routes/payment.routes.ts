import { Router } from 'express';
import {
  createPayPalOrderHandler,
  capturePayPalOrderHandler,
} from '../controllers/payment.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Rutas de pagos con PayPal (requieren usuario autenticado)
router.post('/api/payments/paypal/create', authenticateToken, createPayPalOrderHandler);
router.post('/api/payments/paypal/capture', authenticateToken, capturePayPalOrderHandler);

export default router;
