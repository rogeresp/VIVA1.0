import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import Home from './pages/Home';
import Clients from './pages/Clients';
import Properties from './pages/Properties';
import Exchanges from './pages/Exchanges';
import Network from './pages/Network';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import Automation from './pages/Automation';
import type { ReactNode } from 'react';

function Protected({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center"><div className="w-6 h-6 border-2 border-viva-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!profile) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function Public({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (profile) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Public><Auth /></Public>} />
      <Route element={<Protected><DataProvider><Layout /></DataProvider></Protected>}>
        <Route path="/" element={<Home />} />
        <Route path="/clientes" element={<Clients />} />
        <Route path="/imoveis" element={<Properties />} />
        <Route path="/permutas" element={<Exchanges />} />
        <Route path="/rede" element={<Network />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/automacao" element={<Automation />} />
        <Route path="/configuracoes" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
