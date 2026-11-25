'use client';

import React, { useState } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { CreditCard, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface PayPalButtonProps {
  orderId: string;
  totalAmount: number; // en centavos
  onPaymentSuccess?: (order: any) => void;
  onPaymentError?: (errorMsg: string) => void;
}

export const PayPalButton: React.FC<PayPalButtonProps> = ({
  orderId,
  totalAmount,
  onPaymentSuccess,
  onPaymentError,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paidSuccess, setPaidSuccess] = useState(false);

  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'sb';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const getToken = (): string | null => {
    return typeof window !== 'undefined' ? localStorage.getItem('ebookstore_token') : null;
  };

  const handleCreateOrder = async (): Promise<string> => {
    setLoading(true);
    setErrorMessage(null);

    const token = getToken();
    const res = await fetch(`${apiUrl}/api/payments/paypal/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ orderId }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      const msg = data.error?.message || 'Error al iniciar el pago con PayPal';
      setErrorMessage(msg);
      if (onPaymentError) onPaymentError(msg);
      throw new Error(msg);
    }

    return data.data.paypalOrderId;
  };

  const handleApprove = async (data: { orderID: string }) => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const token = getToken();
      const res = await fetch(`${apiUrl}/api/payments/paypal/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId,
          paypalOrderId: data.orderID,
        }),
      });

      const captureData = await res.json();

      if (!res.ok) {
        throw new Error(captureData.error?.message || 'Error al capturar el pago en PayPal');
      }

      setPaidSuccess(true);
      if (onPaymentSuccess) {
        onPaymentSuccess(captureData.data.order);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error confirmando el pago');
      if (onPaymentError) onPaymentError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (paidSuccess) {
    return (
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
        <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
        <h4 className="font-bold text-emerald-900 text-sm">¡Pago Completado con Éxito!</h4>
        <p className="text-xs text-emerald-700">
          Tu pago ha sido capturado por PayPal y verificado por el backend. El stock ha sido descontado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2">
      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {loading && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-xs flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Procesando pago seguro con el backend...</span>
        </div>
      )}

      <div className="rounded-xl overflow-hidden shadow-sm border border-slate-200/80 p-3 bg-white">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-3">
          <CreditCard className="w-4 h-4 text-emerald-600" />
          <span>Pagar con PayPal Orders API (Sandbox)</span>
        </div>

        <PayPalScriptProvider
          options={{
            clientId,
            currency: 'USD',
            intent: 'capture',
          }}
        >
          <PayPalButtons
            style={{ layout: 'vertical', shape: 'rect', color: 'gold' }}
            createOrder={handleCreateOrder}
            onApprove={handleApprove}
            onError={(err) => {
              setErrorMessage('Error en el componente de PayPal Sandbox');
              console.error('PayPal Button Error:', err);
            }}
          />
        </PayPalScriptProvider>
      </div>
    </div>
  );
};
