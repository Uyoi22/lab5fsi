import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model';
import { config } from '../config/env';
import { AppError } from '../middleware/errorHandler';

// Esquemas de validación Zod
export const registerSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').trim(),
  email: z.string().email('El formato del correo es inválido').trim().toLowerCase(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  // Si envían role, se acepta en el schema pero se descarta forzosamente en el controlador
  role: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('El formato del correo es inválido').trim().toLowerCase(),
  password: z.string().min(1, 'La contraseña es requerida'),
});

const generateToken = (id: string, email: string, role: string): string => {
  return jwt.sign({ id, email, role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as any,
  });
};

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = registerSchema.parse(req.body);

    const existingUser = await User.findOne({ email: validatedData.email });
    if (existingUser) {
      throw new AppError('El correo electrónico ya se encuentra registrado', 409);
    }

    // Regla de seguridad: El registro público siempre crea exclusivamente rol "cliente"
    const newUser = new User({
      name: validatedData.name,
      email: validatedData.email,
      password: validatedData.password,
      role: 'cliente',
    });

    await newUser.save();

    const token = generateToken(newUser.id, newUser.email, newUser.role);

    res.status(201).json({
      success: true,
      data: {
        user: newUser.toJSON(),
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = loginSchema.parse(req.body);

    const user = await User.findOne({ email: validatedData.email });
    if (!user) {
      throw new AppError('Credenciales inválidas', 401);
    }

    const isMatch = await user.comparePassword(validatedData.password);
    if (!isMatch) {
      throw new AppError('Credenciales inválidas', 401);
    }

    const token = generateToken(user.id, user.email, user.role);

    res.status(200).json({
      success: true,
      data: {
        user: user.toJSON(),
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Usuario no autenticado', 401);
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      throw new AppError('Usuario no encontrado', 404);
    }

    res.status(200).json({
      success: true,
      data: {
        user: user.toJSON(),
      },
    });
  } catch (error) {
    next(error);
  }
};
