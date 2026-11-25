import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { AuthUser } from '../types/express';

let io: SocketIOServer | null = null;

export interface MinimalOrderUpdatePayload {
  orderId: string;
  status: string;
  shippingStatus: string;
  updatedAt: string;
}

export const initSocketIO = (httpServer: HttpServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.webOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Middleware de Autenticación de Socket.IO mediante handshake.auth.token
  io.use((socket: Socket, next) => {
    let token = socket.handshake.auth?.token;

    // Soporte alternativo para cabecera authorization
    if (!token && socket.handshake.headers?.authorization) {
      const authHeader = socket.handshake.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      } else {
        token = authHeader;
      }
    }

    if (!token) {
      return next(new Error('Authentication error: Token requerido en handshake.auth.token'));
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as AuthUser;
      socket.data.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
      };
      next();
    } catch (err) {
      return next(new Error('Authentication error: Token inválido o expirado'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as AuthUser;
    const userRoom = `user:${user.id}`;

    // Unión automática a la sala personal segura
    socket.join(userRoom);
    console.log(`🔌 Socket ${socket.id} (Usuario ${user.email}, Rol: ${user.role}) se unió a la sala ${userRoom}`);

    // Si el usuario es administrador, se une a la sala global "admin"
    if (user.role === 'admin') {
      socket.join('admin');
      console.log(`🛡️ Socket ${socket.id} se unió a la sala 'admin'`);
    }

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Socket desconectado (${socket.id}): ${reason}`);
    });
  });

  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO no ha sido inicializado aún.');
  }
  return io;
};

// Emisión en tiempo real con datos mínimos al usuario dueño y a la sala admin
export const emitOrderUpdated = (orderUpdate: MinimalOrderUpdatePayload, userId: string): void => {
  if (!io) {
    console.warn('Socket.IO no disponible para emitir order:updated');
    return;
  }

  // Notificar al dueño en su sala privada
  io.to(`user:${userId}`).emit('order:updated', orderUpdate);

  // Notificar al panel de administración
  io.to('admin').emit('order:updated', orderUpdate);
};
