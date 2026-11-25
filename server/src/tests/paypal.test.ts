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
import { setPayPalProvider, resetPayPalProvider, PayPalProvider, PayPalCaptureResult } from '../services/paypal.service';

describe('Entrega 5: Pasarela PayPal Sandbox (Integración Segura, Atómica e Idempotente)', () => {
  let app: Application;
  let mongoServer: MongoMemoryServer;
  let client1Token: string;
  let client1Id: string;
  let client2Token: string;
  let client2Id: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    app = createApp();

    const client1 = await User.create({
      name: 'Cliente PayPal 1',
      email: 'paypal1@ejemplo.com',
      password: 'Password123!',
      role: 'cliente',
    });
    client1Id = client1.id;

    const client2 = await User.create({
      name: 'Cliente PayPal 2',
      email: 'paypal2@ejemplo.com',
      password: 'Password123!',
      role: 'cliente',
    });
    client2Id = client2.id;

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
  }, 30000);

  afterAll(async () => {
    resetPayPalProvider();
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await Order.deleteMany({});
    await Book.deleteMany({});
  });

  describe('Creación de Orden PayPal (POST /api/payments/paypal/create)', () => {
    it('debe crear la orden en PayPal con el monto en centavos convertido a decimal ("XX.XX")', async () => {
      const book = await Book.create({
        title: 'Libro PayPal Ebook',
        author: 'Autor',
        category: 'Tech',
        description: 'Test PayPal.',
        price: 2999, // $29.99
        coverUrl: 'https://example.com/p1.jpg',
        stock: 10,
        reserved: 1,
      });

      const order = await Order.create({
        user: client1Id,
        items: [
          {
            book: book._id,
            title: book.title,
            quantity: 1,
            unitPrice: 2999,
            subtotal: 2999,
          },
        ],
        shippingAddress: 'Calle PayPal 123',
        deliveryEmail: 'paypal1@ejemplo.com',
        totalAmount: 2999,
        status: 'pendiente_pago',
        shippingStatus: 'pendiente',
        reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });

      // Configurar mock controlado de PayPal
      const mockPayPal: PayPalProvider = {
        async createOrder(ord) {
          expect(ord.totalAmount).toBe(2999);
          return { id: 'PAYPAL-ORDER-12345', status: 'CREATED' };
        },
        async captureOrder() {
          throw new Error('Not implemented');
        },
      };
      setPayPalProvider(mockPayPal);

      const res = await request(app)
        .post('/api/payments/paypal/create')
        .set('Authorization', `Bearer ${client1Token}`)
        .send({ orderId: order.id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.paypalOrderId).toBe('PAYPAL-ORDER-12345');

      const updatedOrder = await Order.findById(order.id);
      expect(updatedOrder!.paypalOrderId).toBe('PAYPAL-ORDER-12345');
    });

    it('CRITERIO CRÍTICO: debe rechazar con 403 Forbidden si un cliente intenta crear pago de un pedido ajeno', async () => {
      const book = await Book.create({
        title: 'Libro Ajeno 1',
        author: 'Autor',
        category: 'Tech',
        description: 'Test.',
        price: 1000,
        coverUrl: 'https://example.com/ajeno1.jpg',
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
            unitPrice: 1000,
            subtotal: 1000,
          },
        ],
        shippingAddress: 'Calle Ajena 100',
        deliveryEmail: 'ajeno@ejemplo.com',
        totalAmount: 1000,
        status: 'pendiente_pago',
        shippingStatus: 'pendiente',
        reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });

      // Cliente 2 intentando crear pago de la orden de Cliente 1
      const res = await request(app)
        .post('/api/payments/paypal/create')
        .set('Authorization', `Bearer ${client2Token}`)
        .send({ orderId: order.id });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('este pedido pertenece a otro usuario');
    });
  });

  describe('Captura de Orden PayPal (POST /api/payments/paypal/capture)', () => {
    it('CRITERIO CRÍTICO: debe capturar exitosamente, pasar a "pagado" y descontar stock y reserved definitivamente', async () => {
      const book = await Book.create({
        title: 'Libro Transaccional',
        author: 'Autor',
        category: 'Tech',
        description: 'Test stock deduction.',
        price: 2500, // $25.00
        coverUrl: 'https://example.com/p2.jpg',
        stock: 10,
        reserved: 2, // 2 reservadas por esta orden
      });

      const order = await Order.create({
        user: client1Id,
        items: [
          {
            book: book._id,
            title: book.title,
            quantity: 2,
            unitPrice: 2500,
            subtotal: 5000,
          },
        ],
        shippingAddress: 'Calle Pago 456',
        deliveryEmail: 'paypal1@ejemplo.com',
        totalAmount: 5000, // $50.00
        status: 'pendiente_pago',
        shippingStatus: 'pendiente',
        reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });

      const mockPayPal: PayPalProvider = {
        async createOrder() {
          return { id: 'MOCK', status: 'CREATED' };
        },
        async captureOrder(paypalOrderId): Promise<PayPalCaptureResult> {
          return {
            captureId: 'CAPTURE-ID-99999',
            status: 'COMPLETED',
            amount: '50.00', // Coincide exactamente con 5000 centavos
            currency: 'USD',
            customId: order.id,
            referenceId: order.id,
            payerEmail: 'comprador@sandbox.paypal.com',
          };
        },
      };
      setPayPalProvider(mockPayPal);

      const res = await request(app)
        .post('/api/payments/paypal/capture')
        .set('Authorization', `Bearer ${client1Token}`)
        .send({
          orderId: order.id,
          paypalOrderId: 'PAYPAL-ORDER-99999',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order.status).toBe('pagado');
      expect(res.body.data.order.shippingStatus).toBe('pendiente');
      expect(res.body.data.order.paypalCaptureId).toBe('CAPTURE-ID-99999');

      // Verificar en la BD que el libro redujo su stock real (10 - 2 = 8) y reserved (2 - 2 = 0)
      const updatedBook = await Book.findById(book.id);
      expect(updatedBook!.stock).toBe(8);
      expect(updatedBook!.reserved).toBe(0);
      expect(updatedBook!.availableStock).toBe(8);
    });

    it('CRITERIO CRÍTICO: CAPTURA REPETIDA (IDEMPOTENCIA) devuelve el resultado conocido sin descontar stock otra vez', async () => {
      const book = await Book.create({
        title: 'Libro Idempotencia',
        author: 'Autor',
        category: 'Tech',
        description: 'Test idempotencia.',
        price: 2000,
        coverUrl: 'https://example.com/p3.jpg',
        stock: 8, // Stock actual
        reserved: 0,
      });

      // Orden que ya figura en estado 'pagado'
      const alreadyPaidOrder = await Order.create({
        user: client1Id,
        items: [
          {
            book: book._id,
            title: book.title,
            quantity: 2,
            unitPrice: 2000,
            subtotal: 4000,
          },
        ],
        shippingAddress: 'Calle Ya Pagada 789',
        deliveryEmail: 'pagado@ejemplo.com',
        totalAmount: 4000,
        status: 'pagado',
        shippingStatus: 'pendiente',
        paypalCaptureId: 'CAPTURE-EXISTING-11111',
        reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });

      // Si llamamos a capture nuevamente, no debe fallar ni llamar a PayPal
      const res = await request(app)
        .post('/api/payments/paypal/capture')
        .set('Authorization', `Bearer ${client1Token}`)
        .send({
          orderId: alreadyPaidOrder.id,
          paypalOrderId: 'PAYPAL-EXISTING-11111',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.alreadyCaptured).toBe(true);
      expect(res.body.data.order.status).toBe('pagado');

      // Comprobación crítica: El stock NO debió descontarse de nuevo (debe seguir en 8)
      const bookAfterRepeat = await Book.findById(book.id);
      expect(bookAfterRepeat!.stock).toBe(8);
      expect(bookAfterRepeat!.reserved).toBe(0);
    });

    it('CRITERIO CRÍTICO: debe rechazar captura con discrepancia financiera en el monto capturado', async () => {
      const book = await Book.create({
        title: 'Libro Auditoría',
        author: 'Autor',
        category: 'Tech',
        description: 'Test fraude monto.',
        price: 3000, // $30.00
        coverUrl: 'https://example.com/p4.jpg',
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
            unitPrice: 3000,
            subtotal: 3000,
          },
        ],
        shippingAddress: 'Calle Auditoría 111',
        deliveryEmail: 'auditoria@ejemplo.com',
        totalAmount: 3000, // $30.00 requeridos
        status: 'pendiente_pago',
        shippingStatus: 'pendiente',
        reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });

      // Simular que PayPal capturó $20.00 en lugar de $30.00
      const mockFraudPayPal: PayPalProvider = {
        async createOrder() {
          return { id: 'MOCK', status: 'CREATED' };
        },
        async captureOrder(): Promise<PayPalCaptureResult> {
          return {
            captureId: 'CAPTURE-DISCREPANCY',
            status: 'COMPLETED',
            amount: '20.00', // Discrepancia intencional
            currency: 'USD',
            customId: order.id,
          };
        },
      };
      setPayPalProvider(mockFraudPayPal);

      const res = await request(app)
        .post('/api/payments/paypal/capture')
        .set('Authorization', `Bearer ${client1Token}`)
        .send({
          orderId: order.id,
          paypalOrderId: 'PAYPAL-DISCREPANCY',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Discrepancia financiera');

      // Verificar que el estado del pedido no quedó en pagado (se revirtió a pendiente_pago)
      const dbOrder = await Order.findById(order.id);
      expect(dbOrder!.status).toBe('pendiente_pago');

      // El stock real NO debió ser descontado
      const dbBook = await Book.findById(book.id);
      expect(dbBook!.stock).toBe(5);
    });

    it('CRITERIO CRÍTICO: debe rechazar captura si el custom_id no coincide con el pedido', async () => {
      const book = await Book.create({
        title: 'Libro Reference Test',
        author: 'Autor',
        category: 'Tech',
        description: 'Test reference id.',
        price: 1500,
        coverUrl: 'https://example.com/p5.jpg',
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
        shippingAddress: 'Calle Reference 222',
        deliveryEmail: 'ref@ejemplo.com',
        totalAmount: 1500,
        status: 'pendiente_pago',
        shippingStatus: 'pendiente',
        reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });

      const mockWrongCustomId: PayPalProvider = {
        async createOrder() {
          return { id: 'MOCK', status: 'CREATED' };
        },
        async captureOrder(): Promise<PayPalCaptureResult> {
          return {
            captureId: 'CAPTURE-WRONG-REF',
            status: 'COMPLETED',
            amount: '15.00',
            currency: 'USD',
            customId: '65b8c9f00000000000000000', // ID diferente
          };
        },
      };
      setPayPalProvider(mockWrongCustomId);

      const res = await request(app)
        .post('/api/payments/paypal/capture')
        .set('Authorization', `Bearer ${client1Token}`)
        .send({
          orderId: order.id,
          paypalOrderId: 'PAYPAL-WRONG-REF',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('identificador de referencia');
    });

    it('debe rechazar captura de pedido ajeno con 403 Forbidden', async () => {
      const book = await Book.create({
        title: 'Libro Ajeno 2',
        author: 'Autor',
        category: 'Tech',
        description: 'Test.',
        price: 1000,
        coverUrl: 'https://example.com/ajeno2.jpg',
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
            unitPrice: 1000,
            subtotal: 1000,
          },
        ],
        shippingAddress: 'Calle Ajena 333',
        deliveryEmail: 'ajeno@ejemplo.com',
        totalAmount: 1000,
        status: 'pendiente_pago',
        shippingStatus: 'pendiente',
        reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });

      const res = await request(app)
        .post('/api/payments/paypal/capture')
        .set('Authorization', `Bearer ${client2Token}`) // Cliente 2 intenta capturar pedido de Cliente 1
        .send({
          orderId: order.id,
          paypalOrderId: 'PAYPAL-ATTACK',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('este pedido pertenece a otro usuario');
    });
  });
});
