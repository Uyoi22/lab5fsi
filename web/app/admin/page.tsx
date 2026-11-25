'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
  Wifi,
  WifiOff,
  Truck,
  BookOpen,
  Package,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Search,
  SlidersHorizontal,
  Layers,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import {
  fetchAdminOrders,
  updateOrderShippingStatus,
  fetchBooks,
  updateBookStock,
  formatPrice,
  Order,
  Book,
} from '../../lib/api';

type Tab = 'kanban' | 'books';
type ShippingColumnKey = 'pendiente' | 'en_preparacion' | 'listo' | 'entregado';

interface ColumnConfig {
  key: ShippingColumnKey;
  title: string;
  subtitle: string;
  badgeColor: string;
  borderColor: string;
  headerBg: string;
  nextStatus: ShippingColumnKey | null;
  buttonLabel: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    key: 'pendiente',
    title: 'Pendiente',
    subtitle: 'Esperando procesamiento inicial',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    borderColor: 'border-amber-200',
    headerBg: 'bg-amber-50/80',
    nextStatus: 'en_preparacion',
    buttonLabel: 'Iniciar Preparación',
  },
  {
    key: 'en_preparacion',
    title: 'En Preparación',
    subtitle: 'Empaquetando / Generando accesos',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    borderColor: 'border-blue-200',
    headerBg: 'bg-blue-50/80',
    nextStatus: 'listo',
    buttonLabel: 'Marcar como Listo',
  },
  {
    key: 'listo',
    title: 'Listo para Envío',
    subtitle: 'Listo para despacho / entrega',
    badgeColor: 'bg-violet-100 text-violet-800 border-violet-200',
    borderColor: 'border-violet-200',
    headerBg: 'bg-violet-50/80',
    nextStatus: 'entregado',
    buttonLabel: 'Confirmar Entrega',
  },
  {
    key: 'entregado',
    title: 'Entregado',
    subtitle: 'Completado y recibido',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    borderColor: 'border-emerald-200',
    headerBg: 'bg-emerald-50/80',
    nextStatus: null,
    buttonLabel: 'Finalizado',
  },
];

export default function AdminPage() {
  const { user, token, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>('kanban');

  // Estados para pedidos y Kanban
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatedOrderIds, setUpdatedOrderIds] = useState<Set<string>>(new Set());

  // Estados para libros y stock
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [newStockValue, setNewStockValue] = useState<number>(0);
  const [stockUpdatingId, setStockUpdatingId] = useState<string | null>(null);
  const [bookMessage, setBookMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Conexión Socket.IO para eventos en la sala 'admin'
  const { isConnected, lastOrderUpdate, clearLastUpdate } = useSocket(token);

  // Carga inicial de pedidos
  const loadOrders = useCallback(async () => {
    if (!token) return;
    setLoadingOrders(true);
    setOrderError(null);
    try {
      const data = await fetchAdminOrders(token, { limit: 100 });
      setOrders(data.orders);
    } catch (err: unknown) {
      setOrderError(err instanceof Error ? err.message : 'Error al cargar pedidos para el panel');
    } finally {
      setLoadingOrders(false);
    }
  }, [token]);

  // Carga de catálogo de libros
  const loadBooks = useCallback(async () => {
    setLoadingBooks(true);
    try {
      const data = await fetchBooks();
      setBooks(data.books);
    } catch (err: unknown) {
      setBookMessage({ type: 'error', text: 'Error al consultar libros' });
    } finally {
      setLoadingBooks(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin' && token) {
      loadOrders();
      loadBooks();
    }
  }, [isAuthenticated, user, token, loadOrders, loadBooks]);

  // Escuchar eventos Socket.IO para actualizar el Kanban en tiempo real
  useEffect(() => {
    if (!lastOrderUpdate) return;

    setUpdatedOrderIds((prev) => new Set(Array.from(prev).concat(lastOrderUpdate.orderId)));
    setTimeout(() => {
      setUpdatedOrderIds((prev) => {
        const next = new Set(Array.from(prev));
        next.delete(lastOrderUpdate.orderId);
        return next;
      });
    }, 4000);

    setOrders((prev) => {
      const exists = prev.some((o) => o.id === lastOrderUpdate.orderId);
      if (exists) {
        return prev.map((o) =>
          o.id === lastOrderUpdate.orderId
            ? {
                ...o,
                status: lastOrderUpdate.status as Order['status'],
                shippingStatus: lastOrderUpdate.shippingStatus as Order['shippingStatus'],
                updatedAt: lastOrderUpdate.updatedAt,
              }
            : o
        );
      }
      return prev;
    });

    clearLastUpdate();
  }, [lastOrderUpdate, clearLastUpdate]);

  // Transición de estado de envío
  const handleAdvanceStatus = async (order: Order, nextStatus: ShippingColumnKey) => {
    if (!token) return;
    setActionLoadingId(order.id);
    setOrderError(null);

    try {
      const updated = await updateOrderShippingStatus(token, order.id, nextStatus);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (err: unknown) {
      setOrderError(err instanceof Error ? err.message : 'Error al actualizar estado de envío');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Guardar nuevo stock
  const handleSaveStock = async (bookId: string) => {
    if (!token) return;
    setStockUpdatingId(bookId);
    setBookMessage(null);

    try {
      const updatedBook = await updateBookStock(token, bookId, newStockValue);
      setBooks((prev) => prev.map((b) => (b.id === updatedBook.id ? updatedBook : b)));
      setEditingStockId(null);
      setBookMessage({ type: 'success', text: `Stock actualizado con éxito para "${updatedBook.title}".` });
    } catch (err: unknown) {
      setBookMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al actualizar stock',
      });
    } finally {
      setStockUpdatingId(null);
    }
  };

  // Verificación de autenticación y rol
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Acceso Denegado</h2>
          <p className="text-sm text-slate-600">
            Esta sección es exclusiva para administradores autorizados. Tu cuenta actual no posee privilegios de
            administrador.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
            <Link
              href="/login"
              className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition"
            >
              Iniciar sesión como Administrador
            </Link>
            <Link
              href="/"
              className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition"
            >
              Volver a la tienda
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Filtrado de pedidos
  const filteredOrders = orders.filter((o) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      o.id.toLowerCase().includes(term) ||
      o.deliveryEmail.toLowerCase().includes(term) ||
      o.shippingAddress.toLowerCase().includes(term) ||
      o.items.some((i) => i.title.toLowerCase().includes(term))
    );
  });

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Barra superior del panel */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="Volver a la tienda"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                  Panel de Control EbookStore
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                    Admin
                  </span>
                </h1>
                <p className="text-xs text-slate-400 hidden sm:block">
                  Conectado como: <span className="text-slate-200 font-medium">{user?.email}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Indicador de conexión WebSocket en vivo */}
            <div
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
                isConnected
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                  : 'bg-rose-950/60 text-rose-400 border-rose-800'
              }`}
            >
              {isConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">WebSockets Activo</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                  <span className="hidden sm:inline">Desconectado</span>
                </>
              )}
            </div>

            <button
              onClick={() => {
                loadOrders();
                loadBooks();
              }}
              disabled={loadingOrders || loadingBooks}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Recargar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loadingOrders || loadingBooks ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Pestañas de navegación */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-6 text-xs font-semibold border-t border-slate-800">
          <button
            onClick={() => setActiveTab('kanban')}
            className={`py-3 flex items-center gap-2 border-b-2 transition ${
              activeTab === 'kanban'
                ? 'border-emerald-500 text-emerald-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Truck className="w-4 h-4" />
            Tablero Kanban de Envíos ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('books')}
            className={`py-3 flex items-center gap-2 border-b-2 transition ${
              activeTab === 'books'
                ? 'border-emerald-500 text-emerald-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Catálogo y Stock ({books.length})
          </button>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {orderError && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2 shadow-sm">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{orderError}</span>
          </div>
        )}

        {/* ── TAB 1: TABLERO KANBAN DE ENVÍOS ────────────────────────────── */}
        {activeTab === 'kanban' && (
          <div className="space-y-6">
            {/* Barra de herramientas y búsqueda */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por ID, correo o título..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 w-full sm:w-auto justify-between sm:justify-end">
                <span>
                  Total mostrados: <strong className="text-slate-800">{filteredOrders.length}</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Sincronización en tiempo real
                </span>
              </div>
            </div>

            {/* Columnas del Kanban */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
              {COLUMNS.map((col) => {
                const colOrders = filteredOrders.filter((o) => o.shippingStatus === col.key);

                return (
                  <div
                    key={col.key}
                    className={`bg-white rounded-2xl border ${col.borderColor} shadow-sm overflow-hidden flex flex-col max-h-[82vh]`}
                  >
                    {/* Cabecera de la columna */}
                    <div className={`p-4 border-b ${col.borderColor} ${col.headerBg}`}>
                      <div className="flex items-center justify-between mb-1">
                        <h2 className="text-sm font-bold text-slate-900">{col.title}</h2>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full border ${col.badgeColor}`}
                        >
                          {colOrders.length}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">{col.subtitle}</p>
                    </div>

                    {/* Contenedor scrolleable de tarjetas */}
                    <div className="p-3 overflow-y-auto space-y-3 flex-1 min-h-[220px]">
                      {colOrders.length === 0 ? (
                        <div className="py-12 text-center text-slate-400">
                          <Package className="w-7 h-7 mx-auto mb-2 opacity-40" />
                          <p className="text-xs">Sin pedidos en esta fase</p>
                        </div>
                      ) : (
                        colOrders.map((order) => {
                          const isUpdated = updatedOrderIds.has(order.id);
                          const isActionLoading = actionLoadingId === order.id;
                          const isPaid = order.status === 'pagado';

                          return (
                            <div
                              key={order.id}
                              className={`bg-white border rounded-xl p-3.5 transition-all duration-300 shadow-sm ${
                                isUpdated
                                  ? 'ring-2 ring-emerald-500 border-emerald-400 bg-emerald-50/30'
                                  : 'border-slate-200 hover:border-slate-300 hover:shadow'
                              }`}
                            >
                              {/* Header tarjeta */}
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <span className="font-mono text-[11px] font-bold text-slate-800">
                                  #{order.id.slice(-6).toUpperCase()}
                                </span>
                                <span
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                    isPaid
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-amber-50 text-amber-700 border-amber-200'
                                  }`}
                                >
                                  {order.status}
                                </span>
                              </div>

                              {isUpdated && (
                                <div className="mb-2 text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold animate-pulse text-center">
                                  ✦ Actualizado vía WebSocket
                                </div>
                              )}

                              {/* Datos del cliente */}
                              <div className="text-[11px] text-slate-600 space-y-1 mb-2.5">
                                <p className="truncate" title={order.deliveryEmail}>
                                  <strong>Email:</strong> {order.deliveryEmail}
                                </p>
                                <p className="truncate text-slate-500" title={order.shippingAddress}>
                                  <strong>Dirección:</strong> {order.shippingAddress}
                                </p>
                              </div>

                              {/* Libros en el pedido */}
                              <div className="bg-slate-50 rounded-lg p-2 mb-3 border border-slate-100 space-y-1">
                                {order.items.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="text-[11px] flex justify-between items-center text-slate-700"
                                  >
                                    <span className="truncate pr-2">
                                      {item.quantity}x {item.title}
                                    </span>
                                    <span className="text-slate-500 font-mono text-[10px] shrink-0">
                                      {formatPrice(item.subtotal)}
                                    </span>
                                  </div>
                                ))}
                                <div className="pt-1.5 border-t border-slate-200 flex justify-between items-center font-bold text-xs text-slate-900">
                                  <span>Total:</span>
                                  <span className="text-emerald-700 font-mono">{formatPrice(order.totalAmount)}</span>
                                </div>
                              </div>

                              {/* Botón de avance según la máquina de estados */}
                              {col.nextStatus ? (
                                <button
                                  onClick={() => handleAdvanceStatus(order, col.nextStatus!)}
                                  disabled={!isPaid || isActionLoading}
                                  className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm ${
                                    !isPaid
                                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                      : 'bg-slate-900 hover:bg-emerald-600 text-white'
                                  }`}
                                  title={!isPaid ? 'Solo se pueden avanzar pedidos con estado "pagado"' : ''}
                                >
                                  {isActionLoading ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <>
                                      <span>{col.buttonLabel}</span>
                                      <ArrowRight className="w-3.5 h-3.5" />
                                    </>
                                  )}
                                </button>
                              ) : (
                                <div className="text-center py-1.5 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold border border-emerald-200 flex items-center justify-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Envío Entregado</span>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TAB 2: GESTIÓN DE CATÁLOGO Y STOCK ──────────────────────────── */}
        {activeTab === 'books' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Catálogo de Libros y Control de Stock</h2>
                <p className="text-xs text-slate-500">
                  Modifica las existencias en inventario. El sistema preserva el stock reservado por compras en proceso.
                </p>
              </div>

              {bookMessage && (
                <div
                  className={`text-xs px-3 py-2 rounded-xl flex items-center gap-2 border ${
                    bookMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  {bookMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                  )}
                  <span>{bookMessage.text}</span>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Libro</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4 text-right">Precio</th>
                    <th className="py-3 px-4 text-center">Stock Físico</th>
                    <th className="py-3 px-4 text-center">Reservado</th>
                    <th className="py-3 px-4 text-center">Disponible</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {books.map((book) => {
                    const isEditing = editingStockId === book.id;
                    const isUpdating = stockUpdatingId === book.id;

                    return (
                      <tr key={book.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={book.coverUrl}
                              alt={book.title}
                              className="w-10 h-14 object-cover rounded shadow-sm shrink-0"
                            />
                            <div>
                              <p className="font-bold text-slate-900 line-clamp-1">{book.title}</p>
                              <p className="text-[11px] text-slate-500">{book.author}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200">
                            {book.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {formatPrice(book.price)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isEditing ? (
                            <input
                              type="number"
                              min={book.reserved}
                              value={newStockValue}
                              onChange={(e) => setNewStockValue(parseInt(e.target.value, 10) || 0)}
                              className="w-20 px-2 py-1 text-xs border rounded-lg text-center font-bold focus:ring-2 focus:ring-emerald-500"
                            />
                          ) : (
                            <span className="font-bold text-slate-900">{book.stock}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center text-amber-600 font-semibold">
                          {book.reserved}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`font-bold px-2 py-0.5 rounded-full ${
                              book.availableStock > 5
                                ? 'bg-emerald-50 text-emerald-700'
                                : book.availableStock > 0
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {book.availableStock}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleSaveStock(book.id)}
                                disabled={isUpdating}
                                className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                                title="Guardar stock"
                              >
                                {isUpdating ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => setEditingStockId(null)}
                                className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition"
                                title="Cancelar"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingStockId(book.id);
                                setNewStockValue(book.stock);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-700 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 rounded-lg transition font-semibold"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Ajustar</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
