# Documentación Completa de APIs REST y WebSockets — EbookStore
**Versión:** 1.0.0  
**Formato:** JSON sobre HTTPS / WebSockets  
**Autenticación:** `Authorization: Bearer <token_jwt>`  
**Base URL Local:** `http://localhost:5000`  

---

## 1. Convenciones y Códigos de Respuesta HTTP

Todos los endpoints REST devuelven respuestas formateadas en JSON con la estructura estándar:
```json
// Éxito:
{
  "success": true,
  "data": { ... }
}

// Error:
{
  "success": false,
  "error": {
    "message": "Descripción legible en español",
    "details": { ... } // Opcional, ej: errores de validación Zod
  }
}
```

### Códigos de Estado
| Código | Significado | Escenario de uso |
|---|---|---|
| `200 OK` | Petición exitosa | Consultas GET, actualizaciones PATCH/PUT exitosas |
| `201 Created` | Recurso creado | Registro de usuario, creación de libro u orden |
| `400 Bad Request` | Petición malformada | Errores de validación de Zod, saltos inválidos en la máquina de estados |
| `401 Unauthorized` | No autenticado | Token ausente, firma inválida o token expirado |
| `403 Forbidden` | No autorizado | Usuario cliente intentando rutas admin o pedido ajeno |
| `404 Not Found` | No encontrado | ID inexistente de libro, usuario u orden |
| `409 Conflict` | Conflicto de datos | Correo ya registrado, stock insuficiente durante reserva atómica |
| `429 Too Many Requests` | Límite de tasa excedido | Más de 5 peticiones por minuto en login o registro |
| `500 Internal Server Error` | Error de servidor | Errores no controlados de base de datos o pasarela |

---

## 2. Monitoreo y Salud

### `GET /health`
Verifica la disponibilidad del servicio y el estado de la conexión a MongoDB Atlas.
- **Autenticación:** No requerida.
- **Respuesta `200 OK`:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-11-25T18:00:00.000Z",
    "uptime": 124.5,
    "database": {
      "status": "connected",
      "readyState": 1
    },
    "memory": {
      "rss": "85 MB",
      "heapUsed": "42 MB"
    }
  }
}
```

---

## 3. Autenticación y Usuarios

### `POST /api/auth/register`
Registra un nuevo usuario en la plataforma.
- **Autenticación:** No requerida.
- **Rate Limit:** 5 peticiones / 15 min.
- **Regla de Negocio:** Siempre asigna el rol `cliente` (el rol `admin` no puede crearse por registro público).
- **Body:**
```json
{
  "name": "Juan Pérez",
  "email": "juan@ejemplo.com",
  "password": "PasswordSegura123!"
}
```
- **Respuesta `201 Created`:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "6740ad64d78292cbb24e6501",
      "name": "Juan Pérez",
      "email": "juan@ejemplo.com",
      "role": "cliente"
    }
  }
}
```

### `POST /api/auth/login`
Inicia sesión y genera el token JWT.
- **Autenticación:** No requerida.
- **Rate Limit:** 5 peticiones / 15 min.
- **Body:**
```json
{
  "email": "cliente@ebookstore.com",
  "password": "ClienteDemoPassword2026!"
}
```
- **Respuesta `200 OK`:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "6740ad64d78292cbb24e6502",
      "name": "Cliente de Demostración",
      "email": "cliente@ebookstore.com",
      "role": "cliente"
    }
  }
}
```

### `GET /api/auth/me`
Obtiene los datos del usuario autenticado.
- **Autenticación:** Bearer JWT.
- **Respuesta `200 OK`:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "6740ad64d78292cbb24e6502",
      "name": "Cliente de Demostración",
      "email": "cliente@ebookstore.com",
      "role": "cliente"
    }
  }
}
```

---

## 4. Catálogo de Libros

### `GET /api/books`
Lista los libros disponibles en el catálogo.
- **Autenticación:** No requerida.
- **Query Params:**
  - `category` (string, opcional): Filtrar por categoría (ej. `Programación`).
  - `search` (string, opcional): Búsqueda por texto en título, autor o descripción.
  - `availableOnly` (boolean, opcional): Solo libros con stock físico disponible > 0.
  - `page` (number, opcional, def: 1): Página.
  - `limit` (number, opcional, def: 12): Elementos por página.
- **Respuesta `200 OK`:**
```json
{
  "success": true,
  "data": {
    "books": [
      {
        "id": "6740ad64d78292cbb24e6510",
        "title": "Clean Code: A Handbook of Agile Software Craftsmanship",
        "author": "Robert C. Martin",
        "category": "Programación",
        "description": "Guía fundamental de buenas prácticas y desarrollo ágil.",
        "price": 2999,
        "coverUrl": "https://images.unsplash.com/photo-1532012164546-f432f2e3777a?w=400",
        "stock": 25,
        "reserved": 2,
        "availableStock": 23,
        "isAvailable": true,
        "isActive": true
      }
    ],
    "total": 8,
    "page": 1,
    "totalPages": 1,
    "categories": ["Programación", "Ciencia", "Negocios", "Diseño", "Ficción"]
  }
}
```

### `GET /api/books/:id`
Detalle de un libro por su ID.
- **Autenticación:** No requerida.
- **Respuesta `200 OK`:** Objeto libro individual.

### `POST /api/books`
Crea un nuevo libro en el catálogo.
- **Autenticación:** Bearer JWT (Rol `admin`).
- **Body:**
```json
{
  "title": "Refactoring",
  "author": "Martin Fowler",
  "category": "Programación",
  "description": "Improving the Design of Existing Code",
  "price": 3499,
  "coverUrl": "https://example.com/cover.jpg",
  "stock": 15
}
```

### `PATCH /api/books/:id/stock`
Ajusta el inventario físico de un libro.
- **Autenticación:** Bearer JWT (Rol `admin`).
- **Body:** `{ "stock": 50 }`
- **Respuesta `200 OK`:** Retorna el libro con stock actualizado.

---

## 5. Carrito, Pedidos y Reserva de Stock

### `POST /api/orders`
Crea un nuevo pedido reservando stock atómicamente por 30 minutos.
- **Autenticación:** Bearer JWT.
- **Body:**
```json
{
  "items": [
    {
      "bookId": "6740ad64d78292cbb24e6510",
      "quantity": 1
    }
  ],
  "shippingAddress": "Av. Libertador 1234, Ciudad",
  "deliveryEmail": "juan@ejemplo.com"
}
```
- **Regla Crítica:** Los precios se leen de la base de datos en centavos (`totalAmount` es calculado en el servidor).
- **Respuesta `201 Created`:**
```json
{
  "success": true,
  "data": {
    "order": {
      "id": "6740b201d78292cbb24e6550",
      "user": "6740ad64d78292cbb24e6501",
      "items": [
        {
          "book": "6740ad64d78292cbb24e6510",
          "title": "Clean Code",
          "quantity": 1,
          "unitPrice": 2999,
          "subtotal": 2999
        }
      ],
      "shippingAddress": "Av. Libertador 1234, Ciudad",
      "deliveryEmail": "juan@ejemplo.com",
      "totalAmount": 2999,
      "status": "pendiente_pago",
      "shippingStatus": "pendiente",
      "reservationExpiresAt": "2026-11-25T18:30:00.000Z",
      "createdAt": "2026-11-25T18:00:00.000Z"
    }
  }
}
```

### `GET /api/orders/my-orders`
Retorna el historial de compras del usuario autenticado.
- **Autenticación:** Bearer JWT.
- **Respuesta `200 OK`:** Array de pedidos del usuario autenticado ordenados por fecha descendente.

### `GET /api/orders/:id`
Consulta un pedido específico.
- **Autenticación:** Bearer JWT.
- **Regla de Autorización:** El usuario debe ser el propietario del pedido o tener el rol `admin` (de lo contrario retorna `403 Forbidden`).

---

## 6. Pasarela de Pagos (PayPal Sandbox)

### `POST /api/payments/paypal/create`
Genera una orden en PayPal Sandbox para el pedido especificado.
- **Autenticación:** Bearer JWT (Propietario del pedido).
- **Body:** `{ "orderId": "6740b201d78292cbb24e6550" }`
- **Comportamiento:**
  - Convierte los centavos del pedido a decimal (`2999` → `"29.99"`).
  - Incluye `custom_id: orderId` en la orden de PayPal.
  - Guarda `paypalOrderId` en el pedido local.
- **Respuesta `200 OK`:**
```json
{
  "success": true,
  "data": {
    "paypalOrderId": "9XY12345678901234",
    "orderId": "6740b201d78292cbb24e6550",
    "amount": "29.99",
    "currency": "USD"
  }
}
```

### `POST /api/payments/paypal/capture`
Captura el pago autorizado en PayPal e impacta el inventario de manera atómica e idempotente.
- **Autenticación:** Bearer JWT (Propietario del pedido).
- **Body:**
```json
{
  "orderId": "6740b201d78292cbb24e6550",
  "paypalOrderId": "9XY12345678901234"
}
```
- **Validaciones Críticas Realizadas en el Servidor:**
  1. Idempotencia: Si la orden ya está en `pagado`, devuelve el resultado inmediatamente sin volver a cobrar ni descontar stock.
  2. Transición previa: Pasa atómicamente de `pendiente_pago` a `procesando_pago`.
  3. Ejecuta `Orders.capture` en PayPal.
  4. Valida:
     - `status === 'COMPLETED'`
     - Moneda `USD`
     - Monto exacto en centavos contra `order.totalAmount`
     - `custom_id === order.id`
  5. Descuenta `stock` físico y libera `reserved`.
  6. Guarda `paypalCaptureId` bajo índice único.
  7. Emite evento WebSocket `order:updated` a las salas `user:<id>` y `admin`.
- **Respuesta `200 OK`:**
```json
{
  "success": true,
  "data": {
    "order": {
      "id": "6740b201d78292cbb24e6550",
      "status": "pagado",
      "shippingStatus": "pendiente",
      "paypalCaptureId": "4AB12345CD67890"
    }
  }
}
```

---

## 7. Panel Administrativo y Logística

### `GET /api/admin/orders`
Consulta pedidos para el tablero Kanban administrativo.
- **Autenticación:** Bearer JWT (Rol `admin`).
- **Query Params:**
  - `shippingStatus`: `pendiente`, `en_preparacion`, `listo`, `entregado`.
  - `status`: `pagado`, `pendiente_pago`, `cancelado`.
- **Respuesta `200 OK`:** Lista paginada con usuarios populados.

### `PATCH /api/admin/orders/:id/shipping-status`
Avanza el estado de envío aplicando la máquina de estados estricta.
- **Autenticación:** Bearer JWT (Rol `admin`).
- **Body:** `{ "shippingStatus": "en_preparacion" }`
- **Reglas:**
  - Solo pedidos con `status === 'pagado'` pueden cambiar de estado de envío.
  - Transiciones permitidas:
    - `pendiente` → `en_preparacion`
    - `en_preparacion` → `listo`
    - `listo` → `entregado`
  - Cualquier salto, regresión o cambio sobre `entregado` arroja `400 Bad Request`.
- **Emisión en Tiempo Real:** Emite `order:updated` a la sala privada del comprador y a la sala `admin`.

---

## 8. WebSockets en Tiempo Real (Socket.IO)

### Conexión y Autenticación
- **URL:** Misma URL del servidor backend (`http://localhost:5000` o URL pública en Railway).
- **Transportes:** `['websocket', 'polling']`.
- **Autenticación:** Token JWT provisto en `handshake.auth.token` o cabecera `Authorization: Bearer <token>`.

### Salas (Rooms)
1. **`user:<userId>`:** Asignada automáticamente por el servidor según el ID decodificado del JWT. Aislamiento total de eventos entre clientes.
2. **`admin`:** Asignada automáticamente si `decoded.role === 'admin'`.

### Evento: `order:updated`
Emitido por el servidor al confirmar un pago o al cambiar el estado de envío.
- **Payload mínimo enviado:**
```json
{
  "orderId": "6740b201d78292cbb24e6550",
  "status": "pagado",
  "shippingStatus": "en_preparacion",
  "updatedAt": "2026-11-25T18:15:00.000Z"
}
```
