import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { Application } from 'express';
import { Book } from '../models/book.model';
import { User } from '../models/user.model';
import { Order } from '../models/order.model';
import { config } from '../config/env';

describe('Entrega 6: Historial de Pedidos y Autorización por Propiedad', () => {
  let app: Application;
  let mongoServer: MongoMemoryServer;
  let client1Token: string;
  let client1Id: string;
  let client2Token: string;
  let client2Id: string;
  let adminToken: string;
  let book1Id: string;
  let order1Id: string; // pedido del cliente1
  let order2Id: string; // pedido del cliente2

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    app = createApp();

    // Crear usuarios
    const client1 = await User.create({
      name: 'Cliente Historial 1',
      email: 'hist.client1@ejemplo.com',
      password: 'Password123!',
      role: 'cliente',
    });
    client1Id = client1.id;

    const client2 = await User.create({
      name: 'Cliente Historial 2',
      email: 'hist.client2@ejemplo.com',
      password: 'Password123!',
      role: 'cliente',
    });
    client2Id = client2.id;

    const admin = await User.create({
      name: 'Admin Historial',
      email: 'hist.admin@ejemplo.com',
      password: 'AdminPass123!',
      role: 'admin',
    });

    client1Token = jwt.sign(
      { id: client1.id, email: client1.email, role: 'cliente' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
    client2Token = jwt.sign(
      { id: client2.id, email: client2.email, role: 'cliente' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
    adminToken = jwt.sign(
      { id: admin.id, email: admin.email, role: 'admin' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Crear libro base
    const book1 = await Book.create({
      title: 'Libro Historial Test',
      author: 'Autor Test',
      category: 'Programación',
      description: 'Libro para pruebas de historial',
      price: 1500,
      coverUrl: 'https://covers.example.com/historial-test.jpg',
      stock: 20,
      reserved: 0,
      isActive: true,
    });
    book1Id = book1.id;

    // Crear 2 pedidos del cliente1 y 1 del cliente2 directamente en BD
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const o1 = await Order.create({
      user: client1Id,
      items: [{ book: book1Id, title: 'Libro Historial Test', quantity: 1, unitPrice: 1500, subtotal: 1500 }],
      shippingAddress: 'Calle 1, Ciudad A',
      deliveryEmail: 'hist.client1@ejemplo.com',
      totalAmount: 1500,
      status: 'pendiente_pago',
      shippingStatus: 'pendiente',
      reservationExpiresAt: expiresAt,
    });
    order1Id = o1.id;

    await Order.create({
      user: client1Id,
      items: [{ book: book1Id, title: 'Libro Historial Test', quantity: 2, unitPrice: 1500, subtotal: 3000 }],
      shippingAddress: 'Calle 1, Ciudad A',
      deliveryEmail: 'hist.client1@ejemplo.com',
      totalAmount: 3000,
      status: 'pagado',
      shippingStatus: 'en_preparacion',
      reservationExpiresAt: expiresAt,
    });

    const o2 = await Order.create({
      user: client2Id,
      items: [{ book: book1Id, title: 'Libro Historial Test', quantity: 1, unitPrice: 1500, subtotal: 1500 }],
      shippingAddress: 'Av. Principal 456, Ciudad B',
      deliveryEmail: 'hist.client2@ejemplo.com',
      totalAmount: 1500,
      status: 'pendiente_pago',
      shippingStatus: 'pendiente',
      reservationExpiresAt: expiresAt,
    });
    order2Id = o2.id;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  // ── GET /api/orders/my-orders ─────────────────────────────────────────────

  it('GET /api/orders/my-orders → 401 sin token', async () => {
    const res = await request(app).get('/api/orders/my-orders');
    expect(res.status).toBe(401);
  });

  it('GET /api/orders/my-orders → solo devuelve pedidos del usuario autenticado', async () => {
    const res = await request(app)
      .get('/api/orders/my-orders')
      .set('Authorization', `Bearer ${client1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const orders = res.body.data.orders as Array<{ user: string }>;
    // Cliente1 tiene 2 pedidos
    expect(orders.length).toBe(2);
    // Todos los pedidos pertenecen al cliente1
    orders.forEach((o) => expect(o.user).toBe(client1Id));
  });

  it('GET /api/orders/my-orders → cliente2 no ve pedidos de cliente1', async () => {
    const res = await request(app)
      .get('/api/orders/my-orders')
      .set('Authorization', `Bearer ${client2Token}`);

    expect(res.status).toBe(200);
    const orders = res.body.data.orders as Array<{ id: string }>;
    // Cliente2 solo tiene 1 pedido
    expect(orders.length).toBe(1);
    // No contiene el pedido del cliente1
    const ids = orders.map((o: { id: string }) => o.id);
    expect(ids).not.toContain(order1Id);
  });

  it('GET /api/orders/my-orders → se devuelve ordenado por createdAt DESC', async () => {
    const res = await request(app)
      .get('/api/orders/my-orders')
      .set('Authorization', `Bearer ${client1Token}`);

    expect(res.status).toBe(200);
    const orders = res.body.data.orders as Array<{ createdAt: string }>;
    if (orders.length >= 2) {
      const d1 = new Date(orders[0].createdAt).getTime();
      const d2 = new Date(orders[1].createdAt).getTime();
      expect(d1).toBeGreaterThanOrEqual(d2);
    }
  });

  // ── GET /api/orders/:id ───────────────────────────────────────────────────

  it('GET /api/orders/:id → 401 sin token', async () => {
    const res = await request(app).get(`/api/orders/${order1Id}`);
    expect(res.status).toBe(401);
  });

  it('GET /api/orders/:id → propietario puede ver su pedido', async () => {
    const res = await request(app)
      .get(`/api/orders/${order1Id}`)
      .set('Authorization', `Bearer ${client1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.order.id).toBe(order1Id);
  });

  it('GET /api/orders/:id → 403 cuando cliente intenta ver pedido ajeno', async () => {
    // client2 intenta ver pedido de client1
    const res = await request(app)
      .get(`/api/orders/${order1Id}`)
      .set('Authorization', `Bearer ${client2Token}`);

    expect(res.status).toBe(403);
  });

  it('GET /api/orders/:id → admin puede ver cualquier pedido', async () => {
    // Admin accede al pedido de client2
    const res = await request(app)
      .get(`/api/orders/${order2Id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.order.id).toBe(order2Id);
  });

  it('GET /api/orders/:id → 404 para ID inexistente', async () => {
    const fakeId = new mongoose.Types.ObjectId().toHexString();
    const res = await request(app)
      .get(`/api/orders/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('GET /api/orders/:id → incluye items con título y precios en centavos', async () => {
    const res = await request(app)
      .get(`/api/orders/${order1Id}`)
      .set('Authorization', `Bearer ${client1Token}`);

    expect(res.status).toBe(200);
    const order = res.body.data.order;
    expect(order.items).toHaveLength(1);
    expect(order.items[0].title).toBe('Libro Historial Test');
    expect(order.items[0].unitPrice).toBe(1500);
    expect(order.items[0].subtotal).toBe(1500);
    expect(order.totalAmount).toBe(1500);
  });
});
