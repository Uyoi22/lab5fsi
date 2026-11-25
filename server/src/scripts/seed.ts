import { connectDB, disconnectDB } from '../config/db';
import { User } from '../models/user.model';
import { Book } from '../models/book.model';
import { config } from '../config/env';

export const INITIAL_BOOKS = [
  {
    title: 'Clean Code en TypeScript',
    author: 'Robert C. Martin & DevTeam',
    category: 'Programación',
    description: 'Guía práctica para escribir código legible, mantenible y robusto utilizando TypeScript y buenas prácticas modernas.',
    price: 2499, // $24.99
    coverUrl: 'https://images.unsplash.com/photo-1516116211227-bbc042ec97bb?w=500&auto=format&fit=crop&q=60',
    stock: 25,
    reserved: 0,
    isActive: true,
  },
  {
    title: 'Arquitectura de Software Moderna',
    author: 'Martin Fowler',
    category: 'Programación',
    description: 'Patrones fundamentales de diseño, microservicios, eventos distribuidos y diseño guiado por el dominio (DDD).',
    price: 3450, // $34.50
    coverUrl: 'https://images.unsplash.com/photo-1532012164546-f432f2e3edd3?w=500&auto=format&fit=crop&q=60',
    stock: 18,
    reserved: 0,
    isActive: true,
  },
  {
    title: 'Next.js 14 y React Full-Stack',
    author: 'Guillermo Rauch',
    category: 'Programación',
    description: 'Domina Server Components, Server Actions, App Router y streaming con el framework más popular de React.',
    price: 1999, // $19.99
    coverUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=500&auto=format&fit=crop&q=60',
    stock: 30,
    reserved: 0,
    isActive: true,
  },
  {
    title: 'El Universo Cuántico',
    author: 'Brian Cox & Jeff Forshaw',
    category: 'Ciencia',
    description: 'Un fascinante viaje hacia los principios fundamentales de la mecánica cuántica y la naturaleza del cosmos.',
    price: 1500, // $15.00
    coverUrl: 'https://images.unsplash.com/photo-1507499739999-097706ad8914?w=500&auto=format&fit=crop&q=60',
    stock: 15,
    reserved: 0,
    isActive: true,
  },
  {
    title: 'Inteligencia Artificial Práctica',
    author: 'Stuart Russell',
    category: 'Ciencia',
    description: 'Desde redes neuronales profundas hasta modelos generativos y agentes autónomos explicados con claridad.',
    price: 2999, // $29.99
    coverUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60',
    stock: 20,
    reserved: 0,
    isActive: true,
  },
  {
    title: 'Finanzas para Emprendedores Digitales',
    author: 'Morgan Housel',
    category: 'Negocios',
    description: 'Aprende a gestionar ingresos, flujos de caja e inversión inteligente en la economía tecnológica moderna.',
    price: 1499, // $14.99
    coverUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=500&auto=format&fit=crop&q=60',
    stock: 40,
    reserved: 0,
    isActive: true,
  },
  {
    title: 'Diseño UX/UI para Aplicaciones Modernas',
    author: 'Don Norman',
    category: 'Diseño',
    description: 'Principios psicológicos del diseño centrado en el usuario, jerarquía visual y accesibilidad en productos web.',
    price: 2150, // $21.50
    coverUrl: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=500&auto=format&fit=crop&q=60',
    stock: 12,
    reserved: 0,
    isActive: true,
  },
  {
    title: 'Crónicas del Futuro Digital',
    author: 'Isaac Asimov',
    category: 'Ficción',
    description: 'Una emocionante saga de anticipación sobre el surgimiento de inteligencias artificiales y la colonización estelar.',
    price: 999, // $9.99
    coverUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop&q=60',
    stock: 50,
    reserved: 0,
    isActive: true,
  },
];

export const runSeed = async (disconnectWhenDone = true): Promise<void> => {
  console.log('🌱 Iniciando proceso de seed en la base de datos...');
  await connectDB();

  try {
    // 1. Crear o actualizar Administrador
    const adminEmail = 'admin@ebookstore.com';
    let admin = await User.findOne({ email: adminEmail });

    if (!admin) {
      admin = new User({
        name: 'Administrador EbookStore',
        email: adminEmail,
        password: config.adminPassword,
        role: 'admin',
      });
      await admin.save();
      console.log(`✅ Usuario Administrador creado exitosamente: ${adminEmail}`);
    } else {
      admin.name = 'Administrador EbookStore';
      admin.password = config.adminPassword;
      admin.role = 'admin';
      await admin.save();
      console.log(`🔄 Usuario Administrador actualizado exitosamente: ${adminEmail}`);
    }

    // 2. Crear o actualizar Cliente de Demostración
    const demoEmail = 'cliente@ebookstore.com';
    let demoClient = await User.findOne({ email: demoEmail });

    if (!demoClient) {
      demoClient = new User({
        name: 'Carlos Demo Cliente',
        email: demoEmail,
        password: config.demoPassword,
        role: 'cliente',
      });
      await demoClient.save();
      console.log(`✅ Cliente de Demostración creado exitosamente: ${demoEmail}`);
    } else {
      demoClient.name = 'Carlos Demo Cliente';
      demoClient.password = config.demoPassword;
      demoClient.role = 'cliente';
      await demoClient.save();
      console.log(`🔄 Cliente de Demostración actualizado exitosamente: ${demoEmail}`);
    }

    // 3. Crear o actualizar Catálogo Inicial de Libros
    console.log('📚 Cargando catálogo inicial de libros electrónicos...');
    for (const bookData of INITIAL_BOOKS) {
      await Book.findOneAndUpdate(
        { title: bookData.title },
        { $set: bookData },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    console.log(`✅ ${INITIAL_BOOKS.length} libros procesados en el catálogo.`);

    console.log('✨ Seed completado con éxito.');
  } catch (error) {
    console.error('❌ Error durante la ejecución del seed:', error);
    throw error;
  } finally {
    if (disconnectWhenDone) {
      await disconnectDB();
    }
  }
};

if (require.main === module) {
  runSeed(true)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
