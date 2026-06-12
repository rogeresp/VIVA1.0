import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Conversation, ChatMessage } from '../lib/types';

export default function Chat() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile) return;
    const fetch = async () => {
      const { data } = await supabase.from('conversations').select('*').contains('participants', [profile.id]).order('last_message_at', { ascending: false, nullsFirst: false });
      setConversations((data as Conversation[]) || []);
      setLoading(false);
    };
    fetch();
  }, [profile]);

  useEffect(() => {
    if (!selectedId || !profile) return;
    const fetchMsgs = async () => {
      const { data } = await supabase.from('chat_messages').select('*').eq('conversation_id', selectedId).order('created_at', { ascending: true });
      setMessages((data as ChatMessage[]) || []);
    };
    fetchMsgs();

    const channel = supabase.channel(`chat:${selectedId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${selectedId}` }, payload => {
        setMessages(p => [...p, payload.new as ChatMessage]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedId, profile]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !selectedId || !profile) return;
    const text = input.trim();
    setInput('');
    await supabase.from('chat_messages').insert({ conversation_id: selectedId, sender_id: profile.id, content: text });
    await supabase.from('conversations').update({ last_message: text, last_message_at: new Date().toISOString() }).eq('id', selectedId);
  };

  const typeLabels: Record<string, string> = { property: 'Imóvel', exchange: 'Permuta', opportunity: 'Oportunidade', direct: 'Direto' };

  return (
    <div className="h-full flex flex-col">
      <div className="divider p-5">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-viva-400" />
          <h1 className="text-lg font-bold text-primary">Chat</h1>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 divider flex-shrink-0 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-viva-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="empty-state !py-8">
              <MessageCircle className="w-8 h-8 text-muted" />
              <p className="text-xs text-muted">Nenhuma conversa</p>
            </div>
          ) : conversations.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`w-full text-left p-3 divider transition-colors ${selectedId === c.id ? 'bg-viva-500/10' : 'hover:bg-white/[0.03]'}`}
            >
              <p className="text-[10px] font-medium text-viva-400">{typeLabels[c.type] || c.type}</p>
              <p className="text-xs text-secondary truncate mt-0.5">{c.last_message || 'Sem mensagens'}</p>
            </button>
          ))}
        </div>

        <div className="flex-1 flex flex-col">
          {selectedId ? (
            <>
              <div className="flex-1 overflow-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-muted">Inicie a conversa</div>
                ) : messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender_id === profile?.id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-xl px-3 py-2 text-sm ${
                      msg.sender_id === profile?.id
                        ? 'text-primary'
                        : 'text-secondary'
                    }`} style={{
                      background: msg.sender_id === profile?.id
                        ? 'rgba(74, 155, 99, 0.08)'
                        : 'rgba(255,255,255,0.04)'
                    }}>
                      <p className="leading-relaxed">{msg.content}</p>
                      <p className="text-[10px] mt-1 text-muted/50">{new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <div className="divider p-3">
                <div className="flex gap-2">
                  <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Digite uma mensagem..." className="input flex-1" />
                  <button onClick={handleSend} disabled={!input.trim()} className="btn-primary !px-3"><Send className="w-4 h-4" /></button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted">Selecione uma conversa</div>
          )}
        </div>
      </div>
    </div>
  );
}
