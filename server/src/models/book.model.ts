import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IBook extends Document {
  title: string;
  author: string;
  category: string;
  description: string;
  price: number; // En centavos (ej. 1999 = $19.99)
  coverUrl: string;
  stock: number;
  reserved: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  availableStock: number;
  isAvailable: boolean;
}

const bookSchema = new Schema<IBook>(
  {
    title: {
      type: String,
      required: [true, 'El título es obligatorio'],
      trim: true,
      index: true,
    },
    author: {
      type: String,
      required: [true, 'El autor es obligatorio'],
      trim: true,
      index: true,
    },
    category: {
      type: String,
      required: [true, 'La categoría es obligatoria'],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'La descripción es obligatoria'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'El precio es obligatorio'],
      min: [1, 'El precio debe ser un número entero mayor a 0 en centavos'],
      validate: {
        validator: Number.isInteger,
        message: 'El precio debe almacenarse como un entero en centavos',
      },
    },
    coverUrl: {
      type: String,
      required: [true, 'La URL de la portada es obligatoria'],
      trim: true,
    },
    stock: {
      type: Number,
      required: [true, 'El stock es obligatorio'],
      min: [0, 'El stock no puede ser negativo'],
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: 'El stock debe ser un número entero',
      },
    },
    reserved: {
      type: Number,
      min: [0, 'El stock reservado no puede ser negativo'],
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: 'El stock reservado debe ser un número entero',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id ? ret._id.toString() : '';
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Virtuals para cálculo de disponibilidad
bookSchema.virtual('availableStock').get(function (this: IBook) {
  return Math.max(0, (this.stock || 0) - (this.reserved || 0));
});

bookSchema.virtual('isAvailable').get(function (this: IBook) {
  const available = Math.max(0, (this.stock || 0) - (this.reserved || 0));
  return this.isActive && available > 0;
});

// Índice compuesto para búsquedas
bookSchema.index({ title: 'text', author: 'text', description: 'text' });

export const Book: Model<IBook> = mongoose.models.Book || mongoose.model<IBook>('Book', bookSchema);
