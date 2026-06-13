import { useState, useEffect } from 'react';
import { Send, CheckCircle, XCircle, Clock, Search, RefreshCw } from 'lucide-react';

const API = '/api';
function authHeaders(): Record<string, string> { const uid = localStorage.getItem('viva_user_id') || ''; return uid ? { 'x-user-id': uid } : {}; }
async function apiFetch(path: string, opts: RequestInit = {}) {
  const { body, ...rest } = opts;
  const headers = { ...authHeaders(), ...(rest.headers || {}) as Record<string, string> };
  return fetch(`${API}${path}`, { ...rest, headers, body: body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof URLSearchParams) ? JSON.stringify(body) : body });
}

interface WaMessage { id: string; to: string; content: string; status: string; trigger: string | null; sentAt: string; }

export default function History() {
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'failed'>('all');

  useEffect(() => { loadMessages(); }, []);

  async function loadMessages() {
    try { const res = await apiFetch('/whatsapp/messages'); const data = await res.json(); setMessages(data); } catch {}
  }

  const filtered = messages.filter(m => {
    if (search && !m.to.includes(search) && !m.content.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    if (period === 'today') { const today = new Date(); const d = new Date(m.sentAt); if (d.toDateString() !== today.toDateString()) return false; }
    if (period === '7days') { const week = Date.now() - 7 * 86400000; if (new Date(m.sentAt).getTime() < week) return false; }
    if (period === '30days') { const month = Date.now() - 30 * 86400000; if (new Date(m.sentAt).getTime() < month) return false; }
    return true;
  });

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-8 text-xs" placeholder="Buscar por número ou conteúdo..." />
        </div>
        <div className="flex gap-1">
          {[
            { id: 'all' as const, label: 'Todos' },
            { id: 'today' as const, label: 'Hoje' },
            { id: '7days' as const, label: '7 dias' },
            { id: '30days' as const, label: '30 dias' },
          ].map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${period === p.id ? 'bg-viva-500/20 text-viva-400' : 'bg-white/[0.04] text-muted'}`}>{p.label}</button>
          ))}
        </div>
        <div className="flex gap-1">
          {[
            { id: 'all' as const, label: 'Todos' },
            { id: 'sent' as const, label: 'Enviadas' },
            { id: 'failed' as const, label: 'Falhas' },
          ].map(s => (
            <button key={s.id} onClick={() => setStatusFilter(s.id)} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${statusFilter === s.id ? 'bg-viva-500/20 text-viva-400' : 'bg-white/[0.04] text-muted'}`}>{s.label}</button>
          ))}
        </div>
        <button onClick={loadMessages} className="btn-ghost p-2 rounded-xl"><RefreshCw className="w-4 h-4" /></button>
      </div>

      <p className="text-xs text-muted">{filtered.length} mensagem(ns) encontrada(s)</p>

      <div className="space-y-2">
        {filtered.map(msg => (
          <div key={msg.id} className="surface-card p-4 hover:translate-y-[-1px] transition-all">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl ${msg.status === 'sent' ? 'bg-emerald-500/10' : 'bg-red-500/10'} flex items-center justify-center flex-shrink-0`}>
                {msg.status === 'sent' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs mb-1">
                  <span className="font-medium text-secondary">{msg.to}</span>
                  {msg.trigger && <span className="badge bg-viva-500/10 text-viva-400">{msg.trigger}</span>}
                  <span className={`badge ${msg.status === 'sent' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{msg.status === 'sent' ? 'Enviada' : 'Falha'}</span>
                </div>
                <p className="text-xs text-muted line-clamp-2">{msg.content}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Clock className="w-3 h-3 text-muted" />
                  <span className="text-[10px] text-muted">{new Date(msg.sentAt).toLocaleString('pt-BR')}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
              <Send className="w-7 h-7 text-muted" />
            </div>
            <p className="text-sm text-muted">Nenhuma mensagem encontrada</p>
            <p className="text-xs text-muted mt-1">As mensagens enviadas aparecerão aqui</p>
          </div>
        )}
      </div>
    </div>
  );
}
