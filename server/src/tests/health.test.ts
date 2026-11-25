import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { Application } from 'express';
import { disconnectDB } from '../config/db';
import { config } from '../config/env';

describe('Entrega 1: Fundaciones, Arquitectura Base y Salud del Sistema', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('Endpoint GET /health', () => {
    it('debe responder 200 OK con la estructura de salud completa', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('database');
      expect(res.body.database).toHaveProperty('status');
      expect(res.body.database).toHaveProperty('readyState');
      expect(res.body).toHaveProperty('system');
      expect(res.body.system).toHaveProperty('nodeVersion');
      expect(res.body.system).toHaveProperty('memory');
    });

    it('debe incluir cabeceras de seguridad inyectadas por Helmet', async () => {
      const res = await request(app).get('/health');

      expect(res.headers).toHaveProperty('x-dns-prefetch-control');
      expect(res.headers).toHaveProperty('x-frame-options');
      expect(res.headers).toHaveProperty('x-content-type-options', 'nosniff');
    });
  });

  describe('Middleware de CORS limitado', () => {
    it('debe permitir peticiones desde el WEB_ORIGIN configurado', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', config.webOrigin);

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe(config.webOrigin);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('debe bloquear peticiones desde orígenes no autorizados con 403', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://sitio-malicioso.com');

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body.error).toHaveProperty('statusCode', 403);
      expect(res.body.error.message).toContain('CORS');
    });
  });

  describe('Manejo Centralizado de Errores y Rutas no Encontradas', () => {
    it('debe responder 404 estructurado ante rutas inexistentes', async () => {
      const res = await request(app).get('/api/ruta-inexistente-12345');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        success: false,
        error: {
          message: 'Ruta no encontrada: GET /api/ruta-inexistente-12345',
          statusCode: 404,
        },
      });
    });
  });
});
