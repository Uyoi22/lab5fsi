import { Order } from '../models/order.model';
import { Book } from '../models/book.model';

export const cleanupExpiredOrders = async (): Promise<number> => {
  const now = new Date();

  // Regla crítica: Buscar únicamente órdenes en 'pendiente_pago' expiradas.
  // Ignora estrictamente pedidos en 'procesando_pago', 'pagado' o ya cancelados.
  const expiredOrders = await Order.find({
    status: 'pendiente_pago',
    reservationExpiresAt: { $lte: now },
  });

  if (expiredOrders.length === 0) {
    return 0;
  }

  let cancelledCount = 0;

  for (const order of expiredOrders) {
    // Transición atómica de 'pendiente_pago' a 'cancelado' para evitar carreras con captura de pagos
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: order._id, status: 'pendiente_pago' },
      { $set: { status: 'cancelado' } },
      { new: true }
    );

    // Si la orden ya no estaba en 'pendiente_pago' (por ejemplo pasó a 'procesando_pago'), no tocar
    if (!updatedOrder) {
      continue;
    }

    // Liberar el stock reservado atómicamente para cada libro
    for (const item of order.items) {
      await Book.findByIdAndUpdate(item.book, {
        $inc: { reserved: -item.quantity },
      });
    }

    cancelledCount++;
    console.log(`⏰ Reserva expirada para pedido ${order.id}. Stock reservado liberado y pedido cancelado.`);
  }

  return cancelledCount;
};

let cleanupTimer: NodeJS.Timeout | null = null;

export const startReservationCleanupJob = (intervalMs = 60000): NodeJS.Timeout => {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
  }

  console.log(`⏱️ Iniciando job de expiración de reservas cada ${Math.round(intervalMs / 1000)}s`);

  cleanupTimer = setInterval(async () => {
    try {
      await cleanupExpiredOrders();
    } catch (error) {
      console.error('❌ Error en el job de expiración de reservas:', error);
    }
  }, intervalMs);

  return cleanupTimer;
};

export const stopReservationCleanupJob = (): void => {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
    console.log('⏱️ Job de expiración de reservas detenido');
  }
};
