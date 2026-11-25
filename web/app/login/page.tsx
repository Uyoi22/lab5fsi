'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Mail, Lock, User, Eye, EyeOff, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const { login, register } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
        setSuccess('¡Sesión iniciada! Redirigiendo...');
        setTimeout(() => router.push('/'), 800);
      } else {
        await register(name, email, password);
        setSuccess('¡Cuenta creada! Redirigiendo...');
        setTimeout(() => router.push('/'), 800);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 transition mb-8">
        <div className="p-2 bg-emerald-100 rounded-xl">
          <BookOpen className="w-6 h-6 text-emerald-700" />
        </div>
        <span className="text-2xl font-bold tracking-tight text-slate-900">
          Ebook<span className="text-emerald-600">Store</span>
        </span>
      </Link>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
            className={`flex-1 py-4 text-sm font-semibold transition ${
              mode === 'login'
                ? 'text-emerald-700 border-b-2 border-emerald-600 bg-emerald-50/50'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            onClick={() => { setMode('register'); setError(null); setSuccess(null); }}
            className={`flex-1 py-4 text-sm font-semibold transition ${
              mode === 'register'
                ? 'text-emerald-700 border-b-2 border-emerald-600 bg-emerald-50/50'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Registrarse
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <h1 className="text-lg font-bold text-slate-900 text-center">
            {mode === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}
          </h1>

          {/* Alertas */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* Campo Nombre (solo en registro) */}
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Nombre completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  minLength={2}
                  placeholder="Tu nombre"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Correo electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Contraseña */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                placeholder={mode === 'register' ? 'Mínimo 8 caracteres' : 'Tu contraseña'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition shadow-md shadow-emerald-200 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          >
            {loading
              ? mode === 'login' ? 'Iniciando sesión...' : 'Creando cuenta...'
              : mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </button>

          {/* Credenciales de demo */}
          {mode === 'login' && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 text-center mb-2">Cuentas de demostración:</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setEmail('cliente@ebookstore.com'); setPassword('ClienteDemoPassword2026!'); }}
                  className="text-[10px] px-2 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition text-center"
                >
                  👤 Demo Cliente
                </button>
                <button
                  type="button"
                  onClick={() => { setEmail('admin@ebookstore.com'); setPassword(process.env.NEXT_PUBLIC_ADMIN_HINT || 'AdminPassword2026!'); }}
                  className="text-[10px] px-2 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition text-center"
                >
                  🛡️ Demo Admin
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

      <p className="mt-6 text-xs text-slate-400 text-center max-w-xs">
        Al registrarte aceptas nuestros términos de uso. Tus datos están protegidos.
      </p>
    </div>
  );
}
