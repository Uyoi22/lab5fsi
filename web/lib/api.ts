// ── Interfaces ──────────────────────────────────────────────────────────────

export interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  description: string;
  price: number; // en centavos
  coverUrl: string;
  stock: number;
  reserved: number;
  availableStock: number;
  isAvailable: boolean;
  isActive: boolean;
}

export interface OrderItem {
  book: string; // ID del libro
  title: string;
  quantity: number;
  unitPrice: number; // en centavos
  subtotal: number;  // en centavos
}

export interface Order {
  id: string;
  user: string;
  items: OrderItem[];
  shippingAddress: string;
  deliveryEmail: string;
  totalAmount: number; // en centavos
  status: 'pendiente_pago' | 'procesando_pago' | 'pagado' | 'cancelado';
  shippingStatus: 'pendiente' | 'en_preparacion' | 'listo' | 'entregado';
  reservationExpiresAt: string;
  paypalOrderId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BooksResponse {
  success: boolean;
  data: {
    books: Book[];
    total: number;
    page: number;
    totalPages: number;
    categories: string[];
  };
}

// ── Config ───────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// ── Helpers ──────────────────────────────────────────────────────────────────

export const formatPrice = (cents: number): string => {
  return (cents / 100).toLocaleString('es-ES', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
};

// ── Funciones de fetch ────────────────────────────────────────────────────────

export async function fetchMyOrders(token: string): Promise<Order[]> {
  const res = await fetch(`${API_BASE}/api/orders/my-orders`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('No autenticado');
    throw new Error(`Error ${res.status} al obtener pedidos`);
  }
  const json = await res.json();
  return json.data.orders as Order[];
}

export async function fetchAdminOrders(
  token: string,
  params?: { status?: string; shippingStatus?: string; page?: number; limit?: number }
): Promise<{ orders: Order[]; total: number; page: number; totalPages: number }> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.shippingStatus) query.set('shippingStatus', params.shippingStatus);
  if (params?.page) query.set('page', params.page.toString());
  if (params?.limit) query.set('limit', params.limit.toString());

  const url = `${API_BASE}/api/admin/orders${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    if (res.status === 403) throw new Error('Acceso denegado: se requieren privilegios de administrador');
    throw new Error(`Error ${res.status} al obtener pedidos del panel`);
  }
  const json = await res.json();
  return json.data;
}

export async function updateOrderShippingStatus(
  token: string,
  orderId: string,
  shippingStatus: 'pendiente' | 'en_preparacion' | 'listo' | 'entregado'
): Promise<Order> {
  const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/shipping-status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ shippingStatus }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error?.message || `Error ${res.status} al actualizar estado`);
  }
  return json.data.order as Order;
}

export async function updateBookStock(token: string, bookId: string, stock: number): Promise<Book> {
  const res = await fetch(`${API_BASE}/api/books/${bookId}/stock`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ stock }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error?.message || `Error ${res.status} al actualizar stock`);
  }
  return json.data.book as Book;
}

export async function fetchBooks(params?: {
  category?: string;
  search?: string;
  availableOnly?: boolean;
  page?: number;
}): Promise<BooksResponse['data']> {
  const query = new URLSearchParams();
  if (params?.category && params.category !== 'Todos') query.set('category', params.category);
  if (params?.search) query.set('search', params.search);
  if (params?.availableOnly) query.set('availableOnly', 'true');
  if (params?.page) query.set('page', params.page.toString());

  const url = `${API_BASE}/api/books${query.toString() ? `?${query.toString()}` : ''}`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Error ${res.status} al consultar catálogo`);
    }
    const json: BooksResponse = await res.json();
    return json.data;
  } catch (error) {
    console.error('Error fetching books:', error);
    // Retornar fallback vacío si backend no está accesible durante build estático
    return {
      books: [],
      total: 0,
      page: 1,
      totalPages: 1,
      categories: ['Programación', 'Ciencia', 'Negocios', 'Diseño', 'Ficción'],
    };
  }
}
