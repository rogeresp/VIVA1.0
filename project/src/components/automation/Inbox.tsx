import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Search, Send, User, Paperclip, Home, CheckCircle } from 'lucide-react';

const API = '/api';
function authHeaders(): Record<string, string> { const uid = localStorage.getItem('viva_user_id') || ''; return uid ? { 'x-user-id': uid } : {}; }
async function apiFetch(path: string, opts: RequestInit = {}) {
  const { body, ...rest } = opts;
  const headers = { ...authHeaders(), ...(rest.headers || {}) as Record<string, string> };
  return fetch(`${API}${path}`, { ...rest, headers, body: body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof URLSearchParams) ? JSON.stringify(body) : body });
}

interface WaMessage {
  id: string; to: string; content: string; status: string; trigger: string | null; sentAt: string;
}

export default function Inbox() {
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [replies, setReplies] = useState<WaMessage[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'owner' | 'client'>('all');
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadMessages(); loadReplies(); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [replies]);

  async function loadMessages() {
    try { const res = await apiFetch('/whatsapp/messages'); const data = await res.json(); setMessages(data); } catch {}
  }
  async function loadReplies() {
    try { const res = await apiFetch('/whatsapp/replies'); const data = await res.json(); setReplies(data); } catch {}
  }

  const allChats = [...new Set([...messages, ...replies].map(m => m.to))];
  const filteredChats = allChats.filter(p => !search || p.includes(search));

  const getChatMessages = (phone: string) => {
    const m = messages.filter(msg => msg.to === phone).map(msg => ({ ...msg, direction: 'sent' as const }));
    const r = replies.filter(msg => msg.to === phone).map(msg => ({ ...msg, direction: 'received' as const }));
    return [...m, ...r].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
  };

  async function sendMessage() {
    if (!selectedChat || !chatInput) return;
    try {
      await apiFetch('/whatsapp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: selectedChat, text: chatInput }) });
      setChatInput('');
      loadMessages();
    } catch (e: any) { alert(e.message); }
  }

  const getLastMessage = (phone: string) => {
    const chat = getChatMessages(phone);
    return chat[chat.length - 1];
  };

  return (
    <div className="flex h-[calc(100vh-180px)] gap-0 surface-card overflow-hidden animate-fadeIn">
      <div className="w-72 lg:w-80 border-r border-surface-border flex flex-col shrink-0">
        <div className="p-3 border-b border-surface-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-8 text-xs" placeholder="Buscar conversas..." />
          </div>
          <div className="flex gap-1 mt-2">
            {[
              { id: 'all' as const, label: 'Todos' },
              { id: 'owner' as const, label: 'Proprietários' },
              { id: 'client' as const, label: 'Clientes' },
            ].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${filter === f.id ? 'bg-viva-500/20 text-viva-400' : 'bg-white/[0.04] text-muted'}`}>{f.label}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredChats.map(phone => {
            const last = getLastMessage(phone);
            const unread = replies.filter(r => r.to === phone && r.status === 'received').length;
            return (
              <button key={phone} onClick={() => setSelectedChat(phone)} className={`w-full flex items-center gap-3 p-3 border-b border-surface-border transition-all hover:bg-white/[0.04] ${selectedChat === phone ? 'bg-viva-500/10' : ''}`}>
                <div className="w-9 h-9 rounded-full bg-viva-500/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-viva-400" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-medium text-primary truncate">{phone}</p>
                  {last && <p className="text-[10px] text-muted truncate">{last.content}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  {last && <p className="text-[9px] text-muted">{new Date(last.sentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>}
                  {unread > 0 && <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-viva-500 text-[9px] font-medium text-white mt-1">{unread}</span>}
                </div>
              </button>
            );
          })}
          {filteredChats.length === 0 && <p className="text-xs text-muted text-center py-8">Nenhuma conversa encontrada</p>}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
              <div className="w-9 h-9 rounded-full bg-viva-500/20 flex items-center justify-center"><User className="w-4 h-4 text-viva-400" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary">{selectedChat}</p>
                <p className="text-[10px] text-muted">{getChatMessages(selectedChat).length} mensagens</p>
              </div>
              <div className="flex gap-1">
                <button className="p-1.5 rounded-lg hover:bg-white/[0.04]"><Paperclip className="w-4 h-4 text-muted" /></button>
                <button className="p-1.5 rounded-lg hover:bg-white/[0.04]"><Home className="w-4 h-4 text-muted" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#050e0a]">
              {getChatMessages(selectedChat).map((msg: any) => (
                <div key={msg.id} className={`flex ${msg.direction === 'sent' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl ${msg.direction === 'sent' ? 'bg-viva-500/20 rounded-tr-sm' : 'bg-white/[0.06] rounded-tl-sm'}`}>
                    <p className="text-xs text-secondary">{msg.content}</p>
                    <div className="flex items-center gap-1 mt-1 justify-end">
                      <span className="text-[9px] text-muted">{new Date(msg.sentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      {msg.direction === 'sent' && <CheckCircle className={`w-2.5 h-2.5 ${msg.status === 'sent' ? 'text-emerald-400' : 'text-muted'}`} />}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="flex items-center gap-2 p-3 border-t border-surface-border">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} className="input flex-1 text-xs" placeholder="Digite sua mensagem..." />
              <button onClick={sendMessage} disabled={!chatInput} className="btn-primary w-9 h-9 p-0 rounded-xl disabled:opacity-50">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-7 h-7 text-muted" />
              </div>
              <p className="text-sm text-muted">Selecione uma conversa</p>
              <p className="text-xs text-muted mt-1">Escolha um contato à esquerda para ver o chat</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
