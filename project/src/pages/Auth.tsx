import { useState } from 'react';
import { Mail, Lock, User, Sun, Moon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password, fullName);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 transition-colors duration-300 relative overflow-hidden">
      {/* Premium dark background */}
      <div className="absolute inset-0 dark:bg-[#0f1114] bg-light-bg" />

      {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2.5 rounded-lg dark:bg-surface-card/50 bg-light-hover border dark:border-surface-border border-light-border text-muted hover:text-secondary transition-all"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <div className="w-full max-w-md relative z-10">
        {/* VIVA Logo */}
        <div className="flex justify-center mb-8">
          <div className="bg-viva-500 rounded-2xl p-4 shadow-lg">
            <span className="text-2xl font-bold text-white">V</span>
          </div>
        </div>

        {/* VIVA Branding */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2 tracking-tight">VIVA</h1>
          <p className="text-muted text-sm tracking-wide">Plataforma Inteligente de Gestão Imobiliária</p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl p-8 mb-6 dark:bg-surface-card bg-white border dark:border-surface-border border-light-border">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name Field (Signup only) */}
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Nome Completo
                  </div>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input"
                  placeholder="Seu nome completo"
                  required
                />
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </div>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="seu@email.com"
                required
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Senha
                </div>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
              />
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-6"
            >
              {loading ? 'Processando...' : (isLogin ? 'Entrar' : 'Criar conta')}
            </button>
          </form>
        </div>

        {/* Toggle Link */}
        <div className="text-center">
          <p className="text-muted text-sm">
            {isLogin ? 'Não tem conta?' : 'Já tem conta?'}{' '}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setEmail('');
                setPassword('');
                setFullName('');
              }}
              className="text-viva-500 hover:text-viva-400 font-medium transition-colors"
            >
              {isLogin ? 'Cadastre-se' : 'Faça login'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
