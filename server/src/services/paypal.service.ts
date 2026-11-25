import { config } from '../config/env';
import { IOrder } from '../models/order.model';

export interface PayPalCaptureResult {
  captureId: string;
  status: string;
  amount: string; // e.g. "25.00"
  currency: string; // "USD"
  customId?: string; // Internal order ID
  referenceId?: string; // Internal order ID
  payerEmail?: string;
  rawResponse?: any;
}

// Interfaz para permitir simulación controlada en suites de pruebas de integración
export interface PayPalProvider {
  createOrder(order: IOrder): Promise<{ id: string; status: string }>;
  captureOrder(paypalOrderId: string): Promise<PayPalCaptureResult>;
}

class StandardPayPalProvider implements PayPalProvider {
  private getBaseUrl(): string {
    return config.paypalMode === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  }

  private async getAccessToken(): Promise<string> {
    if (!config.paypalClientId || !config.paypalClientSecret) {
      throw new Error('Credenciales de PayPal no configuradas en el backend.');
    }

    const auth = Buffer.from(`${config.paypalClientId}:${config.paypalClientSecret}`).toString('base64');
    const response = await fetch(`${this.getBaseUrl()}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error de autenticación con PayPal: ${errText}`);
    }

    const data: any = await response.json();
    return data.access_token;
  }

  async createOrder(order: IOrder): Promise<{ id: string; status: string }> {
    const accessToken = await this.getAccessToken();
    // Conversión de enteros en centavos a formato decimal "XX.XX" para PayPal
    const decimalAmount = (order.totalAmount / 100).toFixed(2);
    const orderIdStr = order.id || (order as any)._id?.toString();

    const payload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: orderIdStr,
          custom_id: orderIdStr,
          description: `Pedido EbookStore #${orderIdStr.slice(-6)}`,
          amount: {
            currency_code: 'USD',
            value: decimalAmount,
          },
        },
      ],
    };

    const response = await fetch(`${this.getBaseUrl()}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error creando orden en PayPal: ${errText}`);
    }

    const data: any = await response.json();
    return {
      id: data.id,
      status: data.status,
    };
  }

  async captureOrder(paypalOrderId: string): Promise<PayPalCaptureResult> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(`${this.getBaseUrl()}/v2/checkout/orders/${paypalOrderId}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error capturando orden en PayPal: ${errText}`);
    }

    const data: any = await response.json();
    const purchaseUnit = data.purchase_units?.[0];
    const capture = purchaseUnit?.payments?.captures?.[0];

    return {
      captureId: capture?.id || data.id,
      status: capture?.status || data.status,
      amount: capture?.amount?.value || purchaseUnit?.amount?.value || '0.00',
      currency: capture?.amount?.currency_code || purchaseUnit?.amount?.currency_code || 'USD',
      customId: purchaseUnit?.custom_id || purchaseUnit?.reference_id,
      referenceId: purchaseUnit?.reference_id || purchaseUnit?.custom_id,
      payerEmail: data.payer?.email_address,
      rawResponse: data,
    };
  }
}

// Instancia singleton con capacidad de inyección para pruebas
let currentProvider: PayPalProvider = new StandardPayPalProvider();

export const setPayPalProvider = (provider: PayPalProvider): void => {
  currentProvider = provider;
};

export const resetPayPalProvider = (): void => {
  currentProvider = new StandardPayPalProvider();
};

export const createPayPalOrder = async (order: IOrder): Promise<{ id: string; status: string }> => {
  return currentProvider.createOrder(order);
};

export const capturePayPalOrder = async (paypalOrderId: string): Promise<PayPalCaptureResult> => {
  return currentProvider.captureOrder(paypalOrderId);
};
