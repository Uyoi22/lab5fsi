'use client';

import React from 'react';
import { Book, formatPrice } from '../lib/api';
import { ShoppingCart, CheckCircle2, AlertCircle } from 'lucide-react';

interface BookCardProps {
  book: Book;
  onAddToCart?: (book: Book) => void;
}

export const BookCard: React.FC<BookCardProps> = ({ book, onAddToCart }) => {
  const isAvailable = book.isAvailable && book.availableStock > 0;

  return (
    <div className="group flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden hover:-translate-y-1">
      {/* Portada */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        <img
          src={book.coverUrl}
          alt={book.title}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute top-3 left-3">
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-900/80 text-white backdrop-blur-md">
            {book.category}
          </span>
        </div>
        <div className="absolute top-3 right-3">
          {isAvailable ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-500/90 text-white backdrop-blur-md">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {book.availableStock} disponibles
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-rose-500/90 text-white backdrop-blur-md">
              <AlertCircle className="w-3.5 h-3.5" />
              Agotado
            </span>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div className="flex flex-col flex-1 p-5">
        <div className="mb-2">
          <h3 className="font-bold text-lg text-slate-900 leading-snug line-clamp-1 group-hover:text-emerald-600 transition">
            {book.title}
          </h3>
          <p className="text-sm text-slate-500 font-medium">{book.author}</p>
        </div>

        <p className="text-sm text-slate-600 line-clamp-2 mb-4 flex-1">
          {book.description}
        </p>

        {/* Precio y Botón */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-auto">
          <div>
            <span className="text-xs text-slate-400 font-medium block">Precio</span>
            <span className="text-xl font-extrabold text-slate-900">
              {formatPrice(book.price)}
            </span>
          </div>

          <button
            onClick={() => onAddToCart && onAddToCart(book)}
            disabled={!isAvailable}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm ${
              isAvailable
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-emerald-200 active:scale-95'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>{isAvailable ? 'Añadir' : 'Sin stock'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
