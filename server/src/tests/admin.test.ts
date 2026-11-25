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

describe('Entrega 7: Panel de Administración, Máquina de Estados y Gestión de Envíos', () => {
  let app: Application;
  let mongoServer: MongoMemoryServer;
  let clientToken: string;
  let adminToken: string;
  let testBookId: string;
  let paidOrderId: string;
  let unpaidOrderId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    app = createApp();

    const client = await User.create({
      name: 'Cliente Prueba Admin',
      email: 'client.admin@ejemplo.com',
      password: 'Password123!',
      role: 'cliente',
    });

    const admin = await User.create({
      name: 'Super Administrador',
      email: 'super.admin@ejemplo.com',
      password: 'AdminPassword123!',
      role: 'admin',
    });

    clientToken = jwt.sign(
      { id: client.id, email: client.email, role: 'cliente' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    adminToken = jwt.sign(
      { id: admin.id, email: admin.email, role: 'admin' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const book = await Book.create({
      title: 'Libro de Prueba Kanban',
      author: 'Autor Kanban',
      category: 'Negocios',
      description: 'Libro para verificar transiciones de envío',
      price: 2500,
      coverUrl: 'https://covers.example.com/kanban.jpg',
      stock: 50,
      reserved: 0,
      isActive: true,
    });
    testBookId = book.id;

    // Pedido pagado listo para transiciones de envío
    const paidOrder = await Order.create({
      user: client.id,
      items: [
        {
          book: testBookId,
          title: 'Libro de Prueba Kanban',
          quantity: 1,
          unitPrice: 2500,
          subtotal: 2500,
        },
      ],
      shippingAddress: 'Av. Siempre Viva 742',
      deliveryEmail: 'client.admin@ejemplo.com',
      totalAmount: 2500,
      status: 'pagado',
      shippingStatus: 'pendiente',
      reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    paidOrderId = paidOrder.id;

    // Pedido pendiente de pago (para verificar que no se puede avanzar su envío)
    const unpaidOrder = await Order.create({
      user: client.id,
      items: [
        {
          book: testBookId,
          title: 'Libro de Prueba Kanban',
          quantity: 1,
          unitPrice: 2500,
          subtotal: 2500,
        },
      ],
      shippingAddress: 'Av. Siempre Viva 742',
      deliveryEmail: 'client.admin@ejemplo.com',
      totalAmount: 2500,
      status: 'pendiente_pago',
      shippingStatus: 'pendiente',
      reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    unpaidOrderId = unpaidOrder.id;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  // ── GET /api/admin/orders ──────────────────────────────────────────────────

  describe('Consulta de Pedidos Admin (GET /api/admin/orders)', () => {
    it('debe responder 401 si no se envía token de autenticación', async () => {
      const res = await request(app).get('/api/admin/orders');
      expect(res.status).toBe(401);
    });

    it('debe responder 403 si un usuario con rol "cliente" intenta acceder', async () => {
      const res = await request(app)
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.status).toBe(403);
    });

    it('debe permitir a un administrador listar todos los pedidos con paginación', async () => {
      const res = await request(app)
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.orders)).toBe(true);
      expect(res.body.data.total).toBeGreaterThanOrEqual(2);
      expect(res.body.data).toHaveProperty('page', 1);
      expect(res.body.data).toHaveProperty('totalPages');
    });

    it('debe filtrar pedidos por shippingStatus correctamente', async () => {
      const res = await request(app)
        .get('/api/admin/orders?shippingStatus=pendiente')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const orders = res.body.data.orders as Array<{ shippingStatus: string }>;
      expect(orders.length).toBeGreaterThanOrEqual(1);
      orders.forEach((o) => expect(o.shippingStatus).toBe('pendiente'));
    });
  });

  // ── PATCH /api/admin/orders/:id/shipping-status ────────────────────────────

  describe('Máquina de Estados de Envíos (PATCH /api/admin/orders/:id/shipping-status)', () => {
    it('debe responder 401 si no hay token', async () => {
      const res = await request(app)
        .patch(`/api/admin/orders/${paidOrderId}/shipping-status`)
        .send({ shippingStatus: 'en_preparacion' });
      expect(res.status).toBe(401);
    });

    it('debe responder 403 si un cliente intenta cambiar el estado de envío', async () => {
      const res = await request(app)
        .patch(`/api/admin/orders/${paidOrderId}/shipping-status`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ shippingStatus: 'en_preparacion' });
      expect(res.status).toBe(403);
    });

    it('debe responder 404 para un ID de pedido inexistente', async () => {
      const fakeId = new mongoose.Types.ObjectId().toHexString();
      const res = await request(app)
        .patch(`/api/admin/orders/${fakeId}/shipping-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ shippingStatus: 'en_preparacion' });
      expect(res.status).toBe(404);
    });

    it('debe rechazar (400) gestionar envíos de pedidos no pagados (pendiente_pago)', async () => {
      const res = await request(app)
        .patch(`/api/admin/orders/${unpaidOrderId}/shipping-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ shippingStatus: 'en_preparacion' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/Solo se puede gestionar el envío de pedidos con estado "pagado"/i);
    });

    it('debe rechazar saltos de estado directos: pendiente -> listo (400)', async () => {
      const res = await request(app)
        .patch(`/api/admin/orders/${paidOrderId}/shipping-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ shippingStatus: 'listo' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/Transición de estado de envío inválida/i);
    });

    it('debe rechazar saltos de estado directos: pendiente -> entregado (400)', async () => {
      const res = await request(app)
        .patch(`/api/admin/orders/${paidOrderId}/shipping-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ shippingStatus: 'entregado' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/Transición de estado de envío inválida/i);
    });

    it('debe rechazar transición al mismo estado: pendiente -> pendiente (400)', async () => {
      const res = await request(app)
        .patch(`/api/admin/orders/${paidOrderId}/shipping-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ shippingStatus: 'pendiente' });

      expect(res.status).toBe(400);
    });

    it('TRANSICIÓN VÁLIDA 1: pendiente -> en_preparacion (200)', async () => {
      const res = await request(app)
        .patch(`/api/admin/orders/${paidOrderId}/shipping-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ shippingStatus: 'en_preparacion' });

      expect(res.status).toBe(200);
      expect(res.body.data.order.shippingStatus).toBe('en_preparacion');

      const updated = await Order.findById(paidOrderId);
      expect(updated?.shippingStatus).toBe('en_preparacion');
    });

    it('debe rechazar regresión: en_preparacion -> pendiente (400)', async () => {
      const res = await request(app)
        .patch(`/api/admin/orders/${paidOrderId}/shipping-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ shippingStatus: 'pendiente' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/Transición de estado de envío inválida/i);
    });

    it('TRANSICIÓN VÁLIDA 2: en_preparacion -> listo (200)', async () => {
      const res = await request(app)
        .patch(`/api/admin/orders/${paidOrderId}/shipping-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ shippingStatus: 'listo' });

      expect(res.status).toBe(200);
      expect(res.body.data.order.shippingStatus).toBe('listo');
    });

    it('debe rechazar regresión: listo -> en_preparacion (400)', async () => {
      const res = await request(app)
        .patch(`/api/admin/orders/${paidOrderId}/shipping-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ shippingStatus: 'en_preparacion' });

      expect(res.status).toBe(400);
    });

    it('TRANSICIÓN VÁLIDA 3: listo -> entregado (200)', async () => {
      const res = await request(app)
        .patch(`/api/admin/orders/${paidOrderId}/shipping-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ shippingStatus: 'entregado' });

      expect(res.status).toBe(200);
      expect(res.body.data.order.shippingStatus).toBe('entregado');
    });

    it('debe rechazar cualquier transición desde el estado final entregado (400)', async () => {
      const res = await request(app)
        .patch(`/api/admin/orders/${paidOrderId}/shipping-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ shippingStatus: 'pendiente' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/ninguna \(estado final\)/i);
    });

    it('debe rechazar valores de estado de envío no reconocidos (400 Zod)', async () => {
      const res = await request(app)
        .patch(`/api/admin/orders/${paidOrderId}/shipping-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ shippingStatus: 'en_camino_invalido' });

      expect(res.status).toBe(400);
    });
  });
});
