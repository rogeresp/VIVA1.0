import { useState, useEffect } from 'react';
import { Send, Search, User, Users, Phone, Save } from 'lucide-react';

const API = '/api';
function authHeaders(): Record<string, string> { const uid = localStorage.getItem('viva_user_id') || ''; return uid ? { 'x-user-id': uid } : {}; }
async function apiFetch(path: string, opts: RequestInit = {}) {
  const { body, ...rest } = opts;
  const headers = { ...authHeaders(), ...(rest.headers || {}) as Record<string, string> };
  return fetch(`${API}${path}`, { ...rest, headers, body: body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof URLSearchParams) ? JSON.stringify(body) : body });
}

interface Contact { id: string; name: string; phone: string; type: 'owner' | 'client'; }

export default function ManualSend() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [contactFilter, setContactFilter] = useState<'all' | 'owner' | 'client'>('all');
  const [contactSearch, setContactSearch] = useState('');
  const [sendPhone, setSendPhone] = useState('');
  const [sendText, setSendText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadAll, setLoadAll] = useState(false);

  useEffect(() => { if (loadAll) loadContacts(); }, [loadAll]);

  async function loadContacts() {
    try {
      const [owners, clients] = await Promise.all([
        apiFetch('/owners').then(r => r.json()),
        apiFetch('/clients').then(r => r.json()),
      ]);
      setContacts([
        ...(Array.isArray(owners) ? owners.map((o: any) => ({ id: o.id, name: o.name, phone: o.phone || o.whatsapp || '', type: 'owner' as const })) : []),
        ...(Array.isArray(clients) ? clients.map((c: any) => ({ id: c.id, name: c.name, phone: c.phone || c.whatsapp || '', type: 'client' as const })) : []),
      ].filter(c => c.phone));
    } catch {}
  }

  const getFilteredContacts = () => contacts.filter(c => {
    if (contactFilter !== 'all' && c.type !== contactFilter) return false;
    if (contactSearch && !c.name.toLowerCase().includes(contactSearch.toLowerCase()) && !c.phone.includes(contactSearch)) return false;
    return true;
  });

  function toggleContact(id: string) {
    setSelectedContacts(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function selectAllFiltered() { setSelectedContacts(new Set(getFilteredContacts().map(c => c.id))); }
  function deselectAll() { setSelectedContacts(new Set()); }

  async function sendTest() {
    if (!sendPhone || !sendText) return;
    setSending(true);
    try { await apiFetch('/whatsapp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: sendPhone, text: sendText }) }); setSendPhone(''); setSendText(''); }
    catch (e: any) { alert(e.message); }
    finally { setSending(false); }
  }

  async function sendMass() {
    const filtered = getFilteredContacts().filter(c => selectedContacts.has(c.id));
    if (filtered.length === 0 || !sendText) return;
    if (!confirm(`Enviar mensagem para ${filtered.length} contato(s)?`)) return;
    setSending(true);
    let sent = 0, failed = 0;
    for (const c of filtered) {
      try { await apiFetch('/whatsapp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: c.phone, text: sendText }) }); sent++; }
      catch { failed++; }
    }
    setSending(false);
    alert(`Enviadas: ${sent}${failed ? `, Falhas: ${failed}` : ''}`);
  }

  const filtered = getFilteredContacts();
  const charsLeft = sendText.length;

  return (
    <div className="flex gap-6 animate-fadeIn">
      <div className="w-72 lg:w-80 shrink-0 space-y-3">
        <div className="surface-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-primary">Contatos</h3>
            <button onClick={() => { setLoadAll(true); loadContacts(); }} className="text-xs text-viva-500 hover:underline">Carregar</button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted" />
            <input value={contactSearch} onChange={e => setContactSearch(e.target.value)} className="input pl-7 text-xs" placeholder="Buscar..." />
          </div>
          <div className="flex gap-1">
            {[
              { id: 'all' as const, label: 'Todos' },
              { id: 'owner' as const, label: 'Proprietários' },
              { id: 'client' as const, label: 'Clientes' },
            ].map(f => (
              <button key={f.id} onClick={() => setContactFilter(f.id)} className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${contactFilter === f.id ? 'bg-viva-500/20 text-viva-400' : 'bg-white/[0.04] text-muted'}`}>{f.label}</button>
            ))}
          </div>
        </div>

        {contacts.length > 0 && (
          <div className="surface-card p-3 space-y-2">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted">{selectedContacts.size} de {filtered.length} selecionado(s)</span>
              <div className="flex gap-2">
                <button onClick={selectAllFiltered} className="text-viva-500 hover:underline">Todos</button>
                <button onClick={deselectAll} className="text-muted hover:underline">Limpar</button>
              </div>
            </div>
            <div className="max-h-[400px] overflow-y-auto space-y-0.5">
              {filtered.map(c => (
                <label key={`${c.type}-${c.id}`} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selectedContacts.has(c.id) ? 'bg-viva-500/10' : 'hover:bg-white/[0.04]'}`}>
                  <input type="checkbox" checked={selectedContacts.has(c.id)} onChange={() => toggleContact(c.id)} className="checkbox-viva" />
                  <div className="w-7 h-7 rounded-full bg-viva-500/20 flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 text-viva-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-primary truncate">{c.name}</span>
                      <span className={`badge ${c.type === 'owner' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{c.type === 'owner' ? 'Prop' : 'Cli'}</span>
                    </div>
                    <p className="text-[10px] text-muted">{c.phone}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {contacts.length === 0 && (
          <div className="surface-card p-6 text-center">
            <Users className="w-8 h-8 text-muted mx-auto mb-2" />
            <p className="text-xs text-muted">Clique em "Carregar" para listar contatos</p>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-4">
        <div className="surface-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-muted" />
            <label className="text-xs text-muted flex-1">Ou digite um telefone manualmente (apenas números)</label>
          </div>
          <input value={sendPhone} onChange={e => setSendPhone(e.target.value.replace(/\D/g, ''))} placeholder="51999999999" className="input" />

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted">Mensagem</label>
              <span className="text-[10px] text-muted">{charsLeft} caracteres</span>
            </div>
            <textarea value={sendText} onChange={e => setSendText(e.target.value)} className="input min-h-[140px] resize-y" placeholder="Digite a mensagem..." />
          </div>

          <div className="flex flex-wrap gap-1">
            {['{{owner_name}}', '{{client_name}}', '{{property_code}}', '{{property_value}}', '{{greeting}}', '{{city}}'].map(v => (
              <button key={v} onClick={() => setSendText(prev => prev + v + ' ')} className="chip text-[10px]">{v}</button>
            ))}
          </div>

          {sendText && (
            <div className="surface-glass p-3 rounded-xl">
              <p className="text-[10px] text-muted mb-1">Preview:</p>
              <p className="text-xs text-secondary">{sendText.replace(/\{\{\w+\}\}/g, '_____')}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={sendTest} disabled={!sendPhone || !sendText || sending} className="btn-primary flex-1 justify-center gap-2 rounded-xl">
              <Send className="w-4 h-4" /> {sending ? 'Enviando...' : 'Enviar para este número'}
            </button>
            <button onClick={sendMass} disabled={selectedContacts.size === 0 || !sendText || sending} className="btn-primary flex-1 justify-center gap-2 rounded-xl">
              <Send className="w-4 h-4" /> {sending ? 'Enviando...' : `Enviar para ${selectedContacts.size} selecionado(s)`}
            </button>
            <button className="btn-ghost rounded-xl gap-2">
              <Save className="w-4 h-4" /> Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
