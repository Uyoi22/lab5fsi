import http from 'http';
import { createApp } from './app';
import { initSocketIO } from './socket';
import { config } from './config/env';
import { connectDB, disconnectDB } from './config/db';
import { startReservationCleanupJob, stopReservationCleanupJob } from './services/expiration.service';

const startServer = async () => {
  const app = createApp();
  const server = http.createServer(app);

  // Inicializar Socket.IO en el mismo servidor HTTP
  const io = initSocketIO(server);

  // Intentar conectar a MongoDB Atlas
  try {
    await connectDB();
  } catch (error) {
    console.error('⚠️ Iniciando servidor con conexión de base de datos pendiente.');
  }

  // Iniciar job periódico de limpieza de reservas expiradas (30 min)
  startReservationCleanupJob(60000);

  server.listen(config.port, config.host, () => {
    console.log(`🚀 Servidor EbookStore corriendo en http://${config.host}:${config.port}`);
    console.log(`🌐 CORS configurado para: ${config.webOrigin}`);
    console.log(`🩺 Health check disponible en http://${config.host}:${config.port}/health`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Señal ${signal} recibida. Cerrando servidor ordenadamente...`);
    stopReservationCleanupJob();
    io.close(() => {
      console.log('🔌 Socket.IO cerrado');
    });

    server.close(async () => {
      console.log('🚪 Servidor HTTP cerrado');
      await disconnectDB();
      process.exit(0);
    });

    // Forzar cierre si no termina en 10s
    setTimeout(() => {
      console.error('⚠️ Forzando cierre tras timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

// Iniciar solo si se ejecuta directamente
if (require.main === module) {
  startServer().catch((err) => {
    console.error('❌ Error fatal al iniciar el servidor:', err);
    process.exit(1);
  });
}

export { startServer };
