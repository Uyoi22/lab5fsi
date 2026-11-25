import { Router } from 'express';
import { createOrder, getOrderById, getMyOrders } from '../controllers/order.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas de pedidos requieren autenticación
router.post('/api/orders', authenticateToken, createOrder);
router.get('/api/orders/my-orders', authenticateToken, getMyOrders);
router.get('/api/orders/:id', authenticateToken, getOrderById);

export default router;
