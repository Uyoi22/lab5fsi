import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
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
import { cleanupExpiredOrders } from '../services/expiration.service';

describe('Entrega 4: Carrito, Pedidos y Reserva Atómica de Stock con Expiración', () => {
  let app: Application;
  let mongoServer: MongoMemoryServer;
  let client1Token: string;
  let client1Id: string;
  let client2Token: string;
  let client2Id: string;
  let adminToken: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    app = createApp();

    const client1 = await User.create({
      name: 'Cliente Uno',
      email: 'cliente1@ejemplo.com',
      password: 'Password123!',
      role: 'cliente',
    });
    client1Id = client1.id;

    const client2 = await User.create({
      name: 'Cliente Dos',
      email: 'cliente2@ejemplo.com',
      password: 'Password123!',
      role: 'cliente',
    });
    client2Id = client2.id;

    const admin = await User.create({
      name: 'Admin Global',
      email: 'admin.orders@ejemplo.com',
      password: 'AdminPassword123!',
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
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await Order.deleteMany({});
    await Book.deleteMany({});
  });

  describe('Creación de Pedidos y Reglas de Negocio (POST /api/orders)', () => {
    it('CRITERIO CRÍTICO: debe ignorar cualquier precio manipulado desde el cliente y recalcular con la BD', async () => {
      const book = await Book.create({
        title: 'Libro Precio Seguro',
        author: 'Autor Confiable',
        category: 'Seguridad',
        description: 'Test de integridad financiera.',
        price: 2500, // $25.00 oficiales en BD
        coverUrl: 'https://example.com/cover.jpg',
        stock: 10,
        reserved: 0,
      });

      // El atacante intenta enviar un precio alterado de $0.01 (1 centavo) y totalAmount alterado
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${client1Token}`)
        .send({
          items: [{ bookId: book.id, quantity: 2, unitPrice: 1, subtotal: 2 }],
          shippingAddress: 'Av. Siempre Viva 742, Springfield',
          deliveryEmail: 'entrega@ejemplo.com',
          totalAmount: 2, // Intento de fraude
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const createdOrder = res.body.data.order;
      // El backend forzó los $25.00 (2500) oficiales
      expect(createdOrder.items[0].unitPrice).toBe(2500);
      expect(createdOrder.items[0].subtotal).toBe(5000); // 2 * 2500
      expect(createdOrder.totalAmount).toBe(5000); // $50.00 exactos

      // Verificar que la BD del pedido tenga los 5000 centavos
      const dbOrder = await Order.findById(createdOrder.id);
      expect(dbOrder!.totalAmount).toBe(5000);
    });

    it('CRITERIO CRÍTICO: debe realizar reserva atómica condicional incrementando "reserved"', async () => {
      const book = await Book.create({
        title: 'Libro Stock Atómico',
        author: 'Concurrencia Expert',
        category: 'Sistemas',
        description: 'Test de reserva atómica.',
        price: 3000,
        coverUrl: 'https://example.com/atomic.jpg',
        stock: 10,
        reserved: 2, // 8 disponibles
      });

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${client1Token}`)
        .send({
          items: [{ bookId: book.id, quantity: 3 }],
          shippingAddress: 'Calle Falsa 123, Ciudad',
          deliveryEmail: 'cliente1@ejemplo.com',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.order.status).toBe('pendiente_pago');

      // Verificar que el stock reservado aumentó exactamente en 3 (de 2 a 5)
      const updatedBook = await Book.findById(book.id);
      expect(updatedBook!.reserved).toBe(5);
      expect(updatedBook!.availableStock).toBe(5); // 10 - 5
    });

    it('CRITERIO CRÍTICO: debe rechazar con 409 Conflict si el stock es insuficiente y no reservar nada', async () => {
      const book = await Book.create({
        title: 'Libro Pocas Unidades',
        author: 'Autor Escaso',
        category: 'Colección',
        description: 'Test de stock insuficiente.',
        price: 1500,
        coverUrl: 'https://example.com/scarce.jpg',
        stock: 5,
        reserved: 3, // Solo 2 disponibles
      });

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${client1Token}`)
        .send({
          items: [{ bookId: book.id, quantity: 3 }], // Pide 3 habiendo solo 2
          shippingAddress: 'Calle Sin Stock 404',
          deliveryEmail: 'fail@ejemplo.com',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Stock insuficiente');

      // Verificar que el stock reservado quedó intacto en 3
      const unchangedBook = await Book.findById(book.id);
      expect(unchangedBook!.reserved).toBe(3);
    });

    it('debe ejecutar ROLLBACK de reservas si el segundo libro de un pedido falla por stock', async () => {
      const book1 = await Book.create({
        title: 'Libro Con Stock Suficiente',
        author: 'Autor Uno',
        category: 'A',
        description: 'Tiene stock.',
        price: 1000,
        coverUrl: 'https://example.com/b1.jpg',
        stock: 10,
        reserved: 0,
      });

      const book2 = await Book.create({
        title: 'Libro Sin Stock Suficiente',
        author: 'Autor Dos',
        category: 'B',
        description: 'No tiene stock.',
        price: 2000,
        coverUrl: 'https://example.com/b2.jpg',
        stock: 1,
        reserved: 1, // 0 disponibles
      });

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${client1Token}`)
        .send({
          items: [
            { bookId: book1.id, quantity: 2 }, // Este se intentaría reservar primero
            { bookId: book2.id, quantity: 1 }, // Este fallará
          ],
          shippingAddress: 'Calle Rollback 999',
          deliveryEmail: 'rollback@ejemplo.com',
        });

      expect(res.status).toBe(409);

      // Verificar que book1 NO quedó reservado gracias al rollback
      const updatedBook1 = await Book.findById(book1.id);
      expect(updatedBook1!.reserved).toBe(0);

      // Verificar que no se creó ningún pedido en la BD
      const orderCount = await Order.countDocuments();
      expect(orderCount).toBe(0);
    });
  });

  describe('Job Periódico de Expiración de Reservas (30 min)', () => {
    it('debe liberar el stock reservado y cancelar órdenes pendientes_pago expiradas', async () => {
      const book = await Book.create({
        title: 'Libro Para Expirar',
        author: 'Cronos',
        category: 'Tiempo',
        description: 'Test expiración.',
        price: 2000,
        coverUrl: 'https://example.com/time.jpg',
        stock: 10,
        reserved: 4, // 4 reservadas por una orden previa
      });

      // Crear orden con expiración en el pasado
      const pastDate = new Date(Date.now() - 35 * 60 * 1000); // Hace 35 minutos
      const expiredOrder = await Order.create({
        user: client1Id,
        items: [
          {
            book: book._id,
            title: book.title,
            quantity: 4,
            unitPrice: 2000,
            subtotal: 8000,
          },
        ],
        shippingAddress: 'Calle Vencida 100',
        deliveryEmail: 'vencido@ejemplo.com',
        totalAmount: 8000,
        status: 'pendiente_pago',
        shippingStatus: 'pendiente',
        reservationExpiresAt: pastDate,
      });

      // Ejecutar la limpieza de expirados
      const cleaned = await cleanupExpiredOrders();
      expect(cleaned).toBe(1);

      // Verificar que la orden pasó a cancelado
      const dbOrder = await Order.findById(expiredOrder.id);
      expect(dbOrder!.status).toBe('cancelado');

      // Verificar que el stock reservado fue liberado (4 - 4 = 0)
      const restoredBook = await Book.findById(book.id);
      expect(restoredBook!.reserved).toBe(0);
      expect(restoredBook!.availableStock).toBe(10);
    });

    it('REGLA CRÍTICA: el job de expiración debe IGNORAR pedidos en "procesando_pago"', async () => {
      const book = await Book.create({
        title: 'Libro En Proceso De Cobro',
        author: 'PayPal Tester',
        category: 'Pagos',
        description: 'No debe cancelarse si está en procesando_pago.',
        price: 2000,
        coverUrl: 'https://example.com/proc.jpg',
        stock: 10,
        reserved: 3,
      });

      const pastDate = new Date(Date.now() - 31 * 60 * 1000);
      const processingOrder = await Order.create({
        user: client1Id,
        items: [
          {
            book: book._id,
            title: book.title,
            quantity: 3,
            unitPrice: 2000,
            subtotal: 6000,
          },
        ],
        shippingAddress: 'Calle Pasarela 500',
        deliveryEmail: 'pasarela@ejemplo.com',
        totalAmount: 6000,
        status: 'procesando_pago', // En proceso de cobro
        shippingStatus: 'pendiente',
        reservationExpiresAt: pastDate,
      });

      // Ejecutar limpieza
      const cleaned = await cleanupExpiredOrders();
      expect(cleaned).toBe(0); // No canceló ninguna

      // Verificar que la orden sigue en 'procesando_pago'
      const checkOrder = await Order.findById(processingOrder.id);
      expect(checkOrder!.status).toBe('procesando_pago');

      // El stock reservado NO debe ser liberado
      const checkBook = await Book.findById(book.id);
      expect(checkBook!.reserved).toBe(3);
    });
  });

  describe('Autorización y Propiedad de Pedidos (GET /api/orders/:id)', () => {
    let orderOfClient1Id: string;

    beforeEach(async () => {
      const book = await Book.create({
        title: 'Libro Privado',
        author: 'Autor',
        category: 'Privado',
        description: 'Test propiedad.',
        price: 1500,
        coverUrl: 'https://example.com/priv.jpg',
        stock: 5,
        reserved: 1,
      });

      const order = await Order.create({
        user: client1Id,
        items: [
          {
            book: book._id,
            title: book.title,
            quantity: 1,
            unitPrice: 1500,
            subtotal: 1500,
          },
        ],
        shippingAddress: 'Casa de Cliente 1',
        deliveryEmail: 'cliente1@ejemplo.com',
        totalAmount: 1500,
        status: 'pendiente_pago',
        shippingStatus: 'pendiente',
        reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });

      orderOfClient1Id = order.id;
    });

    it('debe permitir al dueño del pedido consultar su detalle con 200 OK', async () => {
      const res = await request(app)
        .get(`/api/orders/${orderOfClient1Id}`)
        .set('Authorization', `Bearer ${client1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.order.id).toBe(orderOfClient1Id);
    });

    it('CRITERIO CRÍTICO: debe rechazar a un cliente ajeno intentando ver el pedido con 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/orders/${orderOfClient1Id}`)
        .set('Authorization', `Bearer ${client2Token}`); // Cliente 2 intentando ver pedido de Cliente 1

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('este pedido pertenece a otro usuario');
    });

    it('debe permitir a un administrador consultar cualquier pedido con 200 OK', async () => {
      const res = await request(app)
        .get(`/api/orders/${orderOfClient1Id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.order.id).toBe(orderOfClient1Id);
    });
  });
});
