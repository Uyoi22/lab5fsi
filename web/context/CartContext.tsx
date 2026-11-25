'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Book } from '../lib/api';

export interface CartItem {
  book: Book;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (book: Book, quantity?: number) => void;
  removeFromCart: (bookId: string) => void;
  updateQuantity: (bookId: string, quantity: number) => void;
  clearCart: () => void;
  totalCents: number;
  totalItems: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  // Cargar carrito de localStorage
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('ebookstore_cart');
      if (savedCart) {
        setItems(JSON.parse(savedCart));
      }
    } catch (e) {
      console.error('Error cargando carrito local:', e);
    }
  }, []);

  // Guardar carrito en localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ebookstore_cart', JSON.stringify(items));
    } catch (e) {
      console.error('Error guardando carrito local:', e);
    }
  }, [items]);

  const addToCart = (book: Book, quantity = 1) => {
    setItems((prevItems) => {
      const existing = prevItems.find((item) => item.book.id === book.id);
      if (existing) {
        const newQty = Math.min(book.availableStock, existing.quantity + quantity);
        return prevItems.map((item) =>
          item.book.id === book.id ? { ...item, quantity: newQty } : item
        );
      }
      return [...prevItems, { book, quantity: Math.min(book.availableStock, quantity) }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (bookId: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.book.id !== bookId));
  };

  const updateQuantity = (bookId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(bookId);
      return;
    }
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.book.id === bookId) {
          const maxQty = item.book.availableStock || 99;
          return { ...item, quantity: Math.min(maxQty, quantity) };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const totalCents = items.reduce(
    (sum, item) => sum + (item.book.price || 0) * item.quantity,
    0
  );

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalCents,
        totalItems,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart debe ser usado dentro de un CartProvider');
  }
  return context;
};
