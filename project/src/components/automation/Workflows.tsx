import { useState, useEffect } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, Bot, ArrowDown, Zap, Filter, MessageCircle, Tag, Bell, Calendar, Mail, ExternalLink, CheckCircle } from 'lucide-react';

const API = '/api';
function authHeaders(): Record<string, string> { const uid = localStorage.getItem('viva_user_id') || ''; return uid ? { 'x-user-id': uid } : {}; }
async function apiFetch(path: string, opts: RequestInit = {}) {
  const { body, ...rest } = opts;
  const headers = { ...authHeaders(), ...(rest.headers || {}) as Record<string, string> };
  return fetch(`${API}${path}`, { ...rest, headers, body: body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof URLSearchParams) ? JSON.stringify(body) : body });
}

interface Rule {
  id: string; userId: string; trigger: string; action: string; target: string; template: string; active: boolean; createdAt: string;
}

const TRIGGERS = [
  { value: 'property_created', label: 'Imóvel criado', icon: Bot },
  { value: 'property_status_changed', label: 'Imóvel atualizado', icon: ArrowDown },
  { value: 'client_created', label: 'Cliente criado', icon: Bot },
  { value: 'client_funil_changed', label: 'Funil alterado', icon: Filter },
  { value: 'lead_converted', label: 'Lead convertido', icon: Zap },
  { value: 'visit_scheduled', label: 'Visita marcada', icon: Calendar },
  { value: 'contract_signed', label: 'Contrato assinado', icon: CheckCircle },
];

const ACTIONS = [
  { value: 'send_whatsapp', label: 'Enviar WhatsApp', icon: MessageCircle },
  { value: 'send_email', label: 'Enviar Email', icon: Mail },
  { value: 'create_task', label: 'Criar tarefa', icon: CheckCircle },
  { value: 'create_reminder', label: 'Criar lembrete', icon: Bell },
  { value: 'add_tag', label: 'Adicionar etiqueta', icon: Tag },
  { value: 'notify_broker', label: 'Notificar corretor', icon: Bell },
];

const TARGETS = [
  { value: 'owner', label: 'Proprietário' },
  { value: 'client', label: 'Cliente' },
];

const TEMPLATES: Record<string, string> = {
  property_created_owner: `Olá {{owner_name}}! Seu imóvel {{property_code}} ({{property_type}} em {{property_neighborhood}}, {{property_city}}) já está cadastrado.\nValor: {{property_price}}\nQualquer novidade avisamos por aqui! 🏠`,
  property_status_changed_owner: `Olá {{owner_name}}! O status do seu imóvel {{property_code}} foi atualizado para: {{property_status}}.\nValor: {{property_price}}\nEstamos trabalhando para encontrar o melhor comprador! 💪`,
  client_created_client: `Olá {{client_name}}! Recebemos seu cadastro.\nJá estamos de olho em imóveis em {{client_desired_city}}.\nOrçamento: {{client_budget}}\nAssim que surgir uma oportunidade, entramos em contato! 😊`,
};

const VAR_INFO: Record<string, string[]> = {
  property_created_owner: ['owner_name', 'property_code', 'property_type', 'property_neighborhood', 'property_city', 'property_price', 'property_status'],
  property_status_changed_owner: ['owner_name', 'property_code', 'property_type', 'property_neighborhood', 'property_city', 'property_price', 'property_status'],
  client_created_client: ['client_name', 'client_phone', 'client_city', 'client_desired_city', 'client_budget', 'client_funil'],
  client_funil_changed_client: ['client_name', 'client_phone', 'client_city', 'client_desired_city', 'client_budget', 'client_funil'],
};

export default function Workflows() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [showNewRule, setShowNewRule] = useState(false);
  const [newRule, setNewRule] = useState({ trigger: 'property_created', action: 'send_whatsapp', target: 'owner', template: '' });
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  useEffect(() => { loadRules(); }, []);

  async function loadRules() {
    try { const res = await apiFetch('/automation/rules'); const data = await res.json(); setRules(data); } catch {}
  }

  async function createRule() {
    try {
      const res = await apiFetch('/automation/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newRule) });
      if (res.ok) { setShowNewRule(false); setNewRule({ trigger: 'property_created', action: 'send_whatsapp', target: 'owner', template: '' }); loadRules(); }
    } catch {}
  }

  async function updateRule(id: string, data: any) {
    try { await apiFetch(`/automation/rules/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); loadRules(); } catch {}
  }

  async function toggleRule(rule: Rule) { await updateRule(rule.id, { active: !rule.active }); }
  async function deleteRule(id: string) { if (!confirm('Excluir esta regra?')) return; try { await apiFetch(`/automation/rules/${id}`, { method: 'DELETE' }); loadRules(); } catch {} }

  function selectTemplate(trigger: string, target: string) {
    const key = `${trigger}_${target}`;
    if (TEMPLATES[key]) setNewRule(r => ({ ...r, template: TEMPLATES[key] }));
  }

  function handleEditRule(rule: Rule) {
    setEditingRuleId(rule.id);
    setNewRule({ trigger: rule.trigger, action: rule.action, target: rule.target, template: rule.template });
    setShowNewRule(true);
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{rules.length} workflow(s) configurado(s)</p>
        <button onClick={() => { setShowNewRule(true); setEditingRuleId(null); setNewRule({ trigger: 'property_created', action: 'send_whatsapp', target: 'owner', template: '' }); }} className="btn-primary gap-2 rounded-xl">
          <Plus className="w-4 h-4" /> Novo Workflow
        </button>
      </div>

      {showNewRule && (
        <div className="surface-card p-6 space-y-5 animate-slideDown">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-viva-500/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-viva-400" />
            </div>
            <h3 className="text-sm font-semibold text-primary">{editingRuleId ? 'Editar Workflow' : 'Novo Workflow'}</h3>
          </div>

          <div className="space-y-4">
            <div className="surface-glass p-4 rounded-xl">
              <label className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-2 block">Evento</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {TRIGGERS.map(t => (
                  <button key={t.value} onClick={() => setNewRule(r => ({ ...r, trigger: t.value }))} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${newRule.trigger === t.value ? 'bg-viva-500/20 text-viva-400 border border-viva-500/30' : 'bg-white/[0.04] text-muted hover:text-secondary border border-transparent'}`}>
                    <t.icon className="w-3.5 h-3.5" /> {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-white/[0.04] flex items-center justify-center"><ArrowDown className="w-4 h-4 text-muted" /></div>
            </div>

            <div className="surface-glass p-4 rounded-xl">
              <label className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-2 block">Ação</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {ACTIONS.map(a => (
                  <button key={a.value} onClick={() => setNewRule(r => ({ ...r, action: a.value }))} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${newRule.action === a.value ? 'bg-viva-500/20 text-viva-400 border border-viva-500/30' : 'bg-white/[0.04] text-muted hover:text-secondary border border-transparent'}`}>
                    <a.icon className="w-3.5 h-3.5" /> {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-white/[0.04] flex items-center justify-center"><ArrowDown className="w-4 h-4 text-muted" /></div>
            </div>

            <div className="surface-glass p-4 rounded-xl">
              <label className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-2 block">Enviar para</label>
              <div className="flex gap-2">
                {TARGETS.map(t => (
                  <button key={t.value} onClick={() => { setNewRule(r => ({ ...r, target: t.value })); selectTemplate(newRule.trigger, t.value); }} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${newRule.target === t.value ? 'bg-viva-500/20 text-viva-400 border border-viva-500/30' : 'bg-white/[0.04] text-muted hover:text-secondary'}`}>{t.label}</button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-muted">Modelo de mensagem</label>
              <button onClick={() => selectTemplate(newRule.trigger, newRule.target)} className="text-xs text-viva-500 hover:underline">Usar sugestão</button>
            </div>
            <textarea value={newRule.template} onChange={e => setNewRule(r => ({ ...r, template: e.target.value }))} className="input min-h-[120px] resize-y font-mono text-xs" placeholder="Digite a mensagem... Use {{variavel}} para personalizar" />
            <div className="mt-2 flex flex-wrap gap-1">
              {(VAR_INFO[`${newRule.trigger}_${newRule.target}`] || ['owner_name', 'client_name', 'property_code', 'property_price']).map(v => (
                <button key={v} onClick={() => setNewRule(r => ({ ...r, template: r.template + `{{${v}}} ` }))} className="chip">{`{{${v}}}`}</button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={createRule} className="btn-primary flex-1 justify-center rounded-xl">{editingRuleId ? 'Salvar' : 'Criar Workflow'}</button>
            <button onClick={() => setShowNewRule(false)} className="btn-ghost rounded-xl">Cancelar</button>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {rules.map(rule => {
          const triggerInfo = TRIGGERS.find(t => t.value === rule.trigger);
          const targetLabel = TARGETS.find(t => t.value === rule.target)?.label || rule.target;
          return (
            <div key={rule.id} className={`surface-card p-4 transition-all hover:translate-y-[-1px] ${!rule.active ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-xl ${rule.active ? 'bg-viva-500/20' : 'bg-white/[0.04]'} flex items-center justify-center flex-shrink-0`}>
                    {triggerInfo ? <triggerInfo.icon className={`w-5 h-5 ${rule.active ? 'text-viva-400' : 'text-muted'}`} /> : <Zap className={`w-5 h-5 ${rule.active ? 'text-viva-400' : 'text-muted'}`} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium ${rule.active ? 'text-viva-400' : 'text-muted'}`}>{triggerInfo?.label || rule.trigger}</span>
                      <ArrowDown className="w-3 h-3 text-muted" />
                      <span className="text-xs font-medium text-secondary">{targetLabel}</span>
                    </div>
                    <p className="text-xs text-muted line-clamp-2 font-mono">{rule.template}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => handleEditRule(rule)} className="p-1.5 rounded-lg hover:bg-white/[0.04]"><ExternalLink className="w-4 h-4 text-muted" /></button>
                  <button onClick={() => toggleRule(rule)} className="p-1.5 rounded-lg hover:bg-white/[0.04]">
                    {rule.active ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-muted" />}
                  </button>
                  <button onClick={() => deleteRule(rule.id)} className="p-1.5 rounded-lg hover:bg-white/[0.04]"><Trash2 className="w-4 h-4 text-red-400" /></button>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3 text-[10px] text-muted">
                <span>Criado: {new Date(rule.createdAt).toLocaleDateString('pt-BR')}</span>
                {rule.active && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Ativo</span>}
              </div>
            </div>
          );
        })}
        {rules.length === 0 && !showNewRule && (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
              <Bot className="w-7 h-7 text-muted" />
            </div>
            <p className="text-sm text-muted">Nenhum workflow configurado</p>
            <p className="text-xs text-muted mt-1">Crie fluxos para automatizar disparos de mensagens</p>
            <button onClick={() => setShowNewRule(true)} className="btn-primary gap-2 rounded-xl mt-4"><Plus className="w-4 h-4" /> Criar Workflow</button>
          </div>
        )}
      </div>
    </div>
  );
}
