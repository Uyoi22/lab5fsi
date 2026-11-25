# 📚 EbookStore — Plataforma Full-Stack de Comercio Electrónico de E-books

Bienvenido al repositorio oficial de **EbookStore**, una solución full-stack robusta, escalable y segura para la venta y distribución de libros electrónicos.

---

## 🌟 Características Principales

- **Frontend Moderno:** Next.js 14 con App Router, React 18, Tailwind CSS y diseño adaptativo.
- **Backend Concurrente:** Node.js, Express y TypeScript con WebSockets (Socket.IO) en el **mismo proceso**, protegiendo recursos.
- **Integridad Monetaria:** Precios almacenados estrictamente como **enteros en centavos de USD** (`2999` = $29.99) y recalculados en el servidor para evitar discrepancias por redondeo o manipulaciones del cliente.
- **Reserva Atómica de Stock:** Bloqueo condicional atómico en MongoDB con mecanismo de rollback automático en caso de falta de existencias.
- **Expiración Automática de Reservas:** Tarea periódica en segundo plano que libera el stock reservado tras 30 minutos sin pago (protegiendo pedidos en proceso).
- **Pagos Seguros con PayPal Sandbox:** Creación y captura en backend verificando estado `COMPLETED`, moneda `USD`, monto exacto e idempotencia de captura.
- **Panel Administrativo con Tablero Kanban:** Gestión visual de envíos con máquina de estados estricta (`pendiente` → `en_preparacion` → `listo` → `entregado`) y actualización en tiempo real vía WebSockets.
- **Seguridad Robusta:** Autenticación JWT en cabeceras `Authorization: Bearer` y `handshake.auth.token`, CORS restringido, Helmet y Rate Limiting en autenticación.
- **Despliegue Cloud en Railway:** Configuración lista para despliegue de frontend y backend en Railway sin Vercel.

---

## 🏗️ Estructura del Proyecto

```
lab5fsi/
├── package.json                 # Scripts monorepo para desarrollo, build y pruebas
├── PRD.md                       # Documento de Requisitos de Producto y Arquitectura
├── README.md                    # Esta guía
├── .env.example                 # Plantilla unificada de variables de entorno
├── docs/
│   └── API.md                   # Catálogo exhaustivo de endpoints REST y WebSockets
├── server/                      # Backend (Node.js + Express + Socket.IO + TS)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── railway.json             # Configuración de despliegue Railway para backend
│   ├── .env.example
│   └── src/
│       ├── app.ts               # Configuración Express, middlewares y rutas
│       ├── index.ts             # Servidor HTTP, Socket.IO, DB y Worker de expiración
│       ├── config/              # Variables tipadas y conexión Mongoose
│       ├── controllers/         # Lógica de controladores (auth, books, orders, payments, admin)
│       ├── middleware/          # JWT auth, RBAC, Rate limiter, Error handler
│       ├── models/              # Modelos Mongoose (User, Book, Order)
│       ├── routes/              # Definición de rutas
│       ├── services/            # Lógica de expiración de reservas y PayPal SDK
│       ├── socket/              # Configuración Socket.IO, salas user:<id> y admin
│       ├── scripts/seed.ts      # Script de inicialización de usuarios y catálogo
│       └── tests/               # 79 pruebas de integración automatizadas (Vitest + Supertest)
└── web/                         # Frontend (Next.js 14 App Router)
    ├── package.json
    ├── tsconfig.json
    ├── next.config.mjs
    ├── tailwind.config.ts
    ├── railway.json             # Configuración de despliegue Railway para frontend
    ├── .env.example
    ├── lib/api.ts               # Cliente API y tipos compartidos
    ├── context/                 # Contextos de Carrito (LocalStorage) y Auth (JWT)
    ├── hooks/useSocket.ts       # Hook de conexión en tiempo real a Socket.IO
    ├── components/              # Navbar, BookCard, CartDrawer, PayPalButton
    └── app/                     # Rutas: Catálogo (/), Mis Pedidos (/orders), Admin (/admin), Login (/login)
```

---

## 📋 Requisitos Previos

1. **Node.js:** Versión 20.x o superior (`node -v`).
2. **npm / pnpm:** Gestor de paquetes compatible.
3. **MongoDB:** Clúster en [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) o instancia local (MongoDB 6.0+).
4. **PayPal Developer Sandbox:** Cuenta en [developer.paypal.com](https://developer.paypal.com/) con aplicación creada para obtener Client ID y Secret.

---

## ⚙️ Configuración de Variables de Entorno

Copia los archivos de ejemplo en cada carpeta correspondiente:

### Backend (`server/.env`)
```bash
cp server/.env.example server/.env
```
Contenido requerido:
```ini
PORT=5000
HOST=0.0.0.0
NODE_ENV=development
WEB_ORIGIN=http://localhost:3000
MONGODB_URI=mongodb+srv://<usuario>:<password>@<cluster>.mongodb.net/ebookstore?retryWrites=true&w=majority
JWT_SECRET=super_secret_jwt_key_ebookstore_2026_change_in_production
JWT_EXPIRES_IN=7d
ADMIN_PASSWORD=AdminSecurePassword2026!
DEMO_PASSWORD=ClienteDemoPassword2026!
PAYPAL_CLIENT_ID=tu_paypal_sandbox_client_id
PAYPAL_CLIENT_SECRET=tu_paypal_sandbox_client_secret
PAYPAL_MODE=sandbox
```

### Frontend (`web/.env.local`)
```bash
cp web/.env.example web/.env.local
```
Contenido requerido:
```ini
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
NEXT_PUBLIC_PAYPAL_CLIENT_ID=tu_paypal_sandbox_client_id
```

---

## 🚀 Puesta en Marcha Local

### 1. Instalación de Dependencias
```bash
# Instalar dependencias del backend
npm install --prefix server

# Instalar dependencias del frontend
npm install --prefix web
```

### 2. Poblar Base de Datos (Seed)
Ejecuta el script de inicialización para crear el usuario administrador, cliente de demo y los 8 libros iniciales con precios en centavos:
```bash
npm run seed
```

#### Credenciales por defecto creadas por el Seed:
| Rol | Correo Electrónico | Contraseña por defecto |
|---|---|---|
| **Administrador** | `admin@ebookstore.com` | `AdminSecurePassword2026!` (o según `ADMIN_PASSWORD`) |
| **Cliente Demo** | `cliente@ebookstore.com` | `ClienteDemoPassword2026!` (o según `DEMO_PASSWORD`) |

### 3. Iniciar Entorno de Desarrollo
Puedes ejecutar ambos servicios en terminales separadas:

```bash
# Terminal 1: Iniciar Backend (puerto 5000 con recarga automática tsx)
npm run dev:server

# Terminal 2: Iniciar Frontend Next.js (puerto 3000)
npm run dev:web
```

Abre tu navegador en:
- **Tienda y Catálogo:** `http://localhost:3000`
- **Panel Administrativo Kanban:** `http://localhost:3000/admin`
- **Mis Pedidos:** `http://localhost:3000/orders`
- **Health Check API:** `http://localhost:5000/health`

---

## 🧪 Pruebas Automatizadas

La aplicación cuenta con una suite integral de **79 pruebas automatizadas** en Vitest y Supertest que validan los criterios de aceptación de cada entrega (stock concurrente, precios alterados, RBAC, captura idempotente, máquina de estados):

```bash
# Ejecutar todas las pruebas del backend
npm run test:server
```

Para compilar y verificar tipos de TypeScript en ambos módulos:
```bash
npm run build:server
npm run build:web
```

---

## ☁️ Guía de Despliegue en Railway (Paso a Paso)

Tanto el backend como el frontend están preparados para desplegarse de manera nativa en **Railway** utilizando Nixpacks y los archivos de configuración provistos (`railway.json`).

### Paso 1: Crear Proyecto en Railway
1. Ingresa a [railway.app](https://railway.app/) e inicia sesión.
2. Haz clic en **"New Project"** → **"Deploy from GitHub repo"** y selecciona este repositorio.

---

### Paso 2: Desplegar el Backend (`ebookstore-server`)
1. En el proyecto de Railway, selecciona el servicio creado y en **Settings**:
   - **Service Name:** `ebookstore-server`
   - **Root Directory:** `server`
   - **Build Command:** Usa la configuración de [`server/railway.json`](file:///c:/Users/User/Downloads/lab5fsi/server/railway.json) automáticamente (`npm install && npm run build`).
2. Configura las **Variables de Entorno** del servicio Backend:
   | Variable | Valor Recomendado |
   |---|---|
   | `PORT` | Generado automáticamente por Railway (ej. `5000`) |
   | `HOST` | `0.0.0.0` |
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | Tu cadena de conexión de MongoDB Atlas |
   | `JWT_SECRET` | Cadena aleatoria segura para producción |
   | `JWT_EXPIRES_IN` | `7d` |
   | `ADMIN_PASSWORD` | Contraseña para el administrador |
   | `DEMO_PASSWORD` | Contraseña para el cliente demo |
   | `PAYPAL_CLIENT_ID` | Tu Client ID de PayPal Sandbox |
   | `PAYPAL_CLIENT_SECRET` | Tu Client Secret de PayPal Sandbox |
   | `PAYPAL_MODE` | `sandbox` |
   | `WEB_ORIGIN` | URL pública de Railway del frontend (ej. `https://web-production-xxxx.up.railway.app`) |
3. En **Networking**, haz clic en **"Generate Domain"** para obtener la URL pública del backend (ej. `https://server-production-xxxx.up.railway.app`).
4. El backend cuenta con health check configurado en `/health` con timeout de 100 segundos.

---

### Paso 3: Desplegar el Frontend (`ebookstore-web`)
1. En el mismo proyecto de Railway, haz clic en **"+ New"** → **"GitHub Repo"** y selecciona el mismo repositorio.
2. En **Settings** del nuevo servicio:
   - **Service Name:** `ebookstore-web`
   - **Root Directory:** `web`
3. Configura las **Variables de Entorno** del servicio Frontend:
   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | URL pública generada para el backend (ej. `https://server-production-xxxx.up.railway.app`) |
   | `NEXT_PUBLIC_SOCKET_URL` | Misma URL pública del backend |
   | `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Tu Client ID de PayPal Sandbox |
4. En **Networking**, haz clic en **"Generate Domain"** para obtener la URL de acceso público de la tienda.
5. Actualiza la variable `WEB_ORIGIN` en el servicio del backend con este nuevo dominio para permitir las solicitudes CORS.

---

### Paso 4: Ejecutar el Seed en Producción
Para inicializar los datos en el clúster de MongoDB Atlas:
- Desde la terminal de tu máquina con el archivo `.env` apuntando a MongoDB Atlas:
  ```bash
  npm run seed
  ```
- O bien, desde la pestaña **CLI / Exec** del servicio backend en Railway:
  ```bash
  npm run seed
  ```

---

## 📖 Documentación Adicional

- 📄 [**Documento de Requisitos de Producto (PRD.md)**](./PRD.md): Especificación detallada de casos de uso, arquitectura, diagramas Mermaid (Arquitectura, ER, Secuencia, Estados) y análisis de casos de borde.
- 🔌 [**Documentación de Endpoints y WebSockets (docs/API.md)**](./docs/API.md): Especificación exhaustiva de contratos JSON, códigos de respuesta y eventos Socket.IO.

---

## 🛡️ Limitación Documentada: "Cobrado pero Cancelado"
Si un usuario crea un pedido reservando stock por 30 minutos y completa la aprobación en PayPal después de que la orden haya expirado localmente, el backend rechaza la captura con `400 Bad Request` protegiendo la integridad del inventario. Para este escenario, el monto retenido en PayPal debe ser reintegrado mediante un **Reembolso Manual** desde el panel de control de PayPal Developer por el administrador. Para más detalles, consulta la sección 6.1 de [PRD.md](./PRD.md).
