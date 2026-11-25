import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { CartProvider } from '../context/CartContext';
import { CartDrawer } from '../components/CartDrawer';

export const metadata: Metadata = {
  title: 'EbookStore — Tu librería digital favorita',
  description: 'Compra y descarga libros electrónicos al instante con pagos seguros por PayPal.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased flex flex-col min-h-screen">
        <AuthProvider>
          <CartProvider>
            {children}
            <CartDrawer />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
