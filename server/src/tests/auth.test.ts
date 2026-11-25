import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { Application } from 'express';
import { User } from '../models/user.model';
import { createAuthRateLimiter } from '../middleware/rateLimiter';
import { runSeed } from '../scripts/seed';

describe('Entrega 2: Autenticación, Control de Accesos (RBAC), Rate Limit y Seed', () => {
  let app: Application;
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    app = createApp();
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('Registro público (POST /api/auth/register)', () => {
    it('debe registrar un nuevo cliente con contraseña hasheada', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Usuario Prueba',
          email: 'prueba@ejemplo.com',
          password: 'PasswordSegura123!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user).toHaveProperty('id');
      expect(res.body.data.user.email).toBe('prueba@ejemplo.com');
      expect(res.body.data.user.role).toBe('cliente');
      expect(res.body.data.user).not.toHaveProperty('password');

      // Verificar en la BD que la contraseña esté hasheada y no en texto plano
      const dbUser = await User.findOne({ email: 'prueba@ejemplo.com' });
      expect(dbUser).not.toBeNull();
      expect(dbUser!.password).not.toBe('PasswordSegura123!');
      expect(await dbUser!.comparePassword('PasswordSegura123!')).toBe(true);
    });

    it('REGLA DE SEGURIDAD: debe forzar rol "cliente" aunque el payload especifique "admin"', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Hacker Intento Admin',
          email: 'hacker@ejemplo.com',
          password: 'PasswordSegura123!',
          role: 'admin', // Intento de escalamiento de privilegios
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('cliente');

      const dbUser = await User.findOne({ email: 'hacker@ejemplo.com' });
      expect(dbUser!.role).toBe('cliente');
    });

    it('debe rechazar registro con correo duplicado (409 Conflict)', async () => {
      await User.create({
        name: 'Primer Usuario',
        email: 'duplicado@ejemplo.com',
        password: 'Password123!',
        role: 'cliente',
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Segundo Usuario',
          email: 'duplicado@ejemplo.com',
          password: 'Password456!',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('ya se encuentra registrado');
    });

    it('debe validar datos requeridos y formato con Zod (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'A', // Muy corto (<2)
          email: 'correo-invalido',
          password: '123', // Muy corta (<6)
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('validación');
    });
  });

  describe('Login (POST /api/auth/login)', () => {
    beforeEach(async () => {
      const user = new User({
        name: 'Cliente Existente',
        email: 'existente@ejemplo.com',
        password: 'Password123!',
        role: 'cliente',
      });
      await user.save();
    });

    it('debe iniciar sesión exitosamente con credenciales válidas y devolver JWT', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'existente@ejemplo.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user.email).toBe('existente@ejemplo.com');
    });

    it('debe rechazar inicio de sesión con contraseña errónea (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'existente@ejemplo.com',
          password: 'ContrasenaIncorrecta!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('inválidas');
    });

    it('debe rechazar inicio de sesión con usuario no registrado (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'noexiste@ejemplo.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('inválidas');
    });
  });

  describe('Autorización por Rol (RBAC) y Rutas Protegidas', () => {
    let clientToken: string;
    let adminToken: string;

    beforeEach(async () => {
      const client = new User({
        name: 'Juan Cliente',
        email: 'cliente.rbac@ejemplo.com',
        password: 'Password123!',
        role: 'cliente',
      });
      await client.save();

      const admin = new User({
        name: 'Super Admin',
        email: 'admin.rbac@ejemplo.com',
        password: 'Password123!',
        role: 'admin',
      });
      await admin.save();

      const clientLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'cliente.rbac@ejemplo.com', password: 'Password123!' });
      clientToken = clientLogin.body.data.token;

      const adminLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin.rbac@ejemplo.com', password: 'Password123!' });
      adminToken = adminLogin.body.data.token;
    });

    it('debe rechazar petición sin header Authorization con 401', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('no proporcionado');
    });

    it('debe rechazar petición con token malformado o inválido con 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer token_invalido_123');

      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('inválido');
    });

    it('debe permitir acceso a /api/auth/me con token válido de cliente', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('cliente.rbac@ejemplo.com');
      expect(res.body.data.user.role).toBe('cliente');
    });

    it('CRITERIO CRÍTICO: debe rechazar acceso a ruta admin para un usuario con rol "cliente" con 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.statusCode).toBe(403);
      expect(res.body.error.message).toContain('permisos insuficientes');
    });

    it('debe conceder acceso a ruta admin para un usuario con rol "admin" con 200 OK', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.adminUser.role).toBe('admin');
    });
  });

  describe('Rate Limiter en autenticación', () => {
    it('debe bloquear con 429 Too Many Requests tras superar el límite establecido', async () => {
      const testApp = express();
      testApp.use(createAuthRateLimiter({ max: 2, windowMs: 60000 }));
      testApp.post('/test-limit', (_req, res) => res.json({ ok: true }));

      await request(testApp).post('/test-limit').expect(200);
      await request(testApp).post('/test-limit').expect(200);
      const res = await request(testApp).post('/test-limit');

      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
      expect(res.body.error.statusCode).toBe(429);
      expect(res.body.error.message).toContain('Demasiadas solicitudes');
    });
  });

  describe('Script de Seed Idempotente', () => {
    it('debe ejecutar el seed de forma idempotente creando admin y demo client', async () => {
      // Primera ejecución (sin desconectar la BD de pruebas)
      await runSeed(false);

      const adminUser = await User.findOne({ email: 'admin@ebookstore.com' });
      expect(adminUser).not.toBeNull();
      expect(adminUser!.role).toBe('admin');

      const demoUser = await User.findOne({ email: 'cliente@ebookstore.com' });
      expect(demoUser).not.toBeNull();
      expect(demoUser!.role).toBe('cliente');

      // Segunda ejecución: debe actualizar sin fallar por duplicados
      await expect(runSeed(false)).resolves.not.toThrow();

      const totalUsers = await User.countDocuments();
      expect(totalUsers).toBe(2);
    });
  });
});
