import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Book } from '../models/book.model';
import { AppError } from '../middleware/errorHandler';

// Esquemas de validación Zod
export const createBookSchema = z.object({
  title: z.string().min(1, 'El título es obligatorio').trim(),
  author: z.string().min(1, 'El autor es obligatorio').trim(),
  category: z.string().min(1, 'La categoría es obligatoria').trim(),
  description: z.string().min(5, 'La descripción debe tener al menos 5 caracteres').trim(),
  price: z
    .number({ invalid_type_error: 'El precio debe ser un número entero' })
    .int('El precio debe ser un número entero en centavos')
    .min(1, 'El precio debe ser mayor a 0 centavos'),
  coverUrl: z.string().url('La URL de la portada debe ser válida').or(z.string().min(1)),
  stock: z
    .number({ invalid_type_error: 'El stock debe ser un número entero' })
    .int('El stock debe ser un número entero')
    .min(0, 'El stock no puede ser negativo'),
});

export const updateBookSchema = createBookSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const updateStockSchema = z.object({
  stock: z
    .number({ invalid_type_error: 'El stock debe ser un número entero' })
    .int('El stock debe ser un número entero')
    .min(0, 'El stock no puede ser negativo'),
});

export const getBooks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 12));
    const skip = (page - 1) * limit;

    const { category, search, availableOnly } = req.query;

    const filter: Record<string, any> = { isActive: true };

    if (category && typeof category === 'string' && category.trim() !== '') {
      filter.category = { $regex: new RegExp(`^${category.trim()}$`, 'i') };
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [{ title: searchRegex }, { author: searchRegex }, { description: searchRegex }];
    }

    if (availableOnly === 'true') {
      filter.$expr = { $gt: [{ $subtract: ['$stock', '$reserved'] }, 0] };
    }

    const [books, total, categories] = await Promise.all([
      Book.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Book.countDocuments(filter),
      Book.distinct('category', { isActive: true }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        books: books.map((b) => b.toJSON()),
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1,
        categories,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getBookById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const book = await Book.findById(id);

    if (!book || (!book.isActive && req.user?.role !== 'admin')) {
      throw new AppError('Libro no encontrado', 404);
    }

    res.status(200).json({
      success: true,
      data: {
        book: book.toJSON(),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createBook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = createBookSchema.parse(req.body);

    const newBook = new Book({
      ...validatedData,
      reserved: 0,
      isActive: true,
    });

    await newBook.save();

    res.status(201).json({
      success: true,
      data: {
        book: newBook.toJSON(),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateBook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const validatedData = updateBookSchema.parse(req.body);

    const book = await Book.findById(id);
    if (!book) {
      throw new AppError('Libro no encontrado', 404);
    }

    Object.assign(book, validatedData);
    await book.save();

    res.status(200).json({
      success: true,
      data: {
        book: book.toJSON(),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const validatedData = updateStockSchema.parse(req.body);

    const book = await Book.findById(id);
    if (!book) {
      throw new AppError('Libro no encontrado', 404);
    }

    book.stock = validatedData.stock;
    await book.save();

    res.status(200).json({
      success: true,
      data: {
        book: book.toJSON(),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteBook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const book = await Book.findById(id);
    if (!book) {
      throw new AppError('Libro no encontrado', 404);
    }

    // Borrado suave / desactivación lógica
    book.isActive = false;
    await book.save();

    res.status(200).json({
      success: true,
      data: {
        message: 'Libro desactivado correctamente del catálogo',
        book: book.toJSON(),
      },
    });
  } catch (error) {
    next(error);
  }
};
