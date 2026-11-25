import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { initSocketIO, emitOrderUpdated } from '../socket';
import { config } from '../config/env';

describe('Socket.IO Handshake y Salas de Notificación (Entrega 2)', () => {
  let server: http.Server;
  let serverUrl: string;
  let clientToken: string;
  let adminToken: string;
  const clientId = '65b8c9f12345678901234567';
  const adminId = '65b8c9f12345678901234568';

  beforeAll(async () => {
    const app = createApp();
    server = http.createServer(app);
    initSocketIO(server);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo;
        serverUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    clientToken = jwt.sign(
      { id: clientId, email: 'cliente@test.com', role: 'cliente' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    adminToken = jwt.sign(
      { id: adminId, email: 'admin@test.com', role: 'admin' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('debe rechazar conexión Socket.IO sin token en handshake.auth.token', async () => {
    const socket = Client(serverUrl, {
      autoConnect: true,
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      socket.on('connect_error', (err) => {
        expect(err.message).toContain('Token requerido');
        socket.disconnect();
        resolve();
      });
    });
  });

  it('debe conectar cliente con JWT válido y recibir eventos en la sala user:<id>', async () => {
    const clientSocket = Client(serverUrl, {
      auth: { token: clientToken },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        resolve();
      });
    });

    // Probar recepción de orden actualizada
    const updatePromise = new Promise<void>((resolve) => {
      clientSocket.on('order:updated', (data) => {
        expect(data).toHaveProperty('orderId', 'order-123');
        expect(data).toHaveProperty('status', 'pagado');
        expect(data).toHaveProperty('shippingStatus', 'pendiente');
        resolve();
      });
    });

    emitOrderUpdated(
      {
        orderId: 'order-123',
        status: 'pagado',
        shippingStatus: 'pendiente',
        updatedAt: new Date().toISOString(),
      },
      clientId
    );

    await updatePromise;
    clientSocket.disconnect();
  });

  it('debe conectar admin con JWT y recibir eventos en la sala admin', async () => {
    const adminSocket = Client(serverUrl, {
      auth: { token: adminToken },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      adminSocket.on('connect', () => {
        expect(adminSocket.connected).toBe(true);
        resolve();
      });
    });

    const adminReceivePromise = new Promise<void>((resolve) => {
      adminSocket.on('order:updated', (data) => {
        expect(data).toHaveProperty('orderId', 'order-456');
        resolve();
      });
    });

    // Emitir para otro usuario: admin debe recibirlo por estar en la sala 'admin'
    emitOrderUpdated(
      {
        orderId: 'order-456',
        status: 'pagado',
        shippingStatus: 'en_preparacion',
        updatedAt: new Date().toISOString(),
      },
      'otro-usuario-789'
    );

    await adminReceivePromise;
    adminSocket.disconnect();
  });
});
