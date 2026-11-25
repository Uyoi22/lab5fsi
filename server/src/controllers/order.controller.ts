import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Order } from '../models/order.model';
import { Book } from '../models/book.model';
import { AppError } from '../middleware/errorHandler';

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        bookId: z.string().min(1, 'El ID del libro es requerido'),
        quantity: z
          .number({ invalid_type_error: 'La cantidad debe ser un entero' })
          .int('La cantidad debe ser un número entero')
          .min(1, 'La cantidad debe ser al menos 1'),
      })
    )
    .min(1, 'El pedido debe contener al menos un libro'),
  shippingAddress: z.string().min(5, 'La dirección debe tener al menos 5 caracteres').trim(),
  deliveryEmail: z.string().email('El formato de correo de entrega es inválido').trim().toLowerCase(),
});

export const createOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Usuario no autenticado', 401);
    }

    const validatedData = createOrderSchema.parse(req.body);

    // 1. Verificar existencia de libros y consultar datos oficiales de la base de datos
    const bookIds = validatedData.items.map((i) => i.bookId);
    const dbBooks = await Book.find({ _id: { $in: bookIds }, isActive: true });

    if (dbBooks.length !== validatedData.items.length) {
      throw new AppError('Uno o más libros no existen o están inactivos', 404);
    }

    const booksMap = new Map(dbBooks.map((b) => [b.id, b]));

    // 2. REGLA CRÍTICA DE INTEGRIDAD: Recalcular precios oficiales desde la BD ignorando cualquier precio del cliente
    let totalAmount = 0;
    const orderItems = validatedData.items.map((item) => {
      const book = booksMap.get(item.bookId)!;
      const unitPrice = book.price; // En centavos oficiales de la BD
      const subtotal = unitPrice * item.quantity;
      totalAmount += subtotal;

      return {
        book: book._id as mongoose.Types.ObjectId,
        title: book.title,
        quantity: item.quantity,
        unitPrice,
        subtotal,
      };
    });

    // 3. REGLA CRÍTICA DE CONCURRENCIA: Reserva atómica de stock libro por libro
    // Condicionada a: stock - reserved >= quantity
    const reservedItems: { bookId: string; quantity: number }[] = [];

    for (const item of validatedData.items) {
      const book = booksMap.get(item.bookId)!;

      const reservedBook = await Book.findOneAndUpdate(
        {
          _id: item.bookId,
          isActive: true,
          $expr: {
            $gte: [{ $subtract: ['$stock', '$reserved'] }, item.quantity],
          },
        },
        {
          $inc: { reserved: item.quantity },
        },
        { new: true }
      );

      // Si falla la reserva condicional, ejecutar rollback inmediato de lo previamente reservado
      if (!reservedBook) {
        for (const rollbackItem of reservedItems) {
          await Book.findByIdAndUpdate(rollbackItem.bookId, {
            $inc: { reserved: -rollbackItem.quantity },
          });
        }

        throw new AppError(
          `Stock insuficiente para el libro: "${book.title}". Disponible: ${book.availableStock}`,
          409,
          {
            bookId: item.bookId,
            title: book.title,
            requested: item.quantity,
            available: book.availableStock,
          }
        );
      }

      reservedItems.push({ bookId: item.bookId, quantity: item.quantity });
    }

    // 4. Crear la orden con expiración a los 30 minutos
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const order = new Order({
      user: req.user.id,
      items: orderItems,
      shippingAddress: validatedData.shippingAddress,
      deliveryEmail: validatedData.deliveryEmail,
      totalAmount,
      status: 'pendiente_pago',
      shippingStatus: 'pendiente',
      reservationExpiresAt: expiresAt,
    });

    await order.save();

    res.status(201).json({
      success: true,
      data: {
        order: order.toJSON(),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Usuario no autenticado', 401);
    }

    const { id } = req.params;
    const order = await Order.findById(id);

    if (!order) {
      throw new AppError('Pedido no encontrado', 404);
    }

    // REGLA DE AUTORIZACIÓN: Solo el dueño del pedido o un administrador pueden consultarlo
    const isOwner = order.user.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new AppError('Acceso denegado: este pedido pertenece a otro usuario', 403);
    }

    res.status(200).json({
      success: true,
      data: {
        order: order.toJSON(),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMyOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Usuario no autenticado', 401);
    }

    const orders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        orders: orders.map((o) => o.toJSON()),
        total: orders.length,
      },
    });
  } catch (error) {
    next(error);
  }
};
