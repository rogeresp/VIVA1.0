import { useState } from 'react';
import { Bot, Lightbulb, TrendingUp, AlertTriangle, Home, Users, Target, ArrowRight, Zap } from 'lucide-react';

export default function AICenter() {
  const suggestions = [
    { type: 'warning', icon: AlertTriangle, title: 'Imóveis desatualizados', desc: '5 imóveis sem atualização há mais de 90 dias', action: 'Iniciar campanha' },
    { type: 'info', icon: Users, title: 'Clientes frios', desc: '12 clientes sem contato há mais de 60 dias', action: 'Criar follow-up' },
    { type: 'success', icon: Home, title: 'Preços acima do mercado', desc: '3 imóveis com preço acima da média da região', action: 'Sugerir redução' },
    { type: 'warning', icon: Target, title: 'Campanhas inativas', desc: 'Nenhuma campanha ativa nos últimos 7 dias', action: 'Criar campanha' },
    { type: 'info', icon: Lightbulb, title: 'Oportunidades detectadas', desc: '2 clientes com orçamento compatível com imóveis recentes', action: 'Ver matches' },
  ];

  const opportunities = [
    { client: 'João Silva', budget: 450000, property: 'AP-045', price: 420000, match: 92, city: 'Capão da Canoa' },
    { client: 'Maria Souza', budget: 320000, property: 'CS-012', price: 300000, match: 87, city: 'Xangri-lá' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
          <BrainIcon className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-primary">Central de Inteligência</h2>
          <p className="text-xs text-muted">Análise contínua do CRM com sugestões inteligentes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Sugestões Inteligentes
          </h3>
          {suggestions.map((s, i) => (
            <div key={i} className={`surface-card p-4 border-l-2 ${s.type === 'warning' ? 'border-amber-500' : s.type === 'success' ? 'border-emerald-500' : 'border-viva-500'}`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg ${s.type === 'warning' ? 'bg-amber-500/10' : s.type === 'success' ? 'bg-emerald-500/10' : 'bg-viva-500/10'} flex items-center justify-center flex-shrink-0`}>
                  <s.icon className={`w-4 h-4 ${s.type === 'warning' ? 'text-amber-400' : s.type === 'success' ? 'text-emerald-400' : 'text-viva-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-primary">{s.title}</p>
                  <p className="text-[10px] text-muted">{s.desc}</p>
                </div>
                <button className="btn-ghost text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap">
                  {s.action} <ArrowRight className="w-3 h-3 ml-1" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            Oportunidades Automáticas
          </h3>
          {opportunities.map((o, i) => (
            <div key={i} className="surface-card p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-primary">{o.client}</span>
                    <span className="badge bg-emerald-500/10 text-emerald-400">{o.match}% match</span>
                  </div>
                  <p className="text-[10px] text-muted">
                    Orçamento: R$ {o.budget.toLocaleString('pt-BR')} → {o.property} (R$ {o.price.toLocaleString('pt-BR')})
                  </p>
                  <p className="text-[10px] text-muted">{o.city}</p>
                </div>
                <button className="btn-primary text-xs px-3 py-1.5 rounded-lg whitespace-nowrap">
                  <Zap className="w-3 h-3 mr-1" /> Match
                </button>
              </div>
            </div>
          ))}

          <div className="surface-glass p-4 rounded-xl">
            <h4 className="text-xs font-medium text-primary mb-3">Score de Venda</h4>
            <div className="space-y-2">
              {[
                { property: 'AP-001', score: 85, price: 320000, daysOnMarket: 45 },
                { property: 'CS-002', score: 72, price: 280000, daysOnMarket: 120 },
                { property: 'TE-003', score: 45, price: 150000, daysOnMarket: 200 },
              ].map((p, i) => (
                <div key={i} className="flex items-center gap-3 py-1.5">
                  <span className="text-xs text-primary w-14">{p.property}</span>
                  <div className="flex-1 h-2 bg-white/[0.05] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${p.score > 70 ? 'bg-emerald-400' : p.score > 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${p.score}%` }} />
                  </div>
                  <span className="text-xs font-medium text-primary w-8 text-right">{p.score}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BrainIcon(props: any) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4a4 4 0 0 1 3.5 6A4 4 0 1 1 12 4z" />
      <path d="M12 20c-2 0-4-1-4-3 0-1.5 1-2.5 2-3" />
      <path d="M12 20c2 0 4-1 4-3 0-1.5-1-2.5-2-3" />
      <path d="M4 12c0-2 1-4 3-4 1.5 0 2.5 1 3 2" />
      <path d="M20 12c0-2-1-4-3-4-1.5 0-2.5 1-3 2" />
      <path d="M9 17c-1 1-2 2-2 3 0 1.5 1 2 3 2" />
      <path d="M15 17c1 1 2 2 2 3 0 1.5-1 2-3 2" />
    </svg>
  );
}
