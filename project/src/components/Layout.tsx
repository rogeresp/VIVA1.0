import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Building2, ArrowLeftRight,
  Globe, MessageCircle, Bot,
  Settings, Upload, Users,
  Sparkles, Sun, Moon,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import AIAssistant from './AIAssistant';
import ImportModal from './ImportModal';
import woodDark from '../assets/wood-dark.jpg';
import woodLight from '../assets/wood-light.jpg';
import darkAmbient from '../assets/dark-ambient.jpg';
import lightAmbient from '../assets/light-ambient.jpg';
import vivaLogo from '../assets/viva-acronym.png';
import vivaIcon from '../assets/viva-icon.png';
import vivaIconDark from '../assets/viva-acronym-dark.png';

const nav = [
  { label: 'Home', icon: LayoutDashboard, href: '/' },
  { label: 'Clientes', icon: Users, href: '/clientes' },
  { label: 'Imóveis', icon: Building2, href: '/imoveis' },
  { label: 'Permutas', icon: ArrowLeftRight, href: '/permutas' },
  { label: 'Rede', icon: Globe, href: '/rede' },
  { label: 'Chat', icon: MessageCircle, href: '/chat' },
  { label: 'Atualização', icon: Bot, href: '/automacao' },
];

export default function Layout() {
  const [expanded, setExpanded] = useState(true);
  const [aiOpen, setAiOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const woodImg = theme === 'dark' ? woodDark : woodLight;
  const ambientImg = theme === 'dark' ? darkAmbient : lightAmbient;
  const isDark = theme === 'dark';

  return (
    <div className="h-screen w-full flex overflow-hidden"
      style={{
        background: isDark
          ? 'radial-gradient(120% 80% at 100% 0%, rgba(180, 140, 80, 0.35), transparent 55%), linear-gradient(180deg, #07120e, #050e0a)'
          : 'radial-gradient(120% 80% at 100% 0%, rgba(210, 180, 120, 0.7), transparent 60%), linear-gradient(180deg, #faf8f3, #f7f4ee)',
      }}
    >
      {/* ===== SIDEBAR ===== */}
      <aside
        className={`wood-panel relative hidden md:flex flex-col shrink-0 border-r border-black/40 transition-all duration-500 ${
          expanded ? 'w-[260px]' : 'w-[70px]'
        }`}
        style={{
          backgroundImage: `url(${woodImg})`,
          backgroundSize: '180% 110%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* LED Edge */}
        <div className="led-edge" />
        <div className="led-corner led-corner--tl" />
        <div className="led-corner led-corner--bl" />

        {/* Brand - click to toggle sidebar */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="relative z-10 flex justify-center w-full cursor-pointer pt-8 pb-6 px-1"
        >
          <div className={expanded ? 'w-full max-w-[150px]' : 'w-36 h-36 overflow-hidden flex items-center justify-center'}>
            <img
              src={expanded ? vivaLogo : (isDark ? vivaIconDark : vivaIcon)}
              alt="VIVA"
              className={`select-none ${expanded ? 'w-full h-auto' : 'w-full h-full object-contain'}`}
              draggable={false}
              style={isDark
                ? { filter: 'invert(1) hue-rotate(180deg) brightness(1.05)' + (expanded ? ' drop-shadow(0 0 12px rgba(108, 196, 144, 0.35))' : '') }
                : { filter: 'drop-shadow(0 1px 0 rgba(255,255,255,0.5)) drop-shadow(0 2px 6px rgba(0,0,0,0.18))' }
              }
            />
          </div>
        </button>

        {/* Navigation */}
        <nav className="relative z-10 flex-1 px-3 space-y-1 overflow-y-auto">
          {nav.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                `group flex items-center ${expanded ? 'justify-center gap-3 px-3.5' : 'justify-center'} py-2.5 rounded-xl text-[13.5px] transition-all ${
                  isActive ? 'font-semibold' : 'hover:bg-white/8'
                }`
              }
              style={({ isActive }) => ({
                background: isActive ? '#4A9B63' : 'transparent',
                color: isActive ? '#ffffff' : isDark ? '#f5f3f0' : '#4a4a4a',
                boxShadow: isActive ? '0 4px 14px -4px rgba(74,155,99,0.6)' : 'none',
              })}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.6} />
              <span className={`transition-all duration-500 overflow-hidden whitespace-nowrap ${expanded ? 'max-w-[200px] opacity-100 ml-0' : 'max-w-0 opacity-0 ml-0'}`}>{item.label}</span>
            </NavLink>
          ))}
          <button
            onClick={() => setImportOpen(true)}
            className={`group flex items-center ${expanded ? 'justify-center gap-3 px-3.5' : 'justify-center'} py-2.5 rounded-xl text-[13.5px] transition-all w-full hover:bg-white/8`}
            style={{ color: isDark ? '#f5f3f0' : '#4a4a4a' }}
          >
            <Upload className="h-[18px] w-[18px] shrink-0" strokeWidth={1.6} />
            <span className={`transition-all duration-500 overflow-hidden whitespace-nowrap ${expanded ? 'max-w-[200px] opacity-100' : 'max-w-0 opacity-0'}`}>Importar Dados</span>
          </button>
        </nav>

        {/* User Card */}
        <div className="relative z-10 px-3 pb-4">
          <button
            onClick={signOut}
            className={`group flex items-center ${expanded ? 'justify-center gap-3 px-3.5' : 'justify-center'} py-2.5 rounded-xl text-[13.5px] transition-all w-full hover:bg-white/8`}
            style={{ color: isDark ? '#f5f3f0' : '#4a4a4a' }}
          >
            <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className={`transition-all duration-500 overflow-hidden whitespace-nowrap ${expanded ? 'max-w-[200px] opacity-100' : 'max-w-0 opacity-0'}`}>Sair</span>
          </button>
        </div>
      </aside>

      {/* ===== MAIN ===== */}
      <main className="relative flex-1 min-w-0 overflow-hidden flex flex-col">
        {/* Sanca light */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[220px] z-0"
          style={{
            background: isDark
              ? 'radial-gradient(120% 100% at 50% -20%, rgba(216, 180, 122, 0.22), transparent 65%)'
              : 'radial-gradient(120% 100% at 50% -20%, rgba(216, 180, 122, 0.14), transparent 65%)',
          }}
        />

        {/* Ambient hero image */}
        <div aria-hidden className="absolute inset-0 pointer-events-none z-0">
          <img
            src={ambientImg}
            alt=""
            className="absolute top-0 right-0 h-[420px] w-[65%] object-cover object-right"
            style={{
              maskImage: 'linear-gradient(180deg, black 0%, black 45%, transparent 100%), linear-gradient(270deg, black 0%, black 55%, transparent 100%)',
              maskComposite: 'intersect',
              WebkitMaskImage: 'linear-gradient(180deg, black 0%, black 45%, transparent 100%), linear-gradient(270deg, black 0%, black 55%, transparent 100%)',
              opacity: isDark ? 0.55 : 0.42,
              filter: 'saturate(0.92)',
            }}
          />
          {/* Blueprint SVG */}
          <svg className="absolute top-16 right-16 w-[480px] h-[300px]"
            style={{ opacity: isDark ? 0.018 : 0.012, color: isDark ? '#f0eeeb' : '#1a1b1e' }}
            viewBox="0 0 420 260" fill="none" stroke="currentColor" strokeWidth="0.4"
          >
            <rect x="10" y="10" width="400" height="240" />
            <line x1="10" y1="120" x2="410" y2="120" />
            <line x1="180" y1="10" x2="180" y2="250" />
            <line x1="290" y1="120" x2="290" y2="250" />
            <rect x="20" y="20" width="60" height="40" />
            <rect x="200" y="20" width="80" height="50" />
            <rect x="300" y="130" width="100" height="110" />
            <circle cx="100" cy="80" r="2" />
            <circle cx="220" cy="180" r="2" />
          </svg>
        </div>

        {/* Header */}
        <div className="relative z-10 flex items-center justify-end gap-3 px-8 lg:px-12 pt-6">
          <button
            onClick={toggleTheme}
            className="grid h-9 w-9 place-items-center rounded-full backdrop-blur-sm transition-all hover:bg-white/10"
            style={{
              background: isDark ? 'rgba(15, 26, 22, 0.35)' : 'rgba(255, 255, 255, 0.35)',
              border: isDark ? '1px solid rgba(245, 243, 240, 0.12)' : '1px solid rgba(74, 74, 74, 0.12)',
              color: isDark ? '#f5f3f0' : '#4a4a4a',
            }}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <NavLink
            to="/configuracoes"
            className="flex items-center gap-3 rounded-2xl px-3 py-2 backdrop-blur-sm transition-all hover:bg-white/10"
            style={{
              background: isDark ? 'rgba(15, 26, 22, 0.35)' : 'rgba(255, 255, 255, 0.35)',
              border: isDark ? '1px solid rgba(245, 243, 240, 0.12)' : '1px solid rgba(74, 74, 74, 0.12)',
            }}
          >
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-semibold text-sm"
              style={{
                background: 'rgba(74, 155, 99, 0.25)',
                color: isDark ? '#f5f3f0' : '#4a4a4a',
              }}
            >
              {profile?.full_name?.[0] || 'U'}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: isDark ? '#f5f3f0' : '#4a4a4a' }}>
                {profile?.full_name || 'Usuário'}
              </div>
              <div className="text-xs truncate" style={{ color: isDark ? 'rgba(245, 243, 240, 0.6)' : 'rgba(74, 74, 74, 0.6)' }}>
                {profile?.email || 'usuario@email.com'}
              </div>
            </div>
          </NavLink>
        </div>

        {/* Content */}
        <div className="relative z-10 flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>

      {/* Floating AI */}
      {!aiOpen && (
        <button
          onClick={() => setAiOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-[#4A9B63] text-white flex items-center justify-center hover:brightness-110 transition-all shadow-xl shadow-[#4A9B63]/30 animate-pulse-soft"
        >
          <Bot size={20} />
        </button>
      )}

      {/* AI Panel */}
      {aiOpen && (
        <div className="fixed right-0 top-0 h-full w-96 z-40 animate-fade-in overflow-auto surface-glass rounded-none border-0"
          style={{ borderLeft: '1px solid #1a2a23' }}
        >
          <AIAssistant onClose={() => setAiOpen(false)} />
        </div>
      )}

      <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
