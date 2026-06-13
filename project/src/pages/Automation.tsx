import { useState } from 'react';
import { Bot, Smartphone, Zap, Send, Target, MessageCircle, Clock, TrendingUp, Brain, Lightbulb, ChevronLeft, ChevronRight } from 'lucide-react';
import Connection from '../components/automation/Connection';
import Workflows from '../components/automation/Workflows';
import ManualSend from '../components/automation/ManualSend';
import Campaigns from '../components/automation/Campaigns';
import Inbox from '../components/automation/Inbox';
import History from '../components/automation/History';
import Analytics from '../components/automation/Analytics';
import AIAgent from '../components/automation/AIAgent';
import AICenter from '../components/automation/AICenter';

const MODULES = [
  { id: 'conexao', label: 'Conexão', icon: Smartphone, desc: 'WhatsApp' },
  { id: 'workflows', label: 'Workflows', icon: Zap, desc: 'Automações' },
  { id: 'enviar', label: 'Envio Manual', icon: Send, desc: 'Mensagens' },
  { id: 'campanhas', label: 'Campanhas', icon: Target, desc: 'Disparos' },
  { id: 'inbox', label: 'Caixa de Entrada', icon: MessageCircle, desc: 'Conversas' },
  { id: 'historico', label: 'Histórico', icon: Clock, desc: 'Log' },
  { id: 'analytics', label: 'Analytics', icon: TrendingUp, desc: 'Métricas' },
  { id: 'agente-ia', label: 'Agente IA', icon: Brain, desc: 'Inteligência' },
  { id: 'central-ia', label: 'Central IA', icon: Lightbulb, desc: 'Insights' },
];

export default function Automation() {
  const [activeModule, setActiveModule] = useState('conexao');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const renderModule = () => {
    switch (activeModule) {
      case 'conexao': return <Connection />;
      case 'workflows': return <Workflows />;
      case 'enviar': return <ManualSend />;
      case 'campanhas': return <Campaigns />;
      case 'inbox': return <Inbox />;
      case 'historico': return <History />;
      case 'analytics': return <Analytics />;
      case 'agente-ia': return <AIAgent />;
      case 'central-ia': return <AICenter />;
      default: return <Connection />;
    }
  };

  const currentModule = MODULES.find(m => m.id === activeModule);

  return (
    <div className="flex h-full overflow-hidden">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed bottom-6 left-6 z-20 w-10 h-10 rounded-full bg-viva-500 text-white flex items-center justify-center shadow-premium-lg"
      >
        {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </button>

      {sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-10 lg:hidden" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed left-0 top-0 h-full z-20 lg:static lg:z-0 w-56 lg:w-56 shrink-0 bg-surface-card border-r border-surface-border flex flex-col animate-fadeIn lg:animate-none">
            <div className="p-4 border-b border-surface-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-viva-500/20 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-viva-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-primary">Automação</h2>
                  <p className="text-[10px] text-muted">{MODULES.length} módulos</p>
                </div>
              </div>
            </div>
            <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {MODULES.map(mod => {
                const Icon = mod.icon;
                const isActive = activeModule === mod.id;
                return (
                  <button
                    key={mod.id}
                    onClick={() => { setActiveModule(mod.id); setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                      isActive
                        ? 'bg-viva-500 text-white shadow-premium-md'
                        : 'text-[#9b99a0] hover:text-[#e8e6e3] hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.6} />
                    <div className="text-left min-w-0">
                      <p className="text-[13px] font-medium truncate leading-tight">{mod.label}</p>
                      <p className={`text-[9px] truncate leading-tight ${isActive ? 'text-white/70' : 'text-[#636670]'}`}>{mod.desc}</p>
                    </div>
                  </button>
                );
              })}
            </nav>
            <div className="p-3 border-t border-surface-border">
              <div className="surface-glass rounded-xl p-3">
                <p className="text-[10px] text-muted text-center">VIVA Automation v2.0</p>
              </div>
            </div>
          </aside>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-surface-border bg-surface-card/50 backdrop-blur-sm">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 rounded-lg hover:bg-white/[0.04]">
            <Bot className="w-5 h-5 text-muted" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-viva-500/20 flex items-center justify-center">
              {currentModule && <currentModule.icon className="w-4 h-4 text-viva-400" />}
            </div>
            <div>
              <h1 className="text-sm font-semibold text-primary">{currentModule?.label || 'Automação'}</h1>
              <p className="text-[10px] text-muted">{currentModule?.desc || ''}</p>
            </div>
          </div>
          <div className="flex-1" />
          <div className="flex gap-1">
            {MODULES.slice(0, 5).map(mod => (
              <button
                key={mod.id}
                onClick={() => setActiveModule(mod.id)}
                className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                  activeModule === mod.id ? 'bg-viva-500/20 text-viva-400' : 'text-muted hover:text-secondary hover:bg-white/[0.04]'
                }`}
              >
                <mod.icon className="w-3 h-3" />
                {mod.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {renderModule()}
        </div>
      </div>
    </div>
  );
}
