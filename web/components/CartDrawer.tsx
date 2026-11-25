'use client';

import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../lib/api';
import { PayPalButton } from './PayPalButton';
import { X, Trash2, Plus, Minus, Clock, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

interface CreatedOrder {
  id: string;
  totalAmount: number;
  status: string;
  reservationExpiresAt: string;
  deliveryEmail: string;
  shippingAddress: string;
}

export const CartDrawer: React.FC = () => {
  const { items, removeFromCart, updateQuantity, clearCart, totalCents, isCartOpen, setIsCartOpen } = useCart();

  const [shippingAddress, setShippingAddress] = useState('');
  const [deliveryEmail, setDeliveryEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('30:00');

  // Cuenta regresiva de 30 minutos cuando se crea una orden
  useEffect(() => {
    if (!createdOrder?.reservationExpiresAt) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const expires = new Date(createdOrder.reservationExpiresAt).getTime();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeft('00:00 (Expirada)');
        clearInterval(interval);
      } else {
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [createdOrder]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

      // Obtener token guardado o usar fallback de demostración
      let token = typeof window !== 'undefined' ? localStorage.getItem('ebookstore_token') : null;

      if (!token) {
        // Iniciar sesión temporal con cliente demo para facilitar prueba fluida
        const loginRes = await fetch(`${apiUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'cliente@ebookstore.com',
            password: 'ClienteDemoPassword2026!',
          }),
        });

        if (loginRes.ok) {
          const loginData = await loginRes.json();
          token = loginData.data.token;
          if (token) localStorage.setItem('ebookstore_token', token);
        }
      }

      if (!token) {
        throw new Error('No se pudo autenticar. Inicia sesión para realizar pedidos.');
      }

      const res = await fetch(`${apiUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: items.map((i) => ({ bookId: i.book.id, quantity: i.quantity })),
          shippingAddress,
          deliveryEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Error al crear pedido');
      }

      setCreatedOrder(data.data.order);
      clearCart();
    } catch (err: any) {
      setError(err.message || 'Error inesperado durante la reserva');
    } finally {
      setLoading(false);
    }
  };

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Fondo oscuro */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={() => setIsCartOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              {createdOrder ? 'Resumen del Pedido' : 'Tu Carrito de Libros'}
            </h2>
            <button
              onClick={() => {
                setIsCartOpen(false);
                setCreatedOrder(null);
              }}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Contenido */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Vista de orden creada con contador de 30 minutos */}
            {createdOrder ? (
              <div className="space-y-5">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                  <h3 className="text-base font-bold text-emerald-900">
                    ¡Stock Reservado Exitosamente!
                  </h3>
                  <p className="text-xs text-emerald-700 mt-1">
                    Tu pedido <span className="font-mono font-bold">#{createdOrder.id.slice(-6)}</span> ha sido creado en estado <span className="font-semibold">{createdOrder.status}</span>.
                  </p>
                </div>

                {/* Cuenta Regresiva de Reserva (30 minutos) */}
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-800">
                    <Clock className="w-5 h-5 text-amber-600 animate-spin" />
                    <div>
                      <p className="text-xs font-semibold">Tiempo restante de reserva:</p>
                      <p className="text-xs text-amber-600">Liberación automática a los 30 min</p>
                    </div>
                  </div>
                  <span className="text-xl font-mono font-extrabold text-amber-900 bg-white px-3 py-1 rounded-xl border border-amber-200 shadow-sm">
                    {timeLeft}
                  </span>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Correo de entrega:</span>
                    <span className="font-medium text-slate-800">{createdOrder.deliveryEmail}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Dirección:</span>
                    <span className="font-medium text-slate-800">{createdOrder.shippingAddress}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-slate-900">
                    <span>Total a pagar:</span>
                    <span className="text-emerald-700">{formatPrice(createdOrder.totalAmount)}</span>
                  </div>
                </div>

                {/* Pasarela de Pagos PayPal Sandbox */}
                {createdOrder.status === 'pendiente_pago' ? (
                  <PayPalButton
                    orderId={createdOrder.id}
                    totalAmount={createdOrder.totalAmount}
                    onPaymentSuccess={(updated) => {
                      setCreatedOrder(updated);
                    }}
                  />
                ) : (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-1">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                    <h4 className="font-bold text-emerald-900 text-sm">Pedido Pagado</h4>
                    <p className="text-xs text-emerald-700">El pago ha sido confirmado y procesado con éxito.</p>
                  </div>
                )}

                <button
                  onClick={() => {
                    setCreatedOrder(null);
                    setIsCartOpen(false);
                  }}
                  className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition"
                >
                  Continuar explorando libros
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <p className="text-sm">Tu carrito está vacío.</p>
                <p className="text-xs mt-1">Agrega libros del catálogo para continuar.</p>
              </div>
            ) : (
              <>
                {/* Lista de libros en carrito */}
                <div className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.book.id}
                      className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-3"
                    >
                      <img
                        src={item.book.coverUrl}
                        alt={item.book.title}
                        className="w-14 h-14 object-cover rounded-lg shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 truncate">
                          {item.book.title}
                        </h4>
                        <p className="text-xs font-semibold text-emerald-600">
                          {formatPrice(item.book.price)}
                        </p>
                      </div>

                      {/* Controles de cantidad */}
                      <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1">
                        <button
                          onClick={() => updateQuantity(item.book.id, item.quantity - 1)}
                          className="p-1 text-slate-500 hover:text-slate-900 transition"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold px-1.5">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.book.id, item.quantity + 1)}
                          className="p-1 text-slate-500 hover:text-slate-900 transition"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.book.id)}
                        className="text-slate-400 hover:text-rose-500 transition p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Formulario de Checkout */}
                <form onSubmit={handleCheckout} className="pt-4 border-t border-slate-100 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Datos de Entrega
                  </h4>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Correo para recepción de ebooks
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="tucorreo@ejemplo.com"
                      value={deliveryEmail}
                      onChange={(e) => setDeliveryEmail(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Dirección de facturación / entrega
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Calle Principal 123, Ciudad"
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Total */}
                  <div className="pt-2 flex items-center justify-between text-sm font-bold text-slate-900">
                    <span>Total:</span>
                    <span className="text-lg text-emerald-600">{formatPrice(totalCents)}</span>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || items.length === 0}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-400 shadow-md shadow-emerald-200"
                  >
                    <span>{loading ? 'Reservando stock...' : 'Confirmar Pedido y Reservar Stock'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <p className="text-[10px] text-slate-400 text-center">
                    Se reservará el stock de forma atómica por 30 minutos para garantizar tu compra.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
