import { Router } from 'express';
import { getAdminOrders, updateShippingStatus } from '../controllers/admin.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas de administración requieren autenticación y rol "admin"
router.use('/api/admin', authenticateToken, requireRole('admin'));

// Consultar pedidos para el panel / Kanban
router.get('/api/admin/orders', getAdminOrders);

// Actualizar estado de envío respetando la máquina de estados
router.patch('/api/admin/orders/:id/shipping-status', updateShippingStatus);

export default router;
