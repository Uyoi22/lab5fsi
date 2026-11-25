import mongoose, { Document, Schema, Model } from 'mongoose';

export type OrderStatus = 'pendiente_pago' | 'procesando_pago' | 'pagado' | 'cancelado';
export type ShippingStatus = 'pendiente' | 'en_preparacion' | 'listo' | 'entregado';

export interface IOrderItem {
  book: mongoose.Types.ObjectId;
  title: string;
  quantity: number;
  unitPrice: number; // en centavos
  subtotal: number; // en centavos
}

export interface IOrder extends Document {
  user: mongoose.Types.ObjectId;
  items: IOrderItem[];
  shippingAddress: string;
  deliveryEmail: string;
  totalAmount: number; // en centavos
  status: OrderStatus;
  shippingStatus: ShippingStatus;
  reservationExpiresAt: Date;
  paypalOrderId?: string;
  paypalCaptureId?: string;
  paymentDetails?: {
    capturedAt?: Date;
    amount?: number;
    currency?: string;
    payerEmail?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    book: {
      type: Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'La cantidad debe ser al menos 1'],
      validate: {
        validator: Number.isInteger,
        message: 'La cantidad debe ser un entero',
      },
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [1, 'El precio unitario debe ser positivo'],
      validate: {
        validator: Number.isInteger,
        message: 'El precio unitario debe ser un entero en centavos',
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: [1, 'El subtotal debe ser positivo'],
      validate: {
        validator: Number.isInteger,
        message: 'El subtotal debe ser un entero en centavos',
      },
    },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items: IOrderItem[]) => items.length > 0,
        message: 'El pedido debe contener al menos un libro',
      },
    },
    shippingAddress: {
      type: String,
      required: [true, 'La dirección de entrega es obligatoria'],
      trim: true,
      minlength: [5, 'La dirección debe tener al menos 5 caracteres'],
    },
    deliveryEmail: {
      type: String,
      required: [true, 'El correo de entrega es obligatorio'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'El formato de correo de entrega es inválido'],
    },
    totalAmount: {
      type: Number,
      required: true,
      min: [1, 'El monto total debe ser positivo'],
      validate: {
        validator: Number.isInteger,
        message: 'El total debe ser un entero en centavos',
      },
    },
    status: {
      type: String,
      enum: ['pendiente_pago', 'procesando_pago', 'pagado', 'cancelado'],
      default: 'pendiente_pago',
      index: true,
    },
    shippingStatus: {
      type: String,
      enum: ['pendiente', 'en_preparacion', 'listo', 'entregado'],
      default: 'pendiente',
      index: true,
    },
    reservationExpiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 30 * 60 * 1000), // 30 minutos
      index: true,
    },
    paypalOrderId: {
      type: String,
      sparse: true,
      index: true,
    },
    paypalCaptureId: {
      type: String,
      unique: true,
      sparse: true,
    },
    paymentDetails: {
      capturedAt: { type: Date },
      amount: { type: Number },
      currency: { type: String },
      payerEmail: { type: String },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id ? ret._id.toString() : '';
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const Order: Model<IOrder> = mongoose.models.Order || mongoose.model<IOrder>('Order', orderSchema);
