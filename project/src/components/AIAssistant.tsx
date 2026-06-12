import { useState, useRef, useEffect } from 'react';
import { X, Mic, Send, Loader2, Sparkles } from 'lucide-react';
import * as api from '../lib/api';
import { useData } from '../contexts/DataContext';
import { BRL } from '../lib/constants';

interface Message { id: string; role: 'user' | 'assistant'; content: string; timestamp: Date }

const QUICK = ['Cadastrar cliente João telefone 51 99999-9999', 'Apartamento 2 dormitórios em Capão 350 mil', 'Buscar permutas', 'Gerar anúncio do último imóvel', 'Quais meus clientes quentes?'];

export default function AIAssistant({ onClose }: { onClose: () => void }) {
  const { addProperty, addClient, addOwner, addExchange, refreshAll } = useData();
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', role: 'assistant', content: 'Olá! Sou a IA VIVA. Posso cadastrar clientes, imóveis, permutas, gerar anúncios e encontrar matches. Fale ou digite o que precisa!', timestamp: new Date() },
  ]);
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const processCommand = async (text: string) => {
    // Show thinking message
    const thinkingId = Date.now().toString();
    setMessages(pv => [...pv, { id: thinkingId, role: 'assistant', content: '🤔 Pensando...', timestamp: new Date() }]);

    // Natural thinking delay (1.5-3s random, like a human pausing to think)
    const delay = 1500 + Math.random() * 1500;
    await new Promise(r => setTimeout(r, delay));

    try {
      // AI parses the command (backend doesn't create, just interprets)
      const result = await api.aiCommand(text);
      const { action, data } = result.parsed || {};

      // Remove thinking message
      setMessages(pv => pv.filter(m => m.id !== thinkingId));

      if (action === 'create_client' && data) {
        // Generate a natural description from the spoken characteristics
        const descParts: string[] = [];
        if (data.desiredPropertyType || data.tipo_imovel || data.propertyType) descParts.push((data.desiredPropertyType || data.tipo_imovel || data.propertyType));
        if (data.desiredNeighborhood || data.bairro || data.neighborhood) descParts.push(`no bairro ${data.desiredNeighborhood || data.bairro || data.neighborhood}`);
        if (data.desiredCity || data.cidade || data.city) descParts.push(`em ${data.desiredCity || data.cidade || data.city}`);
        if (data.bedrooms || data.dormitorios) descParts.push(`com ${data.bedrooms || data.dormitorios} dormitórios`);
        if (data.suites) descParts.push(`${data.suites} suíte(s)`);
        if (data.garage || data.garagem) descParts.push('garagem');
        if (data.budgetMax || data.valor || data.preco) descParts.push(`orçamento até ${BRL(data.budgetMax || data.valor || data.preco)}`);
        if (data.seaView || data.vista_mar) descParts.push('vista para o mar');
        const description = descParts.length > 0
          ? `Cliente interessado em ${descParts.join(', ').toLowerCase()}.`
          : '';

        // Garantir que paymentConditions seja enviado mesmo com nome diferente
        const pc = data.paymentConditions || data.payment_conditions || data.condicoes || data.condicoes_pagamento || '';
        const c = await addClient({
          name: data.name || data.nome || 'Cliente',
          phone: data.phone || data.telefone || '',
          email: data.email || '',
          city: data.city || data.cidade || '',
          neighborhood: data.neighborhood || data.bairro || '',
          desiredCity: data.desiredCity || data.cidade || '',
          desiredNeighborhood: data.desiredNeighborhood || data.bairro || '',
          desiredPropertyType: data.desiredPropertyType || '',
          bedrooms: data.bedrooms || data.dormitorios || 0,
          suites: data.suites || 0,
          garage: data.garage || data.garagem || false,
          budgetMax: data.budgetMax || data.valor || data.preco || 0,
          funil: data.funil || data.funnel || 'frio',
          description: data.description || description,
          paymentConditions: pc,
        });
        const pc2 = (c as any).paymentConditions; const reply = `✅ **Cliente cadastrado!**\n\nNome: **${c.name}**${c.phone ? `\nTel: ${c.phone}` : ''}${c.city ? `\nCidade: ${c.city}` : ''}${c.desiredNeighborhood ? `\nBairro desejado: ${c.desiredNeighborhood}` : ''}${c.bedrooms ? `\n${c.bedrooms} dormitórios` : ''}${c.budgetMax ? `\nOrçamento: ${BRL(c.budgetMax)}` : ''}\n🔥 Funil: **${c.funil}**${c.description ? `\n📋 Descrição: ${c.description}` : ''}${pc2 ? `\n💳 Condições: ${pc2}` : ''}`;
        setMessages(pv => [...pv, { id: Date.now().toString(), role: 'assistant', content: reply, timestamp: new Date() }]);
      } else if (action === 'create_property' && data) {
        const p = await addProperty({
          propertyType: data.propertyType || data.tipo || 'apartamento',
          city: data.city || data.cidade || '',
          neighborhood: data.neighborhood || data.bairro || '',
          street: data.street || data.endereco || '',
          salePrice: data.salePrice || data.preco || data.valor || 0,
          bedrooms: data.bedrooms || data.dormitorios || 0,
          garages: data.garages || data.vagas || 0,
          description: data.description || data.descricao || '',
          suites: data.suites || 0,
        });
        const reply = `✅ **Imóvel cadastrado!**\n\nCódigo: **${p.code}**\nTipo: ${p.propertyType}\n${p.city ? `Local: ${p.city}${p.neighborhood ? ` - ${p.neighborhood}` : ''}` : ''}${p.salePrice ? `\nValor: ${BRL(p.salePrice)}` : ''}${p.bedrooms ? `\n${p.bedrooms} dormitórios` : ''}${p.garages ? ` | ${p.garages} vagas` : ''}`;
        setMessages(pv => [...pv, { id: Date.now().toString(), role: 'assistant', content: reply, timestamp: new Date() }]);
      } else if (action === 'create_owner' && data) {
        const o = await addOwner({
          name: data.name || data.nome || 'Proprietário',
          phone: data.phone || data.telefone || '',
          email: data.email || '',
          city: data.city || data.cidade || '',
        });
        const reply = `✅ **Proprietário cadastrado!**\n\nNome: **${o.name}**${o.phone ? `\nTel: ${o.phone}` : ''}${o.email ? `\nEmail: ${o.email}` : ''}`;
        setMessages(pv => [...pv, { id: Date.now().toString(), role: 'assistant', content: reply, timestamp: new Date() }]);
      } else if (action === 'create_exchange' && data) {
        const e = await addExchange({
          assetType: data.assetType || data.asset_type || data.tipo || 'imovel',
          assetName: data.assetName || data.asset_name || data.nome || 'Ativo',
          estimatedValue: data.estimatedValue || data.estimated_value || data.valor || 0,
          seeking: data.seeking || data.procura || '',
          description: data.description || data.descricao || '',
          visibility: data.visibility || 'privado',
        });
        const reply = `✅ **Permuta cadastrada!**\n\nAtivo: **${e.assetName}**\nTipo: ${e.assetType}\nValor: ${BRL(e.estimatedValue || 0)}${e.seeking ? `\nProcura: ${e.seeking}` : ''}`;
        setMessages(pv => [...pv, { id: Date.now().toString(), role: 'assistant', content: reply, timestamp: new Date() }]);
      } else if (action === 'query') {
        setMessages(pv => [...pv, { id: Date.now().toString(), role: 'assistant', content: data?.answer || data?.message || 'OK', timestamp: new Date() }]);
      } else if (action === 'generate_ad') {
        setMessages(pv => [...pv, { id: Date.now().toString(), role: 'assistant', content: `📢 **Anúncio Gerado**\n\n${data?.adText || data?.ad || ''}`, timestamp: new Date() }]);
      } else if (action === 'find_exchange_matches') {
        const matches = await api.fetchMatches();
        const reply = matches.length > 0
          ? `🎯 **${matches.length} matches encontrados:**\n\n${matches.slice(0, 5).map((m: any) => {
            const from = m.exchangeA?.assetName || 'desconhecido';
            const to = m.exchangeB?.assetName || 'desconhecido';
            return `- **${from}** ⇄ **${to}** (${m.matchScore}%)`;
          }).join('\n')}`
          : 'Nenhum match encontrado. Cadastre permutas primeiro!';
        setMessages(pv => [...pv, { id: Date.now().toString(), role: 'assistant', content: reply, timestamp: new Date() }]);
      } else {
        await localProcess(text);
      }
    } catch {
      setMessages(pv => pv.filter(m => m.id !== thinkingId));
      await localProcess(text);
    }
  };

  const localProcess = async (text: string) => {
    const lower = text.toLowerCase();

    if (lower.includes('cadastrar') || lower.includes('novo')) {
      setMessages(pv => [...pv, { id: Date.now().toString(), role: 'assistant', content: 'Para cadastrar, use o formulário ou tente:\n\n"Adicionar imóvel: casa em Capão, 3 dorm, 500 mil"\n"Cadastrar cliente: Maria, fone 51 99999-9999"\n"Adicionar permuta: Caminhão 400 mil, procuro terreno"', timestamp: new Date() }]);
    } else if (lower.includes('permuta') || lower.includes('match')) {
      try {
        const matches = await api.fetchMatches();
        const reply = matches.length > 0
          ? `🎯 **${matches.length} matches encontrados:**\n\n${matches.slice(0, 5).map((m: any) => {
            const from = m.exchangeA?.assetName || m.exchangeIdA;
            const to = m.exchangeB?.assetName || m.exchangeIdB;
            return `- **${from}** ⇄ **${to}** (${m.matchScore}%)`;
          }).join('\n')}`
          : 'Nenhum match no momento. Cadastre permutas com visibilidade "Rede" para encontrar matches.';
        setMessages(pv => [...pv, { id: Date.now().toString(), role: 'assistant', content: reply, timestamp: new Date() }]);
      } catch {
        setMessages(pv => [...pv, { id: Date.now().toString(), role: 'assistant', content: 'Erro ao buscar matches. Tente novamente.', timestamp: new Date() }]);
      }
    } else if (lower.includes('anúncio') || lower.includes('anuncio')) {
      try {
        const props = await api.fetchProperties();
        const ad = await api.generateAd(JSON.stringify(props[0] || {}));
        const reply = `📢 **Anúncio Gerado**\n\n${ad.title ? `**${ad.title}**\n\n` : ''}${ad.description || ''}${ad.tags?.length ? `\n\nTags: ${ad.tags.join(', ')}` : ''}`;
        setMessages(pv => [...pv, { id: Date.now().toString(), role: 'assistant', content: reply, timestamp: new Date() }]);
      } catch {
        setMessages(pv => [...pv, { id: Date.now().toString(), role: 'assistant', content: 'Erro ao gerar anúncio. Verifique se há imóveis cadastrados.', timestamp: new Date() }]);
      }
    } else if (lower.includes('cliente') || lower.includes('quente') || lower.includes('frio')) {
      try {
        const clients = await api.fetchClients();
        const hot = clients.filter((c: any) => c.funil === 'quente');
        const warm = clients.filter((c: any) => c.funil === 'morno');
        const cold = clients.filter((c: any) => c.funil === 'frio');
        const reply = `**Funil de Vendas**\n\n🔥 Quentes: ${hot.length}\n💛 Mornos: ${warm.length}\n❄️ Frios: ${cold.length}\n\n${hot.length > 0 ? `\n**Clientes quentes:**\n${hot.slice(0, 3).map((c: any) => `- ${c.name}${c.phone ? ` - ${c.phone}` : ''}`).join('\n')}` : ''}`;
        setMessages(pv => [...pv, { id: Date.now().toString(), role: 'assistant', content: reply, timestamp: new Date() }]);
      } catch {
        setMessages(pv => [...pv, { id: Date.now().toString(), role: 'assistant', content: 'Erro ao buscar clientes.', timestamp: new Date() }]);
      }
    } else {
      setMessages(pv => [...pv, {
        id: Date.now().toString(), role: 'assistant', content: `Comandos disponíveis:\n\n📝 **Cadastrar** — imóveis, clientes, proprietários, permutas\n🎯 **Permutas** — buscar matches automáticos\n📢 **Anúncios** — gerar anúncios com IA\n🔥 **Funil** — ver status dos clientes\n\n💡 *Dica: Quanto mais detalhes você der, melhor a IA entende!*`,
        timestamp: new Date()
      }]);
    }
  };

  const sendText = (text: string) => {
    if (!text.trim() || processing) return;
    const msg = text.trim();
    setMessages(pv => [...pv, { id: Date.now().toString(), role: 'user', content: msg, timestamp: new Date() }]);
    setInput('');
    setProcessing(true);
    processCommand(msg).finally(() => setProcessing(false));
  };

  const handleSend = () => sendText(input);

  const toggleMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setMessages(pv => [...pv, { id: Date.now().toString(), role: 'assistant', content: 'Reconhecimento de voz não disponível neste navegador. Use Chrome ou Edge.', timestamp: new Date() }]); return; }
    if (listening) { setListening(false); return; }
    setListening(true);
    const r = new SR();
    r.lang = 'pt-BR';
    r.interimResults = true;
    r.continuous = false;
    let finalTranscript = '';
    r.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalTranscript = e.results[i][0].transcript;
          setInput(finalTranscript);
        }
      }
    };
    r.onerror = () => setListening(false);
    r.onend = () => {
      setListening(false);
      if (finalTranscript.trim()) {
        // Aguarda 2.5s para dar tempo do usuário terminar de falar
        setTimeout(() => sendText(finalTranscript), 2500);
      }
    };
    r.start();
  };

  const renderContent = (content: string) => {
    const parts = content.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-slate-100 font-semibold">{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="h-14 border-b border-slate-800/60 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-viva-600 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">IA VIVA</p>
            <p className="text-[10px] text-viva-400">Assistente Inteligente</p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-auto px-3 py-4 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
              msg.role === 'user' ? 'bg-viva-600/20 text-slate-100' : 'bg-slate-800/60 text-slate-200'
            }`}>
              {renderContent(msg.content)}
              <p className="text-[10px] text-slate-600 mt-1">{msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        ))}
        {processing && (
          <div className="flex justify-start">
            <div className="bg-slate-800/60 rounded-xl px-3 py-2 text-sm text-slate-400 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processando...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 pb-2">
        <p className="text-[10px] text-slate-600 mb-1">Ações rápidas:</p>
        <div className="flex flex-wrap gap-1">
          {QUICK.map(a => (
            <button key={a} onClick={() => setInput(a)} className="px-2 py-1 rounded-full bg-slate-800/60 text-[10px] text-slate-400 hover:bg-viva-500/15 hover:text-viva-400 transition-colors">{a}</button>
          ))}
        </div>
      </div>

      <div className="p-3 border-t border-slate-800/60">
        <div className="flex items-center gap-2">
          <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Fale ou digite o comando..." className="input flex-1" disabled={processing} />
          <button onClick={toggleMic} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${listening ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
            <Mic size={16} />
          </button>
          <button onClick={handleSend} disabled={processing || !input.trim()} className="btn-primary !px-0 w-8 h-8 rounded-lg flex items-center justify-center">
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
