import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { Application } from 'express';
import { Book } from '../models/book.model';
import { User } from '../models/user.model';
import { config } from '../config/env';

describe('Entrega 3: Catálogo de Libros con Precios en Centavos y Gestión Admin', () => {
  let app: Application;
  let mongoServer: MongoMemoryServer;
  let adminToken: string;
  let clientToken: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    app = createApp();

    const adminUser = await User.create({
      name: 'Admin Libros',
      email: 'admin.libros@ejemplo.com',
      password: 'AdminPassword123!',
      role: 'admin',
    });

    const clientUser = await User.create({
      name: 'Cliente Libros',
      email: 'cliente.libros@ejemplo.com',
      password: 'ClientPassword123!',
      role: 'cliente',
    });

    adminToken = jwt.sign(
      { id: adminUser.id, email: adminUser.email, role: 'admin' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    clientToken = jwt.sign(
      { id: clientUser.id, email: clientUser.email, role: 'cliente' },
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
    await Book.deleteMany({});
  });

  describe('Consulta Pública de Catálogo (GET /api/books y /api/books/:id)', () => {
    beforeEach(async () => {
      await Book.create([
        {
          title: 'Aprende TypeScript',
          author: 'Anders Hejlsberg',
          category: 'Programación',
          description: 'Fundamentos avanzados de TypeScript.',
          price: 2500, // $25.00 en centavos
          coverUrl: 'https://example.com/cover1.jpg',
          stock: 10,
          reserved: 2,
          isActive: true,
        },
        {
          title: 'Arquitectura de Datos',
          author: 'Martin Kleppmann',
          category: 'Bases de Datos',
          description: 'Diseño de aplicaciones intensivas en datos.',
          price: 3999, // $39.99 en centavos
          coverUrl: 'https://example.com/cover2.jpg',
          stock: 5,
          reserved: 5, // Stock disponible = 0
          isActive: true,
        },
        {
          title: 'Libro Desactivado',
          author: 'Autor Oculto',
          category: 'Otros',
          description: 'Este libro no debería verse públicamente.',
          price: 1000,
          coverUrl: 'https://example.com/cover3.jpg',
          stock: 10,
          reserved: 0,
          isActive: false, // Inactivo
        },
      ]);
    });

    it('debe listar libros activos con cálculo de disponibilidad y precio en centavos', async () => {
      const res = await request(app).get('/api/books');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.books.length).toBe(2); // Excluye inactivos
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.categories).toContain('Programación');
      expect(res.body.data.categories).toContain('Bases de Datos');

      const tsBook = res.body.data.books.find((b: any) => b.title === 'Aprende TypeScript');
      expect(tsBook.price).toBe(2500); // En centavos
      expect(tsBook.availableStock).toBe(8); // 10 - 2
      expect(tsBook.isAvailable).toBe(true);
    });

    it('debe filtrar por categoría correctamente', async () => {
      const res = await request(app).get('/api/books?category=Programación');

      expect(res.status).toBe(200);
      expect(res.body.data.books.length).toBe(1);
      expect(res.body.data.books[0].title).toBe('Aprende TypeScript');
    });

    it('debe buscar por título o autor (case-insensitive)', async () => {
      const res = await request(app).get('/api/books?search=kleppmann');

      expect(res.status).toBe(200);
      expect(res.body.data.books.length).toBe(1);
      expect(res.body.data.books[0].author).toBe('Martin Kleppmann');
    });

    it('debe filtrar solo libros disponibles con stock cuando availableOnly=true', async () => {
      const res = await request(app).get('/api/books?availableOnly=true');

      expect(res.status).toBe(200);
      expect(res.body.data.books.length).toBe(1);
      expect(res.body.data.books[0].title).toBe('Aprende TypeScript');
    });

    it('debe obtener el detalle de un libro existente por ID', async () => {
      const existing = await Book.findOne({ title: 'Aprende TypeScript' });
      const res = await request(app).get(`/api/books/${existing!.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.book.title).toBe('Aprende TypeScript');
      expect(res.body.data.book.price).toBe(2500);
    });

    it('debe retornar 404 al consultar un libro inactivo o inexistente', async () => {
      const inactive = await Book.findOne({ title: 'Libro Desactivado' });
      const res = await request(app).get(`/api/books/${inactive!.id}`);

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('no encontrado');
    });
  });

  describe('Gestión Administrativa de Libros (CRUD y RBAC)', () => {
    it('ADMIN: debe crear un libro exitosamente con validación de enteros en centavos (201 Created)', async () => {
      const res = await request(app)
        .post('/api/books')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Clean Code en Node.js',
          author: 'Uncle Bob',
          category: 'Programación',
          description: 'Buenas prácticas para el backend moderno.',
          price: 2999, // $29.99 en centavos
          coverUrl: 'https://example.com/cleancode.jpg',
          stock: 15,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.book).toHaveProperty('id');
      expect(res.body.data.book.price).toBe(2999);
      expect(res.body.data.book.stock).toBe(15);
      expect(res.body.data.book.reserved).toBe(0);
      expect(res.body.data.book.availableStock).toBe(15);
    });

    it('CRITERIO CRÍTICO: CLIENTE intentando crear libro debe recibir 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/books')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          title: 'Libro No Autorizado',
          author: 'Hacker',
          category: 'Test',
          description: 'Intento de creación sin rol admin.',
          price: 1000,
          coverUrl: 'https://example.com/test.jpg',
          stock: 10,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('permisos insuficientes');
    });

    it('debe rechazar creación sin token con 401 Unauthorized', async () => {
      const res = await request(app).post('/api/books').send({
        title: 'Libro Anónimo',
        author: 'Anon',
        category: 'Test',
        description: 'Petición sin autenticación.',
        price: 1000,
        coverUrl: 'https://example.com/test.jpg',
        stock: 5,
      });

      expect(res.status).toBe(401);
    });

    it('debe validar con Zod que el precio sea positivo y el stock no negativo (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/books')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Libro con Datos Inválidos',
          author: 'Tester',
          category: 'QA',
          description: 'Probando validaciones numéricas.',
          price: -500, // Precio negativo
          coverUrl: 'https://example.com/test.jpg',
          stock: -1, // Stock negativo
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('validación');
    });

    it('ADMIN: debe actualizar un libro existente (PUT /api/books/:id)', async () => {
      const book = await Book.create({
        title: 'Libro Original',
        author: 'Autor Original',
        category: 'Original',
        description: 'Descripción original.',
        price: 1500,
        coverUrl: 'https://example.com/orig.jpg',
        stock: 10,
      });

      const res = await request(app)
        .put(`/api/books/${book.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Libro Actualizado',
          price: 1800,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.book.title).toBe('Libro Actualizado');
      expect(res.body.data.book.price).toBe(1800);
    });

    it('ADMIN: debe ajustar el stock de un libro (PATCH /api/books/:id/stock)', async () => {
      const book = await Book.create({
        title: 'Libro Stock',
        author: 'Autor',
        category: 'Test',
        description: 'Test stock adjustment.',
        price: 2000,
        coverUrl: 'https://example.com/stock.jpg',
        stock: 10,
      });

      const res = await request(app)
        .patch(`/api/books/${book.id}/stock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stock: 25 });

      expect(res.status).toBe(200);
      expect(res.body.data.book.stock).toBe(25);
    });

    it('ADMIN: debe realizar borrado suave (DELETE /api/books/:id)', async () => {
      const book = await Book.create({
        title: 'Libro a Eliminar',
        author: 'Autor',
        category: 'Test',
        description: 'Test soft delete.',
        price: 2000,
        coverUrl: 'https://example.com/delete.jpg',
        stock: 10,
        isActive: true,
      });

      const res = await request(app)
        .delete(`/api/books/${book.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      // Verificar que el libro quedó marcado como isActive: false en la base de datos
      const updatedInDb = await Book.findById(book.id);
      expect(updatedInDb!.isActive).toBe(false);

      // Verificar que ya no aparece en el listado público
      const publicRes = await request(app).get('/api/books');
      const found = publicRes.body.data.books.find((b: any) => b.id === book.id);
      expect(found).toBeUndefined();
    });
  });
});
