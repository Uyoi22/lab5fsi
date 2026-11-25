import { Router } from 'express';
import {
  getBooks,
  getBookById,
  createBook,
  updateBook,
  updateStock,
  deleteBook,
} from '../controllers/book.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Rutas Públicas
router.get('/api/books', getBooks);
router.get('/api/books/:id', getBookById);

// Rutas Administrativas Protegidas (RBAC: solo 'admin')
router.post('/api/books', authenticateToken, requireRole('admin'), createBook);
router.put('/api/books/:id', authenticateToken, requireRole('admin'), updateBook);
router.patch('/api/books/:id/stock', authenticateToken, requireRole('admin'), updateStock);
router.delete('/api/books/:id', authenticateToken, requireRole('admin'), deleteBook);

export default router;
