import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Order, ShippingStatus } from '../models/order.model';
import { AppError } from '../middleware/errorHandler';
import { emitOrderUpdated } from '../socket';

// Máquina de estados finitos estricta para el flujo de envíos
const VALID_SHIPPING_TRANSITIONS: Record<ShippingStatus, ShippingStatus[]> = {
  pendiente: ['en_preparacion'],
  en_preparacion: ['listo'],
  listo: ['entregado'],
  entregado: [],
};

export const updateShippingStatusSchema = z.object({
  shippingStatus: z.enum(['pendiente', 'en_preparacion', 'listo', 'entregado'], {
    errorMap: () => ({ message: 'El estado de envío debe ser: pendiente, en_preparacion, listo o entregado' }),
  }),
});

/**
 * Consulta de pedidos para el panel de administración
 * Permite filtrar por status y shippingStatus con paginación
 */
export const getAdminOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, shippingStatus, page = '1', limit = '50' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, any> = {};
    if (status) {
      filter.status = status;
    }
    if (shippingStatus) {
      filter.shippingStatus = shippingStatus;
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('user', 'name email'),
      Order.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        orders: orders.map((o) => o.toJSON()),
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Actualiza el estado de envío aplicando estrictamente la máquina de estados
 * y emite la notificación en tiempo real a la sala del usuario y a la sala admin.
 */
export const updateShippingStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { shippingStatus: nextShippingStatus } = updateShippingStatusSchema.parse(req.body);

    const order = await Order.findById(id);
    if (!order) {
      throw new AppError('Pedido no encontrado', 404);
    }

    // Regla de negocio: Solo se pueden gestionar envíos de pedidos efectivamente pagados
    if (order.status !== 'pagado') {
      throw new AppError(
        `Solo se puede gestionar el envío de pedidos con estado "pagado". Estado actual: "${order.status}"`,
        400
      );
    }

    // Validación estricta de la máquina de estados finitos
    const allowedTransitions = VALID_SHIPPING_TRANSITIONS[order.shippingStatus] || [];
    if (!allowedTransitions.includes(nextShippingStatus)) {
      throw new AppError(
        `Transición de estado de envío inválida: no se permite cambiar de "${order.shippingStatus}" a "${nextShippingStatus}". Transiciones permitidas: ${
          allowedTransitions.length > 0 ? allowedTransitions.join(', ') : 'ninguna (estado final)'
        }`,
        400
      );
    }

    // Aplicar la transición válida
    order.shippingStatus = nextShippingStatus;
    await order.save();

    // Emisión en tiempo real vía WebSockets a la sala personal user:<id> y sala admin
    const userIdStr = (order.user && (order.user as any)._id
      ? (order.user as any)._id
      : order.user
    ).toString();

    emitOrderUpdated(
      {
        orderId: order.id,
        status: order.status,
        shippingStatus: order.shippingStatus,
        updatedAt: order.updatedAt.toISOString(),
      },
      userIdStr
    );

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
