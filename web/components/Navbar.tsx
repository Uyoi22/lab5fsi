'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, ShoppingBag, ShieldCheck, LogIn, LogOut, Package, User } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export const Navbar: React.FC = () => {
  const { totalItems, setIsCartOpen } = useCart();
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 transition">
          <div className="p-2 bg-emerald-100 rounded-xl">
            <BookOpen className="w-6 h-6 text-emerald-700" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">
            Ebook<span className="text-emerald-600">Store</span>
          </span>
        </Link>

        {/* Enlaces y Acciones */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Panel Admin — solo para admins */}
          {isAuthenticated && user?.role === 'admin' && (
            <Link
              href="/admin"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              <ShieldCheck className="w-4 h-4 text-slate-600" />
              Panel Admin
            </Link>
          )}

          {isAuthenticated ? (
            <>
              {/* Mis Pedidos */}
              <Link
                href="/orders"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                <Package className="w-4 h-4 text-slate-600" />
                Mis Pedidos
              </Link>

              {/* Info del usuario + logout */}
              <div className="flex items-center gap-1.5">
                <span className="hidden sm:flex items-center gap-1 text-xs text-slate-500">
                  <User className="w-3.5 h-3.5" />
                  {user?.name?.split(' ')[0] ?? user?.email?.split('@')[0]}
                </span>
                <button
                  onClick={handleLogout}
                  className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            /* Iniciar sesión */
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-sm"
            >
              <LogIn className="w-4 h-4" />
              Ingresar
            </Link>
          )}

          {/* Carrito */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2 text-slate-700 hover:text-emerald-600 transition"
            aria-label="Abrir carrito"
          >
            <ShoppingBag className="w-6 h-6" />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center animate-scale-in">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
