import { Router } from 'express';
import { register, login, getMe } from '../controllers/auth.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { authRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Rutas públicas con rate limiting estricto
router.post('/api/auth/register', authRateLimiter, register);
router.post('/api/auth/login', authRateLimiter, login);

// Rutas protegidas para cualquier usuario autenticado
router.get('/api/auth/me', authenticateToken, getMe);

// Ruta protegida de prueba para verificar autorización de Administrador (RBAC)
router.get('/api/admin/dashboard', authenticateToken, requireRole('admin'), (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      message: 'Acceso autorizado al panel de administración',
      adminUser: req.user,
    },
  });
});

export default router;
