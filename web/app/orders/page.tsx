'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  RefreshCw,
  ArrowLeft,
  Wifi,
  WifiOff,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import { fetchMyOrders, formatPrice } from '../../lib/api';
import type { Order } from '../../lib/api';

// ── Helpers de estado ──────────────────────────────────────────────────────────

const statusConfig: Record<
  string,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  pendiente_pago: { label: 'Pendiente de Pago', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
  procesando_pago: { label: 'Procesando Pago', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: RefreshCw },
  pagado: { label: 'Pagado', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  cancelado: { label: 'Cancelado', color: 'bg-rose-100 text-rose-800 border-rose-200', icon: XCircle },
};

const shippingConfig: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente de Preparación', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  en_preparacion: { label: 'En Preparación', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  listo: { label: 'Listo para Envío', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  entregado: { label: 'Entregado', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? { label: status, color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Package };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function ShippingBadge({ status }: { status: string }) {
  const cfg = shippingConfig[status] ?? { label: status, color: 'bg-slate-100 text-slate-600 border-slate-200' };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Truck className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function OrdersPage() {
  const { user, token, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedIds, setUpdatedIds] = useState<Set<string>>(new Set());

  // Socket.IO para actualizaciones en tiempo real
  const { isConnected, lastOrderUpdate, clearLastUpdate } = useSocket(token);

  // Cargar pedidos desde el backend
  const loadOrders = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyOrders(token);
      setOrders(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Redirigir si no autenticado
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Cargar pedidos al montar
  useEffect(() => {
    if (isAuthenticated && token) {
      loadOrders();
    }
  }, [isAuthenticated, token, loadOrders]);

  // Reaccionar a actualizaciones en tiempo real via Socket.IO
  useEffect(() => {
    if (!lastOrderUpdate) return;

    // Resaltar el pedido que fue actualizado
    setUpdatedIds((prev) => new Set(Array.from(prev).concat(lastOrderUpdate.orderId)));
    setTimeout(() => {
      setUpdatedIds((prev) => {
        const next = new Set(Array.from(prev));
        next.delete(lastOrderUpdate.orderId);
        return next;
      });
    }, 3000);

    // Actualizar estado del pedido en la lista local (sin refetch)
    setOrders((prev) =>
      prev.map((o) =>
        o.id === lastOrderUpdate.orderId
          ? {
              ...o,
              status: lastOrderUpdate.status as Order['status'],
              shippingStatus: lastOrderUpdate.shippingStatus as Order['shippingStatus'],
              updatedAt: lastOrderUpdate.updatedAt,
            }
          : o
      )
    );

    clearLastUpdate();
  }, [lastOrderUpdate, clearLastUpdate]);

  // Estados de carga / auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header de la página */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-base font-bold text-slate-900">Mis Pedidos</h1>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Indicador WebSocket */}
            <span
              className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${
                isConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}
            >
              {isConnected ? (
                <><Wifi className="w-3 h-3" /> Tiempo real</>
              ) : (
                <><WifiOff className="w-3 h-3" /> Sin conexión</>
              )}
            </span>

            <button
              onClick={loadOrders}
              disabled={loading}
              className="p-2 text-slate-500 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition disabled:opacity-50"
              title="Recargar pedidos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Estado de carga */}
        {loading && orders.length === 0 ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
                <div className="h-3 bg-slate-100 rounded w-1/2 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          /* Estado vacío */
          <div className="py-20 text-center">
            <div className="inline-flex p-4 bg-slate-100 rounded-2xl mb-4">
              <Package className="w-10 h-10 text-slate-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">Aún no tienes pedidos</h2>
            <p className="text-sm text-slate-500 mb-6">Explora nuestro catálogo y realiza tu primera compra.</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition shadow-md shadow-emerald-200"
            >
              Ver catálogo
            </Link>
          </div>
        ) : (
          /* Lista de pedidos */
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className={`bg-white rounded-2xl border p-5 transition-all duration-500 ${
                  updatedIds.has(order.id)
                    ? 'border-emerald-400 ring-2 ring-emerald-200 shadow-lg shadow-emerald-50'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                }`}
              >
                {/* Cabecera de la tarjeta */}
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="text-xs text-slate-400 font-mono">
                      Pedido <span className="text-slate-600 font-bold">#{order.id.slice(-8).toUpperCase()}</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDate(order.createdAt)}</p>
                  </div>

                  {updatedIds.has(order.id) && (
                    <span className="text-[10px] px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200 font-semibold animate-pulse">
                      ✦ Actualizado en tiempo real
                    </span>
                  )}
                </div>

                {/* Badges de estado */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <StatusBadge status={order.status} />
                  {order.status === 'pagado' && <ShippingBadge status={order.shippingStatus} />}
                </div>

                {/* Libros del pedido */}
                <div className="space-y-2 mb-4">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">
                        <span className="font-medium">{item.title}</span>
                        {item.quantity > 1 && (
                          <span className="text-slate-400 ml-1">× {item.quantity}</span>
                        )}
                      </span>
                      <span className="text-slate-500 text-xs">{formatPrice(item.subtotal)}</span>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-slate-400">
                    Entrega a: <span className="text-slate-600 font-medium">{order.deliveryEmail}</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    Total: <span className="text-emerald-700">{formatPrice(order.totalAmount)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
