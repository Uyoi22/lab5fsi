import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Order } from '../models/order.model';
import { Book } from '../models/book.model';
import { createPayPalOrder, capturePayPalOrder } from '../services/paypal.service';
import { emitOrderUpdated } from '../socket';
import { AppError } from '../middleware/errorHandler';

export const createPayPalOrderSchema = z.object({
  orderId: z.string().min(1, 'El ID de la orden es requerido'),
});

export const capturePayPalOrderSchema = z.object({
  orderId: z.string().min(1, 'El ID de la orden es requerido'),
  paypalOrderId: z.string().min(1, 'El ID de orden de PayPal es requerido'),
});

export const createPayPalOrderHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Usuario no autenticado', 401);
    }

    const { orderId } = createPayPalOrderSchema.parse(req.body);

    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError('Pedido no encontrado', 404);
    }

    // 1. REGLA DE AUTORIZACIÓN: Verificar pertenencia al usuario autenticado
    if (order.user.toString() !== req.user.id) {
      throw new AppError('Acceso denegado: este pedido pertenece a otro usuario', 403);
    }

    // 2. Verificar estado válido
    if (order.status === 'pagado') {
      throw new AppError('El pedido ya se encuentra pagado', 400);
    }

    if (order.status === 'cancelado') {
      throw new AppError('El pedido ha sido cancelado o la reserva de stock ha expirado', 400);
    }

    if (order.reservationExpiresAt <= new Date()) {
      throw new AppError('La reserva de 30 minutos de este pedido ha expirado', 400);
    }

    // 3. Crear orden externa en PayPal con monto recalculado en centavos convertido a decimal
    const paypalOrder = await createPayPalOrder(order);

    order.paypalOrderId = paypalOrder.id;
    await order.save();

    res.status(200).json({
      success: true,
      data: {
        paypalOrderId: paypalOrder.id,
        orderId: order.id,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const capturePayPalOrderHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Usuario no autenticado', 401);
    }

    const { orderId, paypalOrderId } = capturePayPalOrderSchema.parse(req.body);

    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError('Pedido no encontrado', 404);
    }

    // 1. REGLA DE AUTORIZACIÓN: Verificar pertenencia al usuario autenticado
    if (order.user.toString() !== req.user.id) {
      throw new AppError('Acceso denegado: este pedido pertenece a otro usuario', 403);
    }

    // 2. REGLA DE IDEMPOTENCIA: Si la orden ya está 'pagado', devolver el resultado conocido sin descontar stock otra vez
    if (order.status === 'pagado') {
      res.status(200).json({
        success: true,
        data: {
          order: order.toJSON(),
          alreadyCaptured: true,
          message: 'El pedido ya fue pagado y confirmado previamente.',
        },
      });
      return;
    }

    // 3. Verificar si el pedido fue cancelado o expiró
    if (order.status === 'cancelado') {
      throw new AppError('El pedido ha sido cancelado o la reserva ha expirado.', 400);
    }

    if (order.reservationExpiresAt <= new Date()) {
      await Order.findByIdAndUpdate(order._id, { $set: { status: 'cancelado' } });
      throw new AppError('La reserva de 30 minutos ha expirado.', 400);
    }

    // 4. REGLA DE CONCURRENCIA: Transición atómica a 'procesando_pago' antes de llamar a PayPal
    const processingOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        user: req.user.id,
        status: 'pendiente_pago',
        reservationExpiresAt: { $gt: new Date() },
      },
      {
        $set: { status: 'procesando_pago' },
      },
      { new: true }
    );

    if (!processingOrder) {
      const currentOrder = await Order.findById(orderId);
      if (currentOrder?.status === 'pagado') {
        res.status(200).json({
          success: true,
          data: {
            order: currentOrder.toJSON(),
            alreadyCaptured: true,
            message: 'El pedido ya fue pagado y confirmado previamente.',
          },
        });
        return;
      }
      if (currentOrder?.status === 'procesando_pago') {
        throw new AppError('El pago de este pedido ya se está procesando actualmente.', 409);
      }
      throw new AppError('El pedido no se encuentra disponible para pago o la reserva expiró.', 400);
    }

    // 5. Llamar a captura en PayPal API
    let captureResult;
    try {
      captureResult = await capturePayPalOrder(paypalOrderId);
    } catch (err: any) {
      // Revertir a pendiente_pago para permitir reintento si falló la llamada de red
      await Order.findByIdAndUpdate(order._id, { $set: { status: 'pendiente_pago' } });
      throw new AppError(`Error al procesar captura con PayPal: ${err.message}`, 502);
    }

    // 6. VALIDACIONES ESTRICTAS DE SEGURIDAD DE LA CAPTURA:
    // a) Estatus COMPLETED
    if (captureResult.status !== 'COMPLETED') {
      await Order.findByIdAndUpdate(order._id, { $set: { status: 'pendiente_pago' } });
      throw new AppError(
        `La captura de PayPal no fue completada. Estado recibido: ${captureResult.status}`,
        400
      );
    }

    // b) Monto y moneda coinciden exactamente con totalAmount (en centavos)
    const capturedCents = Math.round(parseFloat(captureResult.amount) * 100);
    if (capturedCents !== processingOrder.totalAmount) {
      await Order.findByIdAndUpdate(order._id, { $set: { status: 'pendiente_pago' } });
      throw new AppError(
        `Discrepancia financiera: El monto capturado ($${captureResult.amount}) no coincide con el total del pedido ($${(
          processingOrder.totalAmount / 100
        ).toFixed(2)})`,
        400
      );
    }

    if (captureResult.currency.toUpperCase() !== 'USD') {
      await Order.findByIdAndUpdate(order._id, { $set: { status: 'pendiente_pago' } });
      throw new AppError(`Moneda inválida en la captura: ${captureResult.currency}. Se requiere USD.`, 400);
    }

    // c) custom_id o reference_id coincide con el id interno del pedido
    const captureCustomId = captureResult.customId || captureResult.referenceId;
    if (captureCustomId && captureCustomId !== processingOrder._id.toString()) {
      await Order.findByIdAndUpdate(order._id, { $set: { status: 'pendiente_pago' } });
      throw new AppError('El identificador de referencia de PayPal no coincide con este pedido.', 400);
    }

    // 7. TRANSACCIÓN ATÓMICA DE MONGODB: Paso a 'pagado' y descuento definitivo de stock y reserva
    let updatedOrder: any = null;
    let transactionSucceeded = false;

    try {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          // Actualizar pedido a pagado con índice único en paypalCaptureId
          updatedOrder = await Order.findByIdAndUpdate(
            processingOrder._id,
            {
              $set: {
                status: 'pagado',
                shippingStatus: 'pendiente',
                paypalCaptureId: captureResult.captureId,
                paymentDetails: {
                  capturedAt: new Date(),
                  amount: capturedCents,
                  currency: captureResult.currency,
                  payerEmail: captureResult.payerEmail,
                },
              },
            },
            { new: true, session }
          );

          // Descontar stock definitivo: stock = stock - qty, reserved = reserved - qty
          for (const item of processingOrder.items) {
            await Book.findByIdAndUpdate(
              item.book,
              {
                $inc: {
                  stock: -item.quantity,
                  reserved: -item.quantity,
                },
              },
              { session }
            );
          }
        });
        transactionSucceeded = true;
      } finally {
        await session.endSession();
      }
    } catch (txError: any) {
      // Fallback si la instancia de base de datos no soporta réplicas en entorno de prueba
      if (
        txError.message?.includes('replica set') ||
        txError.message?.includes('Transaction numbers')
      ) {
        console.warn('⚠️ Transacciones no soportadas en el servidor de pruebas standalone. Aplicando operaciones atómicas secuenciales.');
        updatedOrder = await Order.findByIdAndUpdate(
          processingOrder._id,
          {
            $set: {
              status: 'pagado',
              shippingStatus: 'pendiente',
              paypalCaptureId: captureResult.captureId,
              paymentDetails: {
                capturedAt: new Date(),
                amount: capturedCents,
                currency: captureResult.currency,
                payerEmail: captureResult.payerEmail,
              },
            },
          },
          { new: true }
        );

        for (const item of processingOrder.items) {
          await Book.findByIdAndUpdate(item.book, {
            $inc: {
              stock: -item.quantity,
              reserved: -item.quantity,
            },
          });
        }
        transactionSucceeded = true;
      } else {
        throw txError;
      }
    }

    if (!transactionSucceeded || !updatedOrder) {
      throw new AppError('Error al asentar la confirmación del pago en la base de datos.', 500);
    }

    // 8. NOTIFICACIÓN EN TIEMPO REAL VÍA WEBSOCKETS (order:updated)
    emitOrderUpdated(
      {
        orderId: updatedOrder.id,
        status: 'pagado',
        shippingStatus: 'pendiente',
        updatedAt: new Date().toISOString(),
      },
      req.user.id
    );

    res.status(200).json({
      success: true,
      data: {
        order: updatedOrder.toJSON(),
        message: 'Pago confirmado exitosamente. Stock descontado.',
      },
    });
  } catch (error) {
    next(error);
  }
};
