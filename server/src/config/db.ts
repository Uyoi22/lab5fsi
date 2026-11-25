import mongoose from 'mongoose';
import { config } from './env';

const READY_STATES: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

export const getDBStatus = (): { status: string; readyState: number } => {
  const state = mongoose.connection.readyState;
  return {
    status: READY_STATES[state] || 'unknown',
    readyState: state,
  };
};

export const connectDB = async (): Promise<void> => {
  if (!config.mongoUri) {
    console.warn('⚠️ MONGODB_URI no definida. El servidor funcionará en modo desconectado para health/pruebas.');
    return;
  }

  if (mongoose.connection.readyState === 1) {
    return;
  }

  try {
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ Conexión establecida con MongoDB Atlas');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB Atlas:', error);
    throw error;
  }
};

export const disconnectDB = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('🔌 Conexión con MongoDB cerrada');
  }
};
