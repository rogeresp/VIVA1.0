import { useState, useEffect, useRef } from 'react';
import { Target, Send, Bot, StopCircle, CheckCircle, Clock, MessageCircle, Users, TrendingUp, Square, X } from 'lucide-react';

const API = '/api';
function authHeaders(): Record<string, string> { const uid = localStorage.getItem('viva_user_id') || ''; return uid ? { 'x-user-id': uid } : {}; }
async function apiFetch(path: string, opts: RequestInit = {}) {
  const { body, ...rest } = opts;
  const headers = { ...authHeaders(), ...(rest.headers || {}) as Record<string, string> };
  return fetch(`${API}${path}`, { ...rest, headers, body: body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof URLSearchParams) ? JSON.stringify(body) : body });
}

interface CampaignStatus {
  active: boolean; dailyLimit: number; sentToday: number; totalSent: number; totalContacts: number; remaining: number;
}

const CAMPAIGN_TEMPLATES: Record<string, { id: string; label: string; template: string }[]> = {
  properties: [
    { id: 'atualizacao', label: 'Pedir atualização', template: `Olá {{owner_name}}, tudo bem? 👋\n\nPassando pra saber se o imóvel {{property_code}} ({{property_type}} - {{property_neighborhood}}, {{property_city}}) ainda está disponível e se o valor de {{property_price}} continua o mesmo.\n\nQualquer novidade é só responder! 😊` },
    { id: 'preco', label: 'Revisão do preço', template: `Olá {{owner_name}}! Tudo bem?\n\nGostaria de saber se o valor de {{property_price}} do {{property_code}} continua o mesmo, pois temos clientes interessados.\n\nAguardo seu retorno! 🏠` },
    { id: 'visita', label: 'Visita realizada', template: `Olá {{owner_name}}! Tudo bem?\n\nGostaria de saber se podemos agendar uma visita ao {{property_type}} {{property_code}} na {{property_street}}? Temos clientes interessados! 📅` },
    { id: 'documentacao', label: 'Documentação', template: `Olá {{owner_name}}! Tudo bem?\n\nPrecisamos verificar se a documentação do {{property_code}} está em dia para prosseguir com as negociações.\n\nVocê poderia confirmar? 📋` },
    { id: 'oferta', label: 'Interesse comprador', template: `Olá {{owner_name}}! Tudo bem?\n\nTemos um cliente interessado no {{property_code}}. Podemos conversar sobre os detalhes? 😊` },
  ],
  clients: [
    { id: 'novidades', label: 'Novos imóveis', template: `Olá {{client_name}}! Tudo bem?\n\nTemos novidades! Chegaram novos imóveis que podem se encaixar no seu perfil em {{client_desired_city}}.\n\nGostaria de dar uma olhada? 😊` },
    { id: 'feedback', label: 'Pedir feedback', template: `Olá {{client_name}}! Tudo bem?\n\nPassando pra saber se já visitou algum imóvel recentemente ou se precisa de ajuda com algo.\n\nEstou à disposição! 😊` },
    { id: 'followup', label: 'Follow-up', template: `Olá {{client_name}}! Tudo bem?\n\nAinda está procurando imóvel em {{client_desired_city}}? Temos opções que podem te interessar! 🏠` },
    { id: 'aniversario', label: 'Aniversário', template: `Olá {{client_name}}! 🎉\n\nPassando apenas para desejar um feliz aniversário! Que seu dia seja especial.\n\nSe precisar de algo relacionado a imóveis, estou aqui! 😊` },
  ],
};

export default function Campaigns() {
  const [campaign, setCampaign] = useState<CampaignStatus | null>(null);
  const [campaignTarget, setCampaignTarget] = useState<'properties' | 'clients'>('properties');
  const [campaignTemplate, setCampaignTemplate] = useState('');
  const [campaignDailyLimit, setCampaignDailyLimit] = useState(20);
  const [campaignSelectedTmpl, setCampaignSelectedTmpl] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingAi, setSendingAi] = useState(false);
  const [sendingVaried, setSendingVaried] = useState(false);
  const [selectedProps, setSelectedProps] = useState<any[]>([]);
  const [campaignHistory, setCampaignHistory] = useState<any[]>([]);
  const [liveMessages, setLiveMessages] = useState<any[]>([]);
  const [typingContact, setTypingContact] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState({
    delayMin: 2, delayMax: 7, startHour: 8, endHour: 20,
    simulateTyping: true, randomEmojis: true, randomGreetings: true, randomFarewells: true,
    days: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'],
  });
  const liveEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadCampaign(); loadCampaignHistory(); loadSelectedProps(); }, []);
  useEffect(() => {
    if (!campaign?.active) { setLiveMessages([]); return; }
    const interval = setInterval(async () => {
      try { const res = await apiFetch('/campaign/history?limit=50'); const data = await res.json(); setLiveMessages(Array.isArray(data) ? data.reverse() : []); } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [campaign?.active]);

  useEffect(() => {
    if (!campaign?.active || liveMessages.length === 0) return;
    const last = liveMessages[0];
    if (last && last.status === 'sent') {
      setTypingContact(last.propertyCode || last.to);
      const t = setTimeout(() => setTypingContact(null), 1500);
      return () => clearTimeout(t);
    }
  }, [liveMessages, campaign?.active]);

  async function loadCampaign() {
    try { const res = await apiFetch('/campaign/status'); const data = await res.json(); setCampaign(data); } catch {}
  }

  async function loadCampaignHistory() {
    try { const res = await apiFetch('/campaign/history'); const data = await res.json(); setCampaignHistory(Array.isArray(data) ? data : []); } catch {}
  }

  async function loadSelectedProps() {
    try {
      const stored = localStorage.getItem('campaign_properties');
      const ids: string[] = stored ? JSON.parse(stored) : [];
      if (ids.length === 0) { setSelectedProps([]); return; }
      const res = await apiFetch('/properties/by-ids', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
      const list = await res.json();
      setSelectedProps((Array.isArray(list) ? list : []).map((p: any) => ({ id: p.id, code: p.code, type: p.propertyType, neighborhood: p.neighborhood, city: p.city, status: p.status, price: p.salePrice, building: p.building?.name || '', owner: p.owner?.name || '' })));
    } catch {}
  }

  function removeSelectedProp(id: string) {
    setSelectedProps(prev => prev.filter(p => p.id !== id));
    const stored = JSON.parse(localStorage.getItem('campaign_properties') || '[]');
    localStorage.setItem('campaign_properties', JSON.stringify(stored.filter((x: string) => x !== id)));
  }

  function selectCampaignTemplate(id: string) {
    setCampaignSelectedTmpl(id);
    const t = CAMPAIGN_TEMPLATES[campaignTarget].find(t => t.id === id);
    if (t) setCampaignTemplate(t.template);
  }

  async function startCampaign() {
    if (!campaignTemplate) return;
    setSending(true);
    try {
      const propertyIds = selectedProps.map(p => p.id);
      const res = await apiFetch('/campaign/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template: campaignTemplate, dailyLimit: campaignDailyLimit, propertyIds, target: campaignTarget }) });
      if (!res.ok) { const err = await res.json(); alert(err.error); }
      else { loadCampaign(); }
    } catch (e: any) { alert(e.message); }
    finally { setSending(false); }
  }

  async function startAiCampaign() {
    setSendingAi(true);
    try {
      const stored = localStorage.getItem('campaign_properties');
      const ids: string[] = stored ? JSON.parse(stored) : [];
      const res = await apiFetch('/campaign/ai-start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyIds: ids.length > 0 ? ids : undefined, dailyLimit: campaignDailyLimit, target: campaignTarget }) });
      const data = await res.json();
      if (!res.ok) alert(data.error || 'Erro ao iniciar campanha IA');
      else loadCampaign();
    } catch (e: any) { alert(e.message); }
    finally { setSendingAi(false); }
  }

  async function startVariedCampaign() {
    setSendingVaried(true);
    try {
      const stored = localStorage.getItem('campaign_properties');
      const ids: string[] = stored ? JSON.parse(stored) : [];
      const res = await apiFetch('/campaign/varied-start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyIds: ids.length > 0 ? ids : undefined, dailyLimit: campaignDailyLimit, target: campaignTarget }) });
      const data = await res.json();
      if (!res.ok) alert(data.error || 'Erro ao iniciar campanha variada');
      else loadCampaign();
    } catch (e: any) { alert(e.message); }
    finally { setSendingVaried(false); }
  }

  async function stopCampaign() {
    await apiFetch('/campaign/stop', { method: 'POST' });
    loadCampaign();
  }

  const daysOfWeek = [{ id: 'dom', label: 'Dom' }, { id: 'seg', label: 'Seg' }, { id: 'ter', label: 'Ter' }, { id: 'qua', label: 'Qua' }, { id: 'qui', label: 'Qui' }, { id: 'sex', label: 'Sex' }, { id: 'sab', label: 'Sáb' }];
  const toggleDay = (dayId: string) => {
    setConfig(prev => ({ ...prev, days: prev.days.includes(dayId) ? prev.days.filter(d => d !== dayId) : [...prev.days, dayId] }));
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {campaign && (campaign.active || campaign.totalSent > 0) && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Enviadas', value: campaign.totalSent, icon: Send, color: 'text-viva-400', bg: 'bg-viva-500/10' },
              { label: 'Hoje', value: `${campaign.sentToday}/${campaign.dailyLimit}`, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
              { label: 'Restantes', value: campaign.remaining, icon: Target, color: 'text-blue-400', bg: 'bg-blue-500/10' },
              { label: 'Total', value: campaign.totalContacts, icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/10' },
              { label: 'Progresso', value: `${campaign.totalContacts > 0 ? Math.round((campaign.totalSent / campaign.totalContacts) * 100) : 0}%`, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            ].map(s => (
              <div key={s.label} className="surface-glass p-4 rounded-xl">
                <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-2`}>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <p className="text-xl font-bold text-primary">{s.value}</p>
                <p className="text-[10px] text-muted">{s.label}</p>
              </div>
            ))}
          </div>

          {campaign.totalContacts > 0 && (
            <div className="w-full h-2 bg-white/[0.05] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-viva-500 to-emerald-400 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (campaign.totalSent / campaign.totalContacts) * 100)}%` }} />
            </div>
          )}

          {campaign.active && (
            <div className="surface-card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.02] border-b border-surface-border">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-medium text-primary">Enviando mensagens...</span>
                <span className="text-[10px] text-muted ml-auto">{liveMessages.length} mensagens</span>
              </div>
              <div ref={liveEndRef} className="h-72 overflow-y-auto p-4 space-y-3 bg-[#050e0a]" style={{ scrollBehavior: 'smooth' }}>
                {typingContact && (
                  <div className="flex items-start gap-3 animate-fadeIn">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="bg-white/[0.04] rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[80%]">
                      <p className="text-[10px] text-emerald-400 font-medium mb-1.5">{typingContact}</p>
                      <div className="flex gap-1.5">
                        <span className="w-2 h-2 bg-emerald-400/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-emerald-400/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-emerald-400/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                {liveMessages.slice(0, 50).map((msg: any) => (
                  <div key={msg.id} className="flex items-start gap-3 animate-fadeIn">
                    <div className="w-8 h-8 rounded-full bg-viva-500/20 flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="w-4 h-4 text-viva-400" />
                    </div>
                    <div className="bg-white/[0.06] rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[80%]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-viva-400 font-medium">{msg.propertyCode || msg.to}</span>
                        <span className="text-[9px] text-muted">{new Date(msg.sentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-xs text-secondary leading-relaxed">{msg.content}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <CheckCircle className={`w-2.5 h-2.5 ${msg.status === 'sent' ? 'text-emerald-400' : 'text-muted'}`} />
                        <span className="text-[9px] text-muted">{msg.status === 'sent' ? 'Enviada' : 'Pendente'}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {liveMessages.length === 0 && !typingContact && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Clock className="w-8 h-8 text-muted mx-auto mb-2 animate-pulse" />
                      <p className="text-xs text-muted">Aguardando envios...</p>
                    </div>
                  </div>
                )}
                <div ref={liveEndRef} />
              </div>
              <div className="flex gap-2 p-3 border-t border-surface-border">
                <button onClick={stopCampaign} className="btn-ghost flex-1 justify-center gap-2 rounded-xl text-red-400 hover:text-red-300">
                  <StopCircle className="w-4 h-4" /> Parar
                </button>
              </div>
            </div>
          )}

          {!campaign.active && campaign.totalSent > 0 && (
            <div className="surface-glass p-4 rounded-xl flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span className="text-sm text-emerald-400">Campanha finalizada — {campaign.totalSent} mensagens enviadas</span>
            </div>
          )}
        </>
      )}

      {(!campaign || (!campaign.active && campaign.totalSent === 0)) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {selectedProps.length > 0 && (
              <div className="surface-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-primary">Imóveis Selecionados</h3>
                  <button onClick={() => { setSelectedProps([]); localStorage.removeItem('campaign_properties'); }} className="text-xs text-red-400 hover:underline">Limpar todos</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedProps.map(p => (
                    <div key={p.id} className="surface-glass p-3 rounded-xl flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-primary">{p.code}</span>
                          {p.price && <span className="text-[10px] text-muted">R$ {Number(p.price).toLocaleString('pt-BR')}</span>}
                        </div>
                        <p className="text-[10px] text-muted truncate">{p.neighborhood || p.city}{p.owner ? ` • ${p.owner}` : ''}</p>
                      </div>
                      <button onClick={() => removeSelectedProp(p.id)} className="p-1 rounded hover:bg-red-500/10"><X className="w-3 h-3 text-red-400" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedProps.length === 0 && (
              <div className="surface-glass p-5 rounded-xl flex items-start gap-3">
                <Square className="w-5 h-5 text-muted mt-0.5" />
                <p className="text-xs text-muted">Nenhum imóvel selecionado. A campanha usará <strong className="text-primary">todos</strong> os proprietários com imóveis e telefone. Vá em <strong>Imóveis</strong> e clique no checkbox dos cards para selecionar.</p>
              </div>
            )}

            <div className="surface-glass p-5 rounded-xl border border-emerald-800/30 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary">Campanha Inteligente 🧠</p>
                  <p className="text-xs text-muted">Mensagens variadas com saudação por horário + tom natural + anti-ban</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[10px] text-emerald-400/80 bg-emerald-900/10 rounded-lg p-2">
                <span>✓ 12 variações diferentes</span>
                <span>✓ Saudação por horário</span>
                <span>✓ Só primeiro nome</span>
                <span>✓ Anti-ban ativo</span>
                <span>✓ Emojis leves</span>
                <span>✓ Tom humano</span>
              </div>
              <div className="flex gap-2">
                <button onClick={startVariedCampaign} disabled={sendingVaried} className="btn-primary flex-1 justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl">
                  <Bot className="w-4 h-4" /> {sendingVaried ? 'Iniciando...' : 'Iniciar Campanha Inteligente'}
                </button>
                <button onClick={startAiCampaign} disabled={sendingAi} className="btn-ghost flex-[0.3] justify-center gap-2 text-xs rounded-xl">
                  IA
                </button>
              </div>
            </div>

            <div className="surface-card p-5 space-y-4">
              <div className="flex gap-2">
                <button onClick={() => setCampaignTarget('properties')} className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all ${campaignTarget === 'properties' ? 'bg-viva-500/20 text-viva-400 border border-viva-500/30' : 'bg-white/[0.04] text-muted hover:text-secondary'}`}>Proprietários</button>
                <button onClick={() => setCampaignTarget('clients')} className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all ${campaignTarget === 'clients' ? 'bg-viva-500/20 text-viva-400 border border-viva-500/30' : 'bg-white/[0.04] text-muted hover:text-secondary'}`}>Clientes</button>
              </div>

              <div>
                <label className="text-xs text-muted mb-2 block">Modelo de mensagem</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {CAMPAIGN_TEMPLATES[campaignTarget].map(t => (
                    <button key={t.id} onClick={() => selectCampaignTemplate(t.id)} className={`text-left px-3 py-2 rounded-lg text-xs transition-all ${campaignSelectedTmpl === t.id ? 'bg-viva-500/20 text-viva-400 border border-viva-500/30' : 'bg-white/[0.04] text-muted hover:text-secondary border border-transparent'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted mb-1 block">Mensagem <span className="text-[10px] text-muted">{'{use {{greeting}}, {{owner_name}}, {{property_code}} etc}'}</span></label>
                <textarea value={campaignTemplate} onChange={e => { setCampaignTemplate(e.target.value); setCampaignSelectedTmpl(''); }} rows={5} className="input w-full text-xs font-mono resize-none" placeholder="Digite a mensagem com {{variaveis}}..." />
              </div>

              <div className="flex items-center justify-between">
                <button onClick={() => setShowConfig(!showConfig)} className="text-xs text-viva-500 hover:underline">Configurações avançadas</button>
              </div>

              {showConfig && (
                <div className="space-y-3 p-4 surface-glass rounded-xl">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-[10px] text-muted block mb-1">Delay mínimo (s)</label><input type="number" value={config.delayMin} onChange={e => setConfig(p => ({ ...p, delayMin: Number(e.target.value) }))} className="input" /></div>
                    <div><label className="text-[10px] text-muted block mb-1">Delay máximo (s)</label><input type="number" value={config.delayMax} onChange={e => setConfig(p => ({ ...p, delayMax: Number(e.target.value) }))} className="input" /></div>
                    <div><label className="text-[10px] text-muted block mb-1">Horário início</label><input type="number" value={config.startHour} onChange={e => setConfig(p => ({ ...p, startHour: Number(e.target.value) }))} className="input" /></div>
                    <div><label className="text-[10px] text-muted block mb-1">Horário fim</label><input type="number" value={config.endHour} onChange={e => setConfig(p => ({ ...p, endHour: Number(e.target.value) }))} className="input" /></div>
                  </div>
                  <div><label className="text-[10px] text-muted block mb-1">Dias permitidos</label><div className="flex gap-1">{daysOfWeek.map(d => <button key={d.id} onClick={() => toggleDay(d.id)} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${config.days.includes(d.id) ? 'bg-viva-500/20 text-viva-400' : 'bg-white/[0.04] text-muted'}`}>{d.label}</button>)}</div></div>
                  <div className="flex items-center gap-2"><input type="checkbox" checked={config.simulateTyping} onChange={e => setConfig(p => ({ ...p, simulateTyping: e.target.checked }))} className="checkbox-viva" /><span className="text-xs text-muted">Digitação simulada</span></div>
                  <div className="flex items-center gap-2"><input type="checkbox" checked={config.randomEmojis} onChange={e => setConfig(p => ({ ...p, randomEmojis: e.target.checked }))} className="checkbox-viva" /><span className="text-xs text-muted">Emojis aleatórios</span></div>
                  <div className="flex items-center gap-2"><input type="checkbox" checked={config.randomGreetings} onChange={e => setConfig(p => ({ ...p, randomGreetings: e.target.checked }))} className="checkbox-viva" /><span className="text-xs text-muted">Saudações aleatórias</span></div>
                  <div className="flex items-center gap-2"><input type="checkbox" checked={config.randomFarewells} onChange={e => setConfig(p => ({ ...p, randomFarewells: e.target.checked }))} className="checkbox-viva" /><span className="text-xs text-muted">Despedidas aleatórias</span></div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-xs text-muted mb-1 block">Limite diário (recomendado: 20-30)</label>
                  <input type="number" value={campaignDailyLimit} onChange={e => setCampaignDailyLimit(Number(e.target.value))} min={1} max={50} className="input w-32" />
                </div>
                <button onClick={startCampaign} disabled={sending || !campaignTemplate} className="btn-primary gap-2 rounded-xl disabled:opacity-50">
                  <Send className="w-4 h-4" /> {sending ? 'Iniciando...' : 'Iniciar Campanha'}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {['24', '18', '6'].map((val, i) => (
              <div key={i} className="surface-glass p-4 rounded-xl text-center">
                <p className="text-2xl font-bold text-primary">{val}</p>
                <p className="text-xs text-muted">{['Campanhas Ativas', 'Mensagens Hoje', 'Taxa Resposta'][i]}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="surface-card p-5">
        <h3 className="text-sm font-semibold text-primary mb-3">Histórico de Campanha</h3>
        {campaignHistory.length === 0 ? (
          <p className="text-xs text-muted text-center py-6">Nenhum envio de campanha ainda</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {campaignHistory.map((h: any) => (
              <div key={h.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-white/[0.04] transition-colors">
                <MessageCircle className="w-4 h-4 mt-0.5 text-muted flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs"><span className="font-medium text-secondary">{h.propertyCode || h.to}</span><span className="text-muted">{new Date(h.sentAt).toLocaleString('pt-BR')}</span></div>
                  <p className="text-xs text-muted truncate mt-0.5">{h.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
