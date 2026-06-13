import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Bot, Wifi, WifiOff, QrCode, Plus, Trash2, Send, MessageCircle, Clock, CheckCircle, XCircle, Database, Smartphone, ToggleLeft, ToggleRight, RefreshCw, User, Users, Play, StopCircle, Target, MessageSquare, CheckSquare, Square, X } from 'lucide-react';

const API = '/api';

function authHeaders(): Record<string, string> {
  const uid = localStorage.getItem('viva_user_id') || '';
  return uid ? { 'x-user-id': uid } : {};
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = { ...authHeaders(), ...(options.headers as Record<string, string> || {}) };
  return fetch(`${API}${path}`, { ...options, headers });
}

interface Rule {
  id: string;
  userId: string;
  trigger: string;
  action: string;
  target: string;
  template: string;
  active: boolean;
  createdAt: string;
}

interface WaMessage {
  id: string;
  to: string;
  content: string;
  status: string;
  trigger: string | null;
  sentAt: string;
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  type: 'owner' | 'client';
}

interface CampaignStatus {
  active: boolean;
  dailyLimit: number;
  sentToday: number;
  totalSent: number;
  totalContacts: number;
  remaining: number;
}

const TRIGGERS = [
  { value: 'property_created', label: 'Imóvel cadastrado' },
  { value: 'property_status_changed', label: 'Status do imóvel alterado' },
  { value: 'client_created', label: 'Cliente cadastrado' },
  { value: 'client_funil_changed', label: 'Funil do cliente alterado' },
];

const TARGETS = [
  { value: 'owner', label: 'Proprietário' },
  { value: 'client', label: 'Cliente' },
];

const TEMPLATES: Record<string, string> = {
  property_created_owner: `Olá {{owner_name}}! Seu imóvel {{property_code}} ({{property_type}} em {{property_neighborhood}}, {{property_city}}) já está cadastrado em nosso sistema. 
Valor: {{property_price}}
Qualquer novidade avisamos por aqui! 🏠`,
  property_status_changed_owner: `Olá {{owner_name}}! O status do seu imóvel {{property_code}} ({{property_type}} - {{property_neighborhood}}) foi atualizado para: {{property_status}}.
Valor: {{property_price}}
Estamos trabalhando para encontrar o melhor comprador! 💪`,
  client_created_client: `Olá {{client_name}}! Recebemos seu cadastro em nosso sistema. 
Já estamos de olho em imóveis que atendam suas preferências em {{client_desired_city}}.
Orçamento: {{client_budget}}
Assim que surgir uma oportunidade, entramos em contato! 😊`,
};

const CAMPAIGN_TEMPLATES: Record<string, { id: string; label: string; template: string }[]> = {
  properties: [
    {
      id: 'atualizacao',
      label: 'Pedir atualização',
      template: `Olá {{owner_name}}, tudo bem? 👋

Passando pra saber se o imóvel {{property_code}} ({{property_type}} - {{property_neighborhood}}, {{property_city}}) ainda está disponível e se o valor de {{property_price}} continua o mesmo.

Qualquer novidade é só responder essa mensagem que eu já atualizo aqui! 😊`,
    },
    {
      id: 'visita',
      label: 'Visita / disponibilidade',
      template: `Olá {{owner_name}}! Tudo bem?

Gostaria de saber se podemos agendar uma visita ao {{property_type}} {{property_code}} na {{property_street}} {{property_building}} {{property_unit}}?

Temos alguns clientes interessados! 📅`,
    },
    {
      id: 'documentacao',
      label: 'Documentação',
      template: `Olá {{owner_name}}! Tudo bem?

Precisamos verificar se a documentação do {{property_code}} ({{property_building}} - {{property_unit}}) está em dia para prosseguir com as negociações.

Você poderia confirmar se está tudo certo? 📋`,
    },
  ],
  clients: [
    {
      id: 'atualizar_funil',
      label: 'Atualizar funil',
      template: `Olá {{client_name}}, tudo bem? 👋

Passando pra saber se ainda está procurando imóvel em {{client_desired_city}} com orçamento de {{client_budget}}.

Ainda está interessado? Posso te ajudar a encontrar o imóvel ideal! 🏠`,
    },
    {
      id: 'novidades',
      label: 'Novidades',
      template: `Olá {{client_name}}! Tudo bem?

Temos novidades! Chegaram novos imóveis que podem se encaixar no seu perfil em {{client_desired_city}}.

Gostaria de dar uma olhada? 😊`,
    },
    {
      id: 'feedback',
      label: 'Pedir feedback',
      template: `Olá {{client_name}}! Tudo bem?

Passando pra saber se já visitou algum imóvel recentemente ou se precisa de ajuda com algo.

Estou à disposição! 😊`,
    },
  ],
};

const VAR_INFO: Record<string, string[]> = {
  property_created_owner: ['owner_name', 'property_code', 'property_type', 'property_neighborhood', 'property_city', 'property_price', 'property_status'],
  property_status_changed_owner: ['owner_name', 'property_code', 'property_type', 'property_neighborhood', 'property_city', 'property_price', 'property_status'],
  client_created_client: ['client_name', 'client_phone', 'client_city', 'client_desired_city', 'client_budget', 'client_funil'],
  client_funil_changed_client: ['client_name', 'client_phone', 'client_city', 'client_desired_city', 'client_budget', 'client_funil'],
};

export default function Automation() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [waStatus, setWaStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [replies, setReplies] = useState<WaMessage[]>([]);
  const [showNewRule, setShowNewRule] = useState(false);
  const [newRule, setNewRule] = useState({ trigger: 'property_created', action: 'send_whatsapp', target: 'owner', template: '' });
  const [activeTab, setActiveTab] = useState('conexao');
  const [sending, setSending] = useState(false);
  const [sendPhone, setSendPhone] = useState('');
  const [sendText, setSendText] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [contactFilter, setContactFilter] = useState<'all' | 'owner' | 'client'>('all');
  const [contactSearch, setContactSearch] = useState('');
  const [loadAll, setLoadAll] = useState(false);

  // Campaign state
  const [campaign, setCampaign] = useState<CampaignStatus | null>(null);
  const [campaignTemplate, setCampaignTemplate] = useState('');
  const [campaignDailyLimit, setCampaignDailyLimit] = useState(20);
  const [campaignTarget, setCampaignTarget] = useState<'properties' | 'clients'>('properties');
  const [campaignSelectedTmpl, setCampaignSelectedTmpl] = useState('');
  const [campaignHistory, setCampaignHistory] = useState<any[]>([]);
  const [selectedProps, setSelectedProps] = useState<any[]>([]);
  const [sendingAi, setSendingAi] = useState(false);
  const [liveMessages, setLiveMessages] = useState<any[]>([]);
  const [typingContact, setTypingContact] = useState<string | null>(null);
  const liveEndRef = useRef<HTMLDivElement>(null);
  const liveContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => { loadRules(); loadMessages(); loadReplies(); loadCampaign(); loadCampaignHistory(); }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  // eslint-disable-next-line
  }, [searchParams]);

  useEffect(() => {
    if (activeTab === 'campanha') loadSelectedProps();
  }, [activeTab]);

  // Live campaign polling
  useEffect(() => {
    if (!campaign?.active) { setLiveMessages([]); return; }
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`/campaign/history?limit=50`);
        const data = await res.json();
        setLiveMessages(Array.isArray(data) ? data.reverse() : []);
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [campaign?.active]);

  // Auto scroll on new messages
  useEffect(() => {
    if (liveContainerRef.current) {
      liveContainerRef.current.scrollTop = liveContainerRef.current.scrollHeight;
    }
  }, [liveMessages]);

  // Simulate typing before each new message
  useEffect(() => {
    if (!campaign?.active || liveMessages.length === 0) return;
    const last = liveMessages[0];
    if (last && last.status === 'sent') {
      setTypingContact(last.propertyCode || last.to);
      const t = setTimeout(() => setTypingContact(null), 1500);
      return () => clearTimeout(t);
    }
  }, [liveMessages, campaign?.active]);

  async function checkStatus() {
    try {
      const res = await apiFetch(`/whatsapp/status`);
      const data = await res.json();
      setWaStatus(data.status);
      if (data.status === 'connecting' && data.hasQr) {
        // Try to get existing QR code
        const qrRes = await apiFetch(`/whatsapp/qr`);
        const qrData = await qrRes.json();
        if (qrData.qr) setQrCode(qrData.qr);
      }
    } catch {}
  }

  async function connect() {
    setWaStatus('connecting');
    setQrCode(null);
    try {
      const res = await apiFetch(`/whatsapp/connect`, { method: 'POST' });
      const data = await res.json();
      if (data.qr) setQrCode(data.qr);
      setWaStatus(data.status);
      if (data.status === 'connected') setQrCode(null);
      if (data.status === 'connecting' && data.qr) {
        const interval = setInterval(async () => {
          const r = await apiFetch(`/whatsapp/status`);
          const s = await r.json();
          if (s.status === 'connected') {
            setWaStatus('connected');
            setQrCode(null);
            clearInterval(interval);
          }
        }, 2000);
        setTimeout(() => clearInterval(interval), 120000);
      }
    } catch { setWaStatus('disconnected'); }
  }

  async function loadRules() {
    try {
      const res = await apiFetch(`/automation/rules`);
      const data = await res.json();
      setRules(data);
    } catch {}
  }

  async function loadMessages() {
    try {
      const res = await apiFetch(`/whatsapp/messages`);
      const data = await res.json();
      setMessages(data);
    } catch {}
  }

  async function loadReplies() {
    try {
      const res = await apiFetch(`/whatsapp/replies`);
      const data = await res.json();
      setReplies(data);
    } catch {}
  }

  async function loadCampaign() {
    try {
      const res = await apiFetch(`/campaign/status`);
      const data = await res.json();
      setCampaign(data);
    } catch {}
  }

  async function loadCampaignHistory() {
    try {
      const res = await apiFetch(`/campaign/history`);
      const data = await res.json();
      setCampaignHistory(Array.isArray(data) ? data : []);
    } catch {}
  }

  async function loadSelectedProps() {
    try {
      const stored = localStorage.getItem('campaign_properties');
      const ids: string[] = stored ? JSON.parse(stored) : [];
      if (ids.length === 0) { setSelectedProps([]); return; }
      const res = await apiFetch(`/properties/by-ids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const list = await res.json();
      const filtered = (Array.isArray(list) ? list : [])
        .map((p: any) => ({
          id: p.id,
          code: p.code,
          type: p.property_type,
          neighborhood: p.neighborhood,
          city: p.city,
          status: p.status,
          price: p.sale_price,
          building: p.building?.name || '',
          unit: p.complement || p.unit || '',
          street: p.street || '',
          owner: p.owner?.name || '',
        }));
      setSelectedProps(filtered);
    } catch {}
  }

  function removeSelectedProp(id: string) {
    setSelectedProps(prev => prev.filter(p => p.id !== id));
    const stored = JSON.parse(localStorage.getItem('campaign_properties') || '[]');
    localStorage.setItem('campaign_properties', JSON.stringify(stored.filter((x: string) => x !== id)));
  }

  async function createRule() {
    try {
      const res = await apiFetch(`/automation/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule),
      });
      if (res.ok) {
        setShowNewRule(false);
        setNewRule({ trigger: 'property_created', action: 'send_whatsapp', target: 'owner', template: '' });
        loadRules();
      }
    } catch {}
  }

  async function toggleRule(rule: Rule) {
    try {
      await apiFetch(`/automation/rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !rule.active }),
      });
      loadRules();
    } catch {}
  }

  async function deleteRule(id: string) {
    if (!confirm('Excluir esta regra?')) return;
    try {
      await apiFetch(`/automation/rules/${id}`, { method: 'DELETE' });
      loadRules();
    } catch {}
  }

  async function sendTest() {
    setSending(true);
    try {
      await apiFetch(`/whatsapp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: sendPhone, text: sendText }),
      });
      setSendPhone('');
      setSendText('');
      loadMessages();
    } catch (e: any) { alert(e.message); }
    finally { setSending(false); }
  }

  async function loadContacts() {
    try {
      const [owners, clients] = await Promise.all([
        apiFetch(`/owners`).then(r => r.json()),
        apiFetch(`/clients`).then(r => r.json()),
      ]);
      const mapped: Contact[] = [
        ...(Array.isArray(owners) ? owners.map((o: any) => ({ id: o.id, name: o.name, phone: o.phone || o.whatsapp || '', type: 'owner' as const })) : []),
        ...(Array.isArray(clients) ? clients.map((c: any) => ({ id: c.id, name: c.name, phone: c.phone || c.whatsapp || '', type: 'client' as const })) : []),
      ].filter(c => c.phone);
      setContacts(mapped);
    } catch {}
  }

  function toggleContact(id: string) {
    setSelectedContacts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAllContacts() {
    const filtered = getFilteredContacts();
    setSelectedContacts(new Set(filtered.map(c => c.id)));
  }

  function deselectAllContacts() {
    setSelectedContacts(new Set());
  }

  function getFilteredContacts() {
    return contacts.filter(c => {
      if (contactFilter !== 'all' && c.type !== contactFilter) return false;
      if (contactSearch && !c.name.toLowerCase().includes(contactSearch.toLowerCase()) && !c.phone.includes(contactSearch)) return false;
      return true;
    });
  }

  async function sendMass() {
    const filtered = getFilteredContacts().filter(c => selectedContacts.has(c.id));
    if (filtered.length === 0 || !sendText) return;
    if (!confirm(`Enviar mensagem para ${filtered.length} contato(s)?`)) return;
    setSending(true);
    let sent = 0, failed = 0;
    for (const c of filtered) {
      try {
        await apiFetch(`/whatsapp/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: c.phone, text: sendText }),
        });
        sent++;
      } catch { failed++; }
    }
    setSending(false);
    alert(`Enviadas: ${sent}${failed ? `, Falhas: ${failed}` : ''}`);
    loadMessages();
  }

  function selectTemplate(trigger: string, target: string) {
    const key = `${trigger}_${target}`;
    if (TEMPLATES[key]) {
      setNewRule(r => ({ ...r, template: TEMPLATES[key] }));
    }
  }

  function selectCampaignTemplate(id: string) {
    setCampaignSelectedTmpl(id);
    const t = CAMPAIGN_TEMPLATES[campaignTarget].find(t => t.id === id);
    if (t) setCampaignTemplate(t.template);
  }

  async function startAiCampaign() {
    setSendingAi(true);
    try {
      const stored = localStorage.getItem('campaign_properties');
      const ids: string[] = stored ? JSON.parse(stored) : [];
      const res = await apiFetch(`/campaign/ai-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyIds: ids.length > 0 ? ids : undefined,
          dailyLimit: campaignDailyLimit,
          target: campaignTarget,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Erro ao iniciar campanha IA');
      } else {
        loadCampaign();
      }
    } catch (e: any) { alert(e.message); }
    finally { setSendingAi(false); }
  }

  const [sendingVaried, setSendingVaried] = useState(false);

  async function startVariedCampaign() {
    setSendingVaried(true);
    try {
      const stored = localStorage.getItem('campaign_properties');
      const ids: string[] = stored ? JSON.parse(stored) : [];
      const res = await apiFetch(`/campaign/varied-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyIds: ids.length > 0 ? ids : undefined,
          dailyLimit: campaignDailyLimit,
          target: campaignTarget,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Erro ao iniciar campanha variada');
      } else {
        loadCampaign();
      }
    } catch (e: any) { alert(e.message); }
    finally { setSendingVaried(false); }
  }

  async function startCampaign() {
    if (!campaignTemplate) return;
    setSending(true);
    try {
      const propertyIds = selectedProps.length > 0 ? selectedProps.map(p => p.id) : [];
      const res = await apiFetch(`/campaign/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: campaignTemplate, dailyLimit: campaignDailyLimit, propertyIds, target: campaignTarget }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error);
      } else {
        loadCampaign();
      }
    } catch (e: any) { alert(e.message); }
    finally { setSending(false); }
  }

  async function stopCampaign() {
    await apiFetch(`/campaign/stop`, { method: 'POST' });
    loadCampaign();
  }

  const statusColor = waStatus === 'connected' ? 'text-emerald-400 bg-emerald-500/10' 
    : waStatus === 'connecting' ? 'text-amber-400 bg-amber-500/10'
    : 'text-red-400 bg-red-500/10';

  const statusIcon = waStatus === 'connected' ? Wifi
    : waStatus === 'connecting' ? Clock
    : WifiOff;

  const StatusIcon = statusIcon;

  return (
    <div className="flex flex-col">
      <div className="section-card border-0 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="page-header-box">
            <div className="icon-box">
              <Bot className="w-6 h-6 text-viva-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary">Automação WhatsApp</h1>
              <p className="text-xs text-muted mt-1">Dispare mensagens automáticas personalizadas</p>
            </div>
          </div>
        </div>

        <div className="flex gap-4 mt-6 divider">
          {[
            { id: 'conexao', label: 'Conexão' },
            { id: 'regras', label: 'Regras' },
            { id: 'enviar', label: 'Envio Manual' },
            { id: 'campanha', label: 'Campanha' },
            { id: 'respostas', label: 'Respostas' },
            { id: 'log', label: 'Histórico' },
          ].map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === 'campanha') loadSelectedProps(); }}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id ? 'border-viva-500 text-viva-400' : 'border-transparent text-muted hover:text-secondary'
              }`}>{tab.label}</button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'conexao' && (
          <div className="max-w-xl space-y-6">
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-muted" />
                  <span className="font-medium text-primary">WhatsApp</span>
                </div>
                <span className={`badge ${statusColor}`}>
                  <StatusIcon className="w-3.5 h-3.5" />
                  {waStatus === 'connected' ? 'Conectado' : waStatus === 'connecting' ? 'Conectando...' : 'Desconectado'}
                </span>
              </div>

              {waStatus === 'disconnected' && (
                <button onClick={connect} className="btn-primary w-full justify-center gap-2 rounded-xl">
                  <QrCode className="w-4 h-4" />
                  Conectar WhatsApp
                </button>
              )}

              {qrCode && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-secondary mb-3">
                    Escaneie o QR Code com o WhatsApp do seu celular
                  </p>
                  <div className="inline-block p-4 bg-white rounded-xl">
                    <img src={`data:image/png;base64,${qrCode}`} alt="QR Code" className="w-64 h-64" />
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={connect} className="btn-ghost flex-1 justify-center gap-2 rounded-xl">
                      <RefreshCw className="w-4 h-4" />
                      Gerar novo QR Code
                    </button>
                    <button onClick={async () => { await apiFetch(`/whatsapp/disconnect`, { method: 'POST' }); checkStatus(); }} 
                      className="btn-ghost flex-1 justify-center gap-2 rounded-xl text-red-400 hover:text-red-300">
                      <WifiOff className="w-4 h-4" />
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {!qrCode && waStatus === 'connected' && (
                <>
                  <div className="flex gap-2 mt-4">
                    <input
                      type="text" id="testNumber"
                      className="flex-1 px-3 py-2 text-sm bg-card border border-border rounded-xl"
                      placeholder="Nº do seu celular (ex: 5551999999999)"
                    />
                    <button onClick={async () => {
                      const to = (document.getElementById('testNumber') as HTMLInputElement)?.value;
                      if (!to) { alert('Digite um número'); return; }
                      await apiFetch(`/whatsapp/test-send`, { method: 'POST', body: { to } });
                      alert('Mensagem enviada! Verifique seu WhatsApp.');
                    }} className="btn-secondary rounded-xl text-sm px-4">
                      Testar Envio
                    </button>
                  </div>
                  <button onClick={async () => { await apiFetch(`/whatsapp/disconnect`, { method: 'POST' }); checkStatus(); }} 
                    className="btn-ghost w-full justify-center gap-2 rounded-xl text-red-400 hover:text-red-300">
                    <WifiOff className="w-4 h-4" />
                    Desconectar
                  </button>
                </>
              )}
              {!qrCode && waStatus === 'connecting' && (
                <button onClick={async () => { await apiFetch(`/whatsapp/disconnect`, { method: 'POST' }); checkStatus(); }} 
                  className="btn-ghost w-full justify-center gap-2 rounded-xl text-red-400 hover:text-red-300">
                  <WifiOff className="w-4 h-4" />
                  Desconectar
                </button>
              )}
            </div>

            <div className="card p-6">
              <h3 className="font-medium text-primary mb-2">⚠️ Anti-Ban</h3>
              <ul className="text-xs text-muted space-y-1.5">
                <li>{'✓ Mensagens personalizadas com {{owner_name}}, {{client_name}} etc.'}</li>
                <li>✓ Delay aleatório entre mensagens (2-7s)</li>
                <li>✓ Simula "digitando..." antes de enviar</li>
                <li>✓ Máximo recomendado: ~30 contatos/dia por número</li>
                <li>✓ IA processa respostas e atualiza banco automaticamente</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'regras' && (
          <div className="max-w-3xl space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted">{rules.length} regra(s) configurada(s)</p>
              <button onClick={() => setShowNewRule(true)} className="btn-primary gap-2">
                <Plus className="w-4 h-4" /> Nova Regra
              </button>
            </div>

            {showNewRule && (
              <div className="card p-6 space-y-4">
                <h3 className="font-semibold text-primary">Nova Regra de Automação</h3>

                <div>
                  <label className="text-xs text-muted mb-1 block">Quando acontecer:</label>
                  <select value={newRule.trigger} onChange={e => setNewRule(r => ({ ...r, trigger: e.target.value }))} className="select">
                    {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-muted mb-1 block">Enviar para:</label>
                  <select value={newRule.target} onChange={e => {
                    const target = e.target.value;
                    setNewRule(r => ({ ...r, target }));
                    selectTemplate(newRule.trigger, target);
                  }} className="select">
                    {TARGETS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-muted">Modelo de mensagem:</label>
                    <button onClick={() => selectTemplate(newRule.trigger, newRule.target)} 
                      className="text-xs text-viva-500 hover:underline">Usar sugestão</button>
                  </div>
                  <textarea
                    value={newRule.template}
                    onChange={e => setNewRule(r => ({ ...r, template: e.target.value }))}
                    className="input min-h-[120px] resize-y font-mono text-xs"
                    placeholder="Digite a mensagem... Use {{variavel}} para personalizar"
                  />
                  <div className="mt-2 text-xs text-muted">
                    Variáveis disponíveis: {(VAR_INFO[`${newRule.trigger}_${newRule.target}`] || ['owner_name', 'client_name', 'property_code', 'property_price']).map(v => (
                      <code key={v} className="tag mr-1">{`{{${v}}}`}</code>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={createRule} className="btn-primary flex-1 justify-center">Salvar Regra</button>
                  <button onClick={() => setShowNewRule(false)} className="btn-ghost">Cancelar</button>
                </div>
              </div>
            )}

            {rules.map(rule => (
              <div key={rule.id} className={`card p-4 flex items-start justify-between gap-4 ${!rule.active ? 'opacity-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium dark:text-viva-400 text-viva-600">
                      {TRIGGERS.find(t => t.value === rule.trigger)?.label || rule.trigger}
                    </span>
                    <span className="text-xs text-muted">→</span>
                    <span className="text-xs font-medium text-secondary">
                      {TARGETS.find(t => t.value === rule.target)?.label || rule.target}
                    </span>
                  </div>
                  <p className="text-xs text-muted line-clamp-2 font-mono">{rule.template}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => toggleRule(rule)} className="p-1.5 rounded-lg hover:bg-white/[0.04] transition-colors">
                    {rule.active ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-muted" />}
                  </button>
                  <button onClick={() => deleteRule(rule.id)} className="p-1.5 rounded-lg hover:bg-white/[0.04] transition-colors">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            ))}

            {rules.length === 0 && !showNewRule && (
              <div className="text-center py-12">
                <Bot className="w-12 h-12 text-muted mx-auto mb-3" />
                <p className="text-muted">Nenhuma regra de automação configurada</p>
                <p className="text-xs text-muted mt-1">Crie regras para disparar mensagens automáticas</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'enviar' && (
          <div className="max-w-3xl space-y-4">
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-primary">Selecionar Contatos</h3>
                <button onClick={() => { setLoadAll(true); loadContacts(); }} className="text-xs text-viva-500 hover:underline flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> Carregar contatos
                </button>
              </div>

              {contacts.length > 0 && (
                <>
                  <div className="flex gap-2">
                    <input value={contactSearch} onChange={e => setContactSearch(e.target.value)} placeholder="Buscar contato..." className="input flex-1" />
                    <select value={contactFilter} onChange={e => setContactFilter(e.target.value as any)} className="select w-32">
                      <option value="all">Todos</option>
                      <option value="owner">Proprietários</option>
                      <option value="client">Clientes</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">{selectedContacts.size} de {getFilteredContacts().length} selecionado(s)</span>
                    <div className="flex gap-3">
                      <button onClick={selectAllContacts} className="text-viva-500 hover:underline">Selecionar todos</button>
                      <button onClick={deselectAllContacts} className="text-muted hover:underline">Limpar</button>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-1 border divider rounded-lg p-2">
                    {getFilteredContacts().map(c => (
                      <label key={`${c.type}-${c.id}`} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        selectedContacts.has(c.id) ? 'bg-viva-500/10' : 'hover:bg-white/[0.04]'
                      }`}>
                        <input type="checkbox" checked={selectedContacts.has(c.id)} onChange={() => toggleContact(c.id)} className="checkbox-viva" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-primary truncate">{c.name}</span>
                            <span className={`badge ${
                              c.type === 'owner' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'
                            }`}>{c.type === 'owner' ? 'Proprietário' : 'Cliente'}</span>
                          </div>
                          <p className="text-xs text-muted">{c.phone}</p>
                        </div>
                      </label>
                    ))}
                    {getFilteredContacts().length === 0 && (
                      <p className="text-xs text-muted text-center py-4">Nenhum contato encontrado</p>
                    )}
                  </div>
                </>
              )}

              {contacts.length === 0 && (
                <div className="text-center py-6">
                  <User className="w-8 h-8 text-muted mx-auto mb-2" />
                  <p className="text-xs text-muted">Clique em "Carregar contatos" para listar proprietários e clientes com telefone</p>
                </div>
              )}
            </div>

            <div className="card p-6 space-y-4">
              <h3 className="font-semibold text-primary">Mensagem</h3>
              <div>
                <label className="text-xs text-muted mb-1 block">Ou digite um telefone manualmente (com DDD, apenas números)</label>
                <input value={sendPhone} onChange={e => setSendPhone(e.target.value.replace(/\D/g, ''))} placeholder="51999999999" className="input" />
              </div>
              <div>
                <textarea value={sendText} onChange={e => setSendText(e.target.value)} className="input min-h-[100px] resize-y" placeholder="Digite a mensagem..." />
              </div>
              <div className="flex gap-2">
                <button onClick={sendTest} disabled={!sendPhone || !sendText || sending} className="btn-primary flex-1 justify-center gap-2">
                  <Send className="w-4 h-4" /> {sending ? 'Enviando...' : 'Enviar para telefone'}
                </button>
                <button onClick={sendMass} disabled={selectedContacts.size === 0 || !sendText || sending} className="btn-primary flex-1 justify-center gap-2">
                  <Send className="w-4 h-4" /> {sending ? 'Enviando...' : `Enviar para ${selectedContacts.size} contato(s)`}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'campanha' && (
          <div className="max-w-2xl space-y-4">
            <div className="card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-viva-500" />
                <h3 className="font-semibold text-primary">Campanha de Atualização</h3>
              </div>
              <p className="text-xs text-muted">
                Envia mensagens para proprietários perguntando sobre seus imóveis. 
                Quando eles responderem, a IA extrai as atualizações e aplica no banco automaticamente.
              </p>

              {/* Selected properties list */}
              {selectedProps.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-muted">
                      {selectedProps.length} imóvel(is) selecionado(s) em Imóveis:
                    </label>
                    <button onClick={() => { setSelectedProps([]); localStorage.removeItem('campaign_properties'); }} className="text-xs text-red-400 hover:underline">Limpar todos</button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1 border divider rounded-lg p-2">
                    {selectedProps.map(p => (
                      <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-primary">{p.code}</span>
                            <span className="text-xs text-muted">
                              {p.price ? `R$ ${Number(p.price).toLocaleString('pt-BR')}` : ''}
                            </span>
                          </div>
                          <div className="text-xs text-muted truncate">
                            {p.owner && <span className="text-secondary">{p.owner}</span>}
                            {p.building && <span> • {p.building}</span>}
                            {p.street && <span> • {p.street}{p.unit ? `, ${p.unit}` : ''}</span>}
                            <span> • {p.neighborhood || p.city || ''}</span>
                          </div>
                        </div>
                        <button onClick={() => removeSelectedProp(p.id)} className="p-1 rounded hover:bg-red-500/10 transition-colors">
                          <X className="w-3 h-3 text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedProps.length === 0 && (
                <div className="px-3 py-2 rounded-lg bg-white/[0.03] text-xs text-muted">
                  <Square className="w-3.5 h-3.5 inline-block mr-1.5 align-text-top" />
                  <span>Nenhum imóvel selecionado. A campanha usará <strong>todos</strong> os proprietários com imóveis e telefone. Vá em <strong>Imóveis</strong> e clique no checkbox dos cards para selecionar.</span>
                </div>
              )}

              {/* Smart Campaign - varied messages anti-ban */}
              {!campaign?.active && (
                <div className="border dark:border-emerald-800 border-emerald-300 rounded-xl p-4 dark:bg-emerald-900/10 bg-emerald-50 space-y-3">
                  <div className="flex items-center gap-3">
                    <Bot className="w-5 h-5 text-emerald-500" />
                    <div>
                      <p className="text-sm font-semibold text-primary">Campanha Inteligente 🧠</p>
                      <p className="text-xs text-muted">
                        Mensagens variadas com Bom dia/Boa tarde/Boa noite + primeiro nome + pergunta se ainda está disponível
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] text-emerald-400/80 bg-emerald-900/10 rounded-lg p-2">
                    <span>✓ 12 variações diferentes</span>
                    <span>✓ Saudação por horário</span>
                    <span>✓ Só primeiro nome</span>
                    <span>✓ Anti-ban ativo</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={startVariedCampaign} disabled={sendingVaried} 
                      className="btn-primary flex-1 justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50">
                      <Bot className="w-4 h-4" /> {sendingVaried ? 'Iniciando...' : (campaign?.totalSent ? 'Nova Campanha' : 'Campanha Inteligente')}
                    </button>
                    <button onClick={startAiCampaign} disabled={sendingAi} 
                      className="btn-ghost flex-[0.4] justify-center gap-2 text-xs">
                      IA
                    </button>
                  </div>
                </div>
              )}

              {campaign?.active || (campaign && campaign.totalSent > 0) ? (
                <div className="space-y-3">
                  {/* Stats bar */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-primary">{campaign!.totalSent}</p>
                      <p className="text-[10px] text-muted">Enviadas</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-primary">{campaign!.sentToday}/{campaign!.dailyLimit}</p>
                      <p className="text-[10px] text-muted">Hoje</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-primary">{campaign!.remaining}</p>
                      <p className="text-[10px] text-muted">Restantes</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {campaign!.totalContacts > 0 && (
                    <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (campaign!.totalSent / campaign!.totalContacts) * 100)}%` }}
                      />
                    </div>
                  )}

                  {/* Live chat */}
                  {campaign?.active && (
                    <div className="border divider rounded-xl overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] border-b divider">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-medium text-primary">Enviando mensagens...</span>
                        <span className="text-[10px] text-muted ml-auto">{liveMessages.length} mensagens</span>
                      </div>
                      <div ref={liveContainerRef} className="h-64 overflow-y-auto p-3 space-y-2 bg-[#0a0f0a]">
                        {typingContact && (
                          <div className="flex items-start gap-2 animate-fadeIn">
                            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                              <Bot className="w-3 h-3 text-emerald-400" />
                            </div>
                            <div className="bg-white/[0.04] rounded-2xl rounded-tl-sm px-3 py-2 max-w-[80%]">
                              <p className="text-[10px] text-emerald-400 font-medium mb-1">{typingContact}</p>
                              <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 bg-emerald-400/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 bg-emerald-400/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 bg-emerald-400/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                            </div>
                          </div>
                        )}
                        {liveMessages.slice(0, 30).map((msg: any) => (
                          <div key={msg.id} className="flex items-start gap-2 animate-fadeIn">
                            <div className="w-6 h-6 rounded-full bg-viva-500/20 flex items-center justify-center flex-shrink-0">
                              <MessageCircle className="w-3 h-3 text-viva-400" />
                            </div>
                            <div className="bg-white/[0.06] rounded-2xl rounded-tl-sm px-3 py-2 max-w-[80%]">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] text-viva-400 font-medium">{msg.propertyCode || msg.to}</span>
                                <span className="text-[9px] text-muted">{new Date(msg.sentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <p className="text-xs text-secondary leading-relaxed">{msg.content}</p>
                              <div className="flex items-center gap-1 mt-1">
                                <CheckCircle className={`w-2.5 h-2.5 ${msg.status === 'sent' ? 'text-emerald-400' : 'text-muted'}`} />
                                <span className="text-[9px] text-muted">{msg.status === 'sent' ? 'Enviada' : 'Pendente'}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                        {liveMessages.length === 0 && !typingContact && (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                              <Clock className="w-6 h-6 text-muted mx-auto mb-1 animate-pulse" />
                              <p className="text-[10px] text-muted">Aguardando envios...</p>
                            </div>
                          </div>
                        )}
                        <div ref={liveEndRef} />
                      </div>
                    </div>
                  )}

                  {campaign?.active && (
                    <button onClick={stopCampaign} className="btn-ghost w-full justify-center gap-2 text-red-400 hover:text-red-300">
                      <StopCircle className="w-4 h-4" /> Parar Campanha
                    </button>
                  )}
                  {!campaign?.active && campaign!.totalSent > 0 && (
                    <div className="flex items-center justify-center gap-2 text-xs text-emerald-400">
                      <CheckCircle className="w-4 h-4" />
                      Campanha finalizada — {campaign!.totalSent} mensagens enviadas
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Target selector */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setCampaignTarget('properties'); setCampaignSelectedTmpl(''); setCampaignTemplate(''); }}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${campaignTarget === 'properties' ? 'bg-viva-500/20 text-viva-400 border border-viva-500/30' : 'bg-white/[0.04] text-muted hover:text-secondary'}`}
                    >
                      Proprietários
                    </button>
                    <button
                      onClick={() => { setCampaignTarget('clients'); setCampaignSelectedTmpl(''); setCampaignTemplate(''); }}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${campaignTarget === 'clients' ? 'bg-viva-500/20 text-viva-400 border border-viva-500/30' : 'bg-white/[0.04] text-muted hover:text-secondary'}`}
                    >
                      Clientes
                    </button>
                  </div>

                  {/* Template selector */}
                  <div>
                    <label className="text-xs text-muted mb-2 block">Modelo de mensagem</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {CAMPAIGN_TEMPLATES[campaignTarget].map(t => (
                        <button
                          key={t.id}
                          onClick={() => selectCampaignTemplate(t.id)}
                          className={`text-left px-3 py-2 rounded-lg text-xs transition-all ${campaignSelectedTmpl === t.id ? 'bg-viva-500/20 text-viva-400 border border-viva-500/30' : 'bg-white/[0.04] text-muted hover:text-secondary border border-transparent'}`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Template text area */}
                  <div>
                    <label className="text-xs text-muted mb-1 block">
                      Mensagem {'{use {{greeting}}, {{owner_name}}, {{property_code}}, {{property_building}}, {{property_neighborhood}}, {{property_price}} etc}'}
                    </label>
                    <textarea
                      value={campaignTemplate}
                      onChange={e => { setCampaignTemplate(e.target.value); setCampaignSelectedTmpl(''); }}
                      rows={5}
                      className="input w-full text-xs font-mono resize-none"
                      placeholder="Digite a mensagem com {{variaveis}}..."
                    />
                  </div>

                  {/* Daily limit + start */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-muted mb-1 block">Limite diário (recomendado: 20-30)</label>
                      <input type="number" value={campaignDailyLimit} onChange={e => setCampaignDailyLimit(Number(e.target.value))} min={1} max={50} className="input w-32" />
                    </div>
                    <button
                      onClick={startCampaign}
                      disabled={sending || !campaignTemplate}
                      className="btn-primary gap-2 disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      {sending ? 'Iniciando...' : 'Iniciar Campanha'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Campaign History */}
            <div className="card p-6">
              <h3 className="font-semibold text-primary mb-3">📋 Histórico de Campanha</h3>
              {campaignHistory.length === 0 ? (
                <p className="text-xs text-muted">Nenhum envio de campanha ainda</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {campaignHistory.map((h: any) => (
                    <div key={h.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/[0.04] transition-colors">
                      <MessageCircle className="w-3.5 h-3.5 mt-0.5 text-muted flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-secondary">{h.propertyCode || h.to}</span>
                          <span className="text-muted">{new Date(h.sentAt).toLocaleString('pt-BR')}</span>
                        </div>
                        <p className="text-xs text-muted truncate mt-0.5">{h.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'respostas' && (
          <div className="max-w-3xl space-y-2">
            <p className="text-sm text-muted mb-4">{replies.length} resposta(s) recebida(s)</p>
            {replies.map(msg => (
              <div key={msg.id} className="card p-4 dark:border-emerald-800/30 border-emerald-200">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs mb-1">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-medium text-secondary">{msg.to}</span>
                      <span className="badge bg-emerald-500/10 text-emerald-400">
                        <CheckCircle className="w-3 h-3" />
                        {msg.trigger === 'owner_reply' ? 'Proprietário' : 'Cliente'}
                      </span>
                    </div>
                    <p className="text-xs text-secondary">{msg.content}</p>
                    <p className="text-[10px] text-muted mt-1">
                      {new Date(msg.sentAt).toLocaleString('pt-BR')}
                      {msg.referenceId && <span className="ml-2">Ref: {msg.referenceId.slice(0, 8)}</span>}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {replies.length === 0 && (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 text-muted mx-auto mb-3" />
                <p className="text-muted">Nenhuma resposta recebida ainda</p>
                <p className="text-xs text-muted mt-1">
                  Quando proprietários responderem, as respostas aparecerão aqui e a IA atualizará o banco
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'log' && (
          <div className="max-w-3xl space-y-2">
            <p className="text-sm text-muted mb-4">{messages.length} mensagem(ns) enviada(s)</p>
            {messages.map(msg => (
              <div key={msg.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs mb-1">
                      <MessageCircle className="w-3.5 h-3.5 text-muted" />
                      <span className="font-medium text-secondary">{msg.to}</span>
                      <span className={`badge ${
                        msg.status === 'sent' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {msg.status === 'sent' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {msg.status === 'sent' ? 'Enviada' : 'Falha'}
                      </span>
                    </div>
                    <p className="text-xs text-muted line-clamp-2">{msg.content}</p>
                    <p className="text-[10px] text-muted mt-1">{new Date(msg.sentAt).toLocaleString('pt-BR')}</p>
                  </div>
                </div>
              </div>
            ))}
            {messages.length === 0 && (
              <div className="text-center py-12">
                <Send className="w-12 h-12 text-muted mx-auto mb-3" />
                <p className="text-muted">Nenhuma mensagem enviada ainda</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
