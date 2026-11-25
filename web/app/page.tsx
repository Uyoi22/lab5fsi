'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Navbar } from '../components/Navbar';
import { BookCard } from '../components/BookCard';
import { Book, formatPrice } from '../lib/api';
import { useCart } from '../context/CartContext';
import { Search, SlidersHorizontal, BookOpen, Sparkles, AlertCircle } from 'lucide-react';

const FALLBACK_BOOKS: Book[] = [
  {
    id: '1',
    title: 'Clean Code en TypeScript',
    author: 'Robert C. Martin & DevTeam',
    category: 'Programación',
    description: 'Guía práctica para escribir código legible, mantenible y robusto utilizando TypeScript y buenas prácticas modernas.',
    price: 2499,
    coverUrl: 'https://images.unsplash.com/photo-1516116211227-bbc042ec97bb?w=500&auto=format&fit=crop&q=60',
    stock: 25,
    reserved: 0,
    availableStock: 25,
    isAvailable: true,
    isActive: true,
  },
  {
    id: '2',
    title: 'Arquitectura de Software Moderna',
    author: 'Martin Fowler',
    category: 'Programación',
    description: 'Patrones fundamentales de diseño, microservicios, eventos distribuidos y diseño guiado por el dominio (DDD).',
    price: 3450,
    coverUrl: 'https://images.unsplash.com/photo-1532012164546-f432f2e3edd3?w=500&auto=format&fit=crop&q=60',
    stock: 18,
    reserved: 0,
    availableStock: 18,
    isAvailable: true,
    isActive: true,
  },
  {
    id: '3',
    title: 'Next.js 14 y React Full-Stack',
    author: 'Guillermo Rauch',
    category: 'Programación',
    description: 'Domina Server Components, Server Actions, App Router y streaming con el framework más popular de React.',
    price: 1999,
    coverUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=500&auto=format&fit=crop&q=60',
    stock: 30,
    reserved: 0,
    availableStock: 30,
    isAvailable: true,
    isActive: true,
  },
  {
    id: '4',
    title: 'El Universo Cuántico',
    author: 'Brian Cox & Jeff Forshaw',
    category: 'Ciencia',
    description: 'Un fascinante viaje hacia los principios fundamentales de la mecánica cuántica y la naturaleza del cosmos.',
    price: 1500,
    coverUrl: 'https://images.unsplash.com/photo-1507499739999-097706ad8914?w=500&auto=format&fit=crop&q=60',
    stock: 15,
    reserved: 0,
    availableStock: 15,
    isAvailable: true,
    isActive: true,
  },
  {
    id: '5',
    title: 'Inteligencia Artificial Práctica',
    author: 'Stuart Russell',
    category: 'Ciencia',
    description: 'Desde redes neuronales profundas hasta modelos generativos y agentes autónomos explicados con claridad.',
    price: 2999,
    coverUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60',
    stock: 20,
    reserved: 0,
    availableStock: 20,
    isAvailable: true,
    isActive: true,
  },
  {
    id: '6',
    title: 'Finanzas para Emprendedores Digitales',
    author: 'Morgan Housel',
    category: 'Negocios',
    description: 'Aprende a gestionar ingresos, flujos de caja e inversión inteligente en la economía tecnológica moderna.',
    price: 1499,
    coverUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=500&auto=format&fit=crop&q=60',
    stock: 40,
    reserved: 0,
    availableStock: 40,
    isAvailable: true,
    isActive: true,
  },
  {
    id: '7',
    title: 'Diseño UX/UI para Aplicaciones Modernas',
    author: 'Don Norman',
    category: 'Diseño',
    description: 'Principios psicológicos del diseño centrado en el usuario, jerarquía visual y accesibilidad en productos web.',
    price: 2150,
    coverUrl: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=500&auto=format&fit=crop&q=60',
    stock: 12,
    reserved: 0,
    availableStock: 12,
    isAvailable: true,
    isActive: true,
  },
  {
    id: '8',
    title: 'Crónicas del Futuro Digital',
    author: 'Isaac Asimov',
    category: 'Ficción',
    description: 'Una emocionante saga de anticipación sobre el surgimiento de inteligencias artificiales y la colonización estelar.',
    price: 999,
    coverUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop&q=60',
    stock: 0, // Probando agotado
    reserved: 0,
    availableStock: 0,
    isAvailable: false,
    isActive: true,
  },
];

export default function CatalogPage() {
  const { addToCart } = useCart();
  const [books, setBooks] = useState<Book[]>(FALLBACK_BOOKS);
  const [categories, setCategories] = useState<string[]>([
    'Todos',
    'Programación',
    'Ciencia',
    'Negocios',
    'Diseño',
    'Ficción',
  ]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyAvailable, setOnlyAvailable] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Intentar cargar libros del backend de forma reactiva
  useEffect(() => {
    const loadBooks = async () => {
      try {
        setLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const res = await fetch(`${apiUrl}/api/books`);
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.books && json.data.books.length > 0) {
            setBooks(json.data.books);
            if (json.data.categories && json.data.categories.length > 0) {
              setCategories(['Todos', ...json.data.categories]);
            }
          }
        }
      } catch (err) {
        // En caso de estar sin conexión con el backend en este momento, se mantiene el catálogo local
        console.log('Usando catálogo inicial precargado');
      } finally {
        setLoading(false);
      }
    };

    loadBooks();
  }, []);

  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      const matchesCategory =
        selectedCategory === 'Todos' ||
        book.category.toLowerCase() === selectedCategory.toLowerCase();

      const matchesSearch =
        searchQuery.trim() === '' ||
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesAvailability = !onlyAvailable || (book.isAvailable && book.availableStock > 0);

      return matchesCategory && matchesSearch && matchesAvailability;
    });
  }, [books, selectedCategory, searchQuery, onlyAvailable]);

  const handleAddToCart = (book: Book) => {
    addToCart(book);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <Navbar />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-4 border border-emerald-500/30">
            <Sparkles className="w-4 h-4" />
            Librería Digital Instantánea — Entrega 3 Lista
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight max-w-3xl leading-tight">
            Descubre los mejores libros electrónicos para impulsar tu conocimiento
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-300 max-w-2xl">
            Catálogo completo con disponibilidad y precios garantizados. Pagos seguros y protegidos por PayPal.
          </p>

          {/* Barra de Búsqueda Principal */}
          <div className="w-full max-w-2xl mt-8 relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              placeholder="Buscar por título, autor o contenido..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white/15 transition text-sm sm:text-base shadow-xl"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-xs text-slate-400 hover:text-white"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Barra de Filtros */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          {/* Categorías */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Toggle Solo Disponibles */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-700 cursor-pointer select-none bg-white px-3 py-2 rounded-xl border border-slate-200/80">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(e) => setOnlyAvailable(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300"
              />
              <span>Solo disponibles en stock</span>
            </label>
          </div>
        </div>

        {/* Resumen de resultados */}
        <div className="py-4 flex items-center justify-between text-xs text-slate-500">
          <span>Mostrando {filteredBooks.length} libros</span>
          {selectedCategory !== 'Todos' && (
            <span className="font-medium text-emerald-700">Categoría: {selectedCategory}</span>
          )}
        </div>

        {/* Grid de Libros */}
        {filteredBooks.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-16">
            {filteredBooks.map((book) => (
              <BookCard key={book.id} book={book} onAddToCart={handleAddToCart} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-dashed border-slate-300 my-8">
            <AlertCircle className="w-12 h-12 text-slate-400 mb-3" />
            <h3 className="text-lg font-bold text-slate-800">No se encontraron libros</h3>
            <p className="text-sm text-slate-500 max-w-sm mt-1">
              Prueba cambiando los términos de búsqueda o seleccionando otra categoría.
            </p>
            <button
              onClick={() => {
                setSelectedCategory('Todos');
                setSearchQuery('');
                setOnlyAvailable(false);
              }}
              className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition"
            >
              Restablecer filtros
            </button>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500">
        <p>© 2026 EbookStore — Tu librería digital de comercio electrónico.</p>
      </footer>
    </div>
  );
}
