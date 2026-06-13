import { useState, useEffect } from 'react';
import { Bot, MessageCircle, Target, TrendingUp, Zap, Brain, Shield, Activity } from 'lucide-react';

const API = '/api';
function authHeaders(): Record<string, string> { const uid = localStorage.getItem('viva_user_id') || ''; return uid ? { 'x-user-id': uid } : {}; }
async function apiFetch(path: string, opts: RequestInit = {}) {
  const { body, ...rest } = opts;
  const headers = { ...authHeaders(), ...(rest.headers || {}) as Record<string, string> };
  return fetch(`${API}${path}`, { ...rest, headers, body: body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof URLSearchParams) ? JSON.stringify(body) : body });
}

export default function AIAgent() {
  const [aiActive, setAiActive] = useState(true);
  const [autoConfidence, setAutoConfidence] = useState(95);
  const [tab, setTab] = useState<'dashboard' | 'approvals' | 'knowledge'>('dashboard');
  const [approvals, setApprovals] = useState<any[]>([]);

  useEffect(() => {
    apiFetch('/ai/approvals').then(r => r.json()).then(d => setApprovals(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const stats = [
    { label: 'Conversas Ativas', value: '12', icon: MessageCircle, color: 'text-viva-400', bg: 'bg-viva-500/10' },
    { label: 'Atualizações Hoje', value: '8', icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Precisão IA', value: '94%', icon: Brain, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Campos Atualizados', value: '156', icon: Target, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Respostas Geradas', value: '892', icon: Zap, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Pendentes Aprovação', value: approvals.length.toString(), icon: Shield, color: 'text-red-400', bg: 'bg-red-500/10' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-viva-500/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-viva-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-primary">Agente IA</h2>
            <p className="text-xs text-muted">Assistente inteligente automático</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Confiança automática:</span>
            <input type="number" value={autoConfidence} onChange={e => setAutoConfidence(Number(e.target.value))} min={0} max={100} className="input w-16 text-xs text-center" />
            <span className="text-xs text-muted">%</span>
          </div>
          <button onClick={() => setAiActive(!aiActive)} className={`relative w-10 h-5 rounded-full transition-colors ${aiActive ? 'bg-viva-500' : 'bg-white/[0.1]'}`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${aiActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
          <span className="text-xs text-muted">{aiActive ? 'Ativo' : 'Inativo'}</span>
        </div>
      </div>

      <div className="flex gap-1">
        {[
          { id: 'dashboard' as const, label: 'Dashboard', icon: Activity },
          { id: 'approvals' as const, label: 'Aprovações', icon: Shield },
          { id: 'knowledge' as const, label: 'Base de Conhecimento', icon: Brain },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${tab === t.id ? 'bg-viva-500/20 text-viva-400' : 'text-muted hover:text-secondary'}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {stats.map(s => (
              <div key={s.label} className="surface-card p-4">
                <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-2`}>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <p className="text-lg font-bold text-primary">{s.value}</p>
                <p className="text-[10px] text-muted">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="surface-card p-5">
            <h3 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-viva-400" />
              Atividade Recente
            </h3>
            <div className="space-y-3">
              {[
                { action: 'Preço atualizado', detail: 'AP-001 → R$ 350.000 (confiança 98%)', time: '2 min atrás', status: 'auto' },
                { action: 'Status alterado', detail: 'AP-002 → Vendido (confiança 96%)', time: '15 min atrás', status: 'auto' },
                { action: 'Cliente atualizado', detail: 'João Silva → orçamento R$ 500.000 (confiança 82%)', time: '1h atrás', status: 'pending' },
                { action: 'Proprietário respondeu', detail: 'Maria Souza → "Aceito permuta" (confiança 91%)', time: '2h atrás', status: 'auto' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/[0.04] transition-colors">
                  <div className={`w-2 h-2 rounded-full mt-1.5 ${item.status === 'auto' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-primary">{item.action}</p>
                    <p className="text-[10px] text-muted">{item.detail}</p>
                  </div>
                  <span className="text-[9px] text-muted whitespace-nowrap">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'approvals' && (
        <div className="space-y-3">
          {approvals.length === 0 && (
            <div className="text-center py-12">
              <Shield className="w-10 h-10 text-muted mx-auto mb-3" />
              <p className="text-sm text-muted">Nenhuma atualização pendente</p>
              <p className="text-xs text-muted mt-1">Todas as detecções recentes foram automáticas</p>
            </div>
          )}
          {[
            { field: 'Preço', old: 'R$ 320.000', newVal: 'R$ 350.000', msg: '"Aumentei o preço pra 350 mil"', confidence: 97, property: 'AP-001', owner: 'Carlos' },
            { field: 'Status', old: 'Disponível', newVal: 'Vendido', msg: '"Vendi o imóvel semana passada"', confidence: 96, property: 'CS-002', owner: 'Ana' },
          ].map((a, i) => (
            <div key={i} className="surface-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-primary">{a.property}</span>
                    <span className="badge bg-amber-500/10 text-amber-400">{a.field}</span>
                    <span className="text-[10px] text-muted">{a.owner}</span>
                  </div>
                  <p className="text-xs text-muted mb-1">"{a.msg}"</p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted line-through">{a.old}</span>
                    <TrendingUp className="w-3 h-3 text-viva-400" />
                    <span className="font-medium text-viva-400">{a.newVal}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1.5">
                    <Brain className="w-3 h-3 text-amber-400" />
                    <span className="text-[10px] text-muted">Confiança: {a.confidence}%</span>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button className="btn-primary text-xs px-3 py-1.5 rounded-lg">Aprovar</button>
                  <button className="btn-ghost text-xs px-3 py-1.5 rounded-lg">Editar</button>
                  <button className="btn-ghost text-xs px-3 py-1.5 rounded-lg text-red-400">Rejeitar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'knowledge' && (
        <div className="surface-card p-5">
          <h3 className="text-sm font-semibold text-primary mb-4">Base de Conhecimento</h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted mb-1 block">Personalidade da IA</label>
              <select className="select">
                <option>Profissional e direto</option>
                <option>Amigável e casual</option>
                <option>Formal e técnico</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Região de atuação</label>
              <input className="input" defaultValue="Litoral Norte RS" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Instruções personalizadas</label>
              <textarea className="input min-h-[100px] resize-y" defaultValue="Sempre perguntar se tem outros imóveis no litoral. Nunca pressionar por venda. Ser natural e amigável." />
            </div>
            <button className="btn-primary rounded-xl">Salvar Configurações</button>
          </div>
        </div>
      )}
    </div>
  );
}
