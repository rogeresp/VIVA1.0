import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Building2, Users, Target, ArrowLeftRight, Activity,
  Search, ChevronDown,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useTheme } from '../contexts/ThemeContext';
import { BRL } from '../lib/constants';
import propertyImg1 from '../assets/property-1.jpg';
import propertyImg2 from '../assets/property-2.jpg';

interface MockAlert {
  id: string;
  title: string;
  description: string;
  type: 'match' | 'alert' | 'info';
  time: string;
}

export default function Home() {
  const { profile } = useAuth();
  const { clients, properties, aiActions, refreshAll } = useData();
  const navigate = useNavigate();
  const [greeting, setGreeting] = useState('Bom dia');
  const [aiCommand, setAiCommand] = useState('');
  const [processingAI, setProcessingAI] = useState(false);

  useEffect(() => {
    refreshAll();
    const h = new Date().getHours();
    setGreeting(h >= 18 ? 'Boa noite' : h >= 12 ? 'Boa tarde' : 'Bom dia');
  }, [refreshAll]);

  const { theme } = useTheme();
  const firstName = profile?.full_name?.split(' ')[0] || 'Usuário';
  const availableProps = properties.filter(p => p.status === 'disponivel');
  const hotClients = clients.filter(c => c.funil === 'quente');
  const isDark = theme === 'dark';

  const compatibleClients = hotClients.filter(c =>
    availableProps.some(p => {
      const budgetOk = !c.budget_max || !p.sale_price || p.sale_price <= c.budget_max;
      const cityOk = !c.desired_city || (p.city && p.city.toLowerCase().includes(c.desired_city.toLowerCase()));
      return budgetOk && cityOk;
    })
  );

  const mockAlerts: MockAlert[] = aiActions.length > 0 ? aiActions.slice(0, 3).map(a => ({
    id: a.id,
    title: a.input,
    description: a.action_type,
    type: 'info' as const,
    time: 'Recente',
  })) : [
    { id: '1', title: 'Novo match encontrado', description: 'Cliente João compatível com imóvel IMV-ABC', type: 'match', time: '5 min' },
    { id: '2', title: 'Lembrete: Follow-up', description: 'Contatar cliente Maria sobre visita', type: 'alert', time: '1h' },
    { id: '3', title: 'Permuta sugerida', description: 'Possível troca entre apartamentos', type: 'info', time: '2h' },
  ];

  const handleActionClick = (action: string) => {
    switch (action) {
      case 'property': navigate('/imoveis?new=true'); break;
      case 'client': navigate('/clientes?new=true'); break;
      case 'opportunities': navigate('/permutas?match=true'); break;
      case 'exchange': navigate('/permutas?new=true'); break;
    }
  };

  const handleAICommand = async () => {
    if (!aiCommand.trim()) return;
    setProcessingAI(true);
    const lower = aiCommand.toLowerCase();
    setTimeout(() => {
      if (lower.includes('cliente')) {
        const nameMatch = aiCommand.match(/cliente\s+(\w+(?:\s+\w+)*)/i);
        const phoneMatch = aiCommand.match(/(\d{2}\s*\d{4,5}[-\s]?\d{4})/);
        const cityMatch = aiCommand.match(/cidade\s+(\w+(?:\s+\w+)?)/i);
        const params = new URLSearchParams();
        if (nameMatch) params.set('name', nameMatch[1]);
        if (phoneMatch) params.set('phone', phoneMatch[1]);
        if (cityMatch) params.set('city', cityMatch[1]);
        params.set('new', 'true');
        navigate(`/clientes?${params.toString()}`);
      } else if (lower.includes('imóvel') || lower.includes('imovel')) {
        const cityMatch = aiCommand.match(/em\s+(\w+(?:\s+\w+)?)/i);
        const valueMatch = aiCommand.match(/(\d+(?:\.\d+)*(?:,\d+)?)\s*(?:mil|milhão|milhãoes)?/i);
        const params = new URLSearchParams();
        if (cityMatch) params.set('city', cityMatch[1]);
        if (valueMatch) params.set('value', valueMatch[1]);
        params.set('new', 'true');
        navigate(`/imoveis?${params.toString()}`);
      } else if (lower.includes('buscar') || lower.includes('filtrar')) {
        const cityMatch = aiCommand.match(/em\s+(\w+(?:\s+\w+)?)/i);
        const valueMatch = aiCommand.match(/até\s+(\d+(?:\.\d+)*(?:,\d+)?)\s*(?:mil|m)?/i);
        const params = new URLSearchParams();
        if (cityMatch) params.set('city', cityMatch[1]);
        if (valueMatch) params.set('maxPrice', valueMatch[1]);
        navigate(`/imoveis?${params.toString()}`);
      } else {
        navigate('/imoveis');
      }
      setAiCommand('');
      setProcessingAI(false);
    }, 500);
  };

  const actions = [
    { icon: Building2, title: 'Cadastrar imóvel', desc: 'Adicione um novo imóvel ao portfólio', action: 'property' },
    { icon: Users, title: 'Cadastrar cliente', desc: 'Registre um novo cliente ou lead', action: 'client' },
    { icon: Target, title: 'Buscar oportunidades', desc: 'Encontre matches com IA', action: 'opportunities' },
    { icon: ArrowLeftRight, title: 'Criar permuta', desc: 'Inicie uma troca de ativos', action: 'exchange' },
  ];

  const fg = (alpha = 1) => isDark ? `rgba(240, 238, 235, ${alpha})` : `rgba(26, 27, 30, ${alpha})`;
  const muted = () => isDark ? 'rgba(240, 238, 235, 0.6)' : 'rgba(26, 27, 30, 0.6)';

  return (
    <div className="px-8 lg:px-12 pt-6 pb-16 max-w-[1600px] mx-auto">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-6 mb-8">
        <div className="min-w-0">
          <h1 className="text-display text-5xl lg:text-6xl leading-[1.05]" style={{ color: fg() }}>
            {greeting}, <span className="italic" style={{ color: '#4A9B63' }}>{firstName}!</span>
          </h1>
          <p className="mt-3 text-base" style={{ color: muted() }}>O que você quer fazer hoje?</p>
        </div>
      </div>

      {/* AI SEARCH */}
      <div className="surface-glass rounded-2xl flex items-center gap-3 px-5 py-4 mb-8">
        <Search className="h-5 w-5 shrink-0" style={{ color: muted() }} />
        <input
          type="text"
          value={aiCommand}
          onChange={e => setAiCommand(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAICommand()}
          placeholder="Pergunte à IA da VIVA o que desejar..."
          className="flex-1 bg-transparent outline-none text-sm"
          style={{ color: fg() }}
          disabled={processingAI}
        />
        {aiCommand && (
          <button
            onClick={handleAICommand}
            className="h-9 w-9 grid place-items-center rounded-xl transition hover:opacity-80"
            style={{ background: 'rgba(74, 155, 99, 0.15)', color: '#4A9B63' }}
          >
            <Sparkles className={`h-4 w-4 ${processingAI ? 'animate-pulse' : ''}`} />
          </button>
        )}
      </div>

      {/* ACTION CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {actions.map((a) => (
          <button
            key={a.title}
            onClick={() => handleActionClick(a.action)}
            className="surface-glass rounded-2xl p-5 text-left transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,0.3)] cursor-pointer group"
          >
            <div
              className="h-10 w-10 grid place-items-center rounded-xl mb-4 group-hover:opacity-80 transition-opacity"
              style={{ background: 'rgba(74, 155, 99, 0.12)', color: '#4A9B63' }}
            >
              <a.icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
            </div>
            <div className="text-sm font-semibold leading-snug" style={{ color: fg() }}>{a.title}</div>
            <div className="text-xs mt-1 leading-snug" style={{ color: muted() }}>{a.desc}</div>
          </button>
        ))}
      </div>

      {/* BOTTOM GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Funil */}
        <section className="surface-glass rounded-2xl p-6 lg:col-span-4">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-semibold" style={{ color: fg() }}>Funil de vendas</h3>
            <button
              className="text-xs inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border"
              style={{ color: muted(), borderColor: isDark ? '#1a2a23' : '#e4e2dd' }}
            >
              Este mês <ChevronDown className="h-3 w-3" />
            </button>
          </div>
          <div className="flex items-end gap-3 h-44">
            {(() => {
              const maxVal = Math.max(clients.length, 10);
              const items = [
                { label: 'Leads', value: Math.max(clients.length, 1) },
                { label: 'Qualificados', value: Math.max(hotClients.length, 1) },
                { label: 'Propostas', value: Math.max(Math.floor(clients.length * 0.3), 1) },
                { label: 'Negociações', value: Math.max(Math.floor(clients.length * 0.15), 1) },
                { label: 'Fechados', value: Math.max(properties.filter(p => p.status === 'vendido').length, 1) },
              ];
              return items.map((f) => {
                const pct = (f.value / maxVal) * 100;
                return (
                  <div key={f.label} className="flex-1 flex flex-col items-center gap-2">
                    <div className="text-xs font-semibold" style={{ color: fg() }}>{f.value}</div>
                    <div
                      className="w-full rounded-t-md"
                      style={{
                        height: `${pct}%`,
                        background: 'linear-gradient(180deg, rgba(74, 155, 99, 0.9), rgba(74, 155, 99, 0.55))',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)',
                      }}
                    />
                    <div className="text-[10px] text-center leading-tight" style={{ color: muted() }}>{f.label}</div>
                  </div>
                );
              });
            })()}
          </div>
        </section>

        {/* Alertas */}
        <section className="surface-glass rounded-2xl p-6 lg:col-span-4">
          <h3 className="text-base font-semibold mb-5" style={{ color: fg() }}>Alertas da IA</h3>
          <div className="space-y-4">
            {mockAlerts.map((alert) => (
              <div key={alert.id} className="flex items-start gap-3">
                <div
                  className="h-8 w-8 shrink-0 grid place-items-center rounded-lg"
                  style={{ background: 'rgba(74, 155, 99, 0.12)', color: '#4A9B63' }}
                >
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium" style={{ color: fg() }}>{alert.title}</div>
                  <div className="text-xs mt-0.5" style={{ color: muted() }}>{alert.description}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: fg(0.45) }}>{alert.time} atrás</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Clientes compatíveis */}
        <section className="surface-glass rounded-2xl p-6 lg:col-span-2 flex flex-col">
          <h3 className="text-base font-semibold mb-4" style={{ color: fg() }}>Clientes compatíveis hoje</h3>
          {compatibleClients.length > 0 ? (
            <div className="space-y-2 flex-1 overflow-auto">
              {compatibleClients.slice(0, 5).map(c => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/clientes?id=${c.id}`)}
                  className="w-full text-left surface-card rounded-xl p-3 transition cursor-pointer"
                >
                  <div className="text-xs font-medium truncate" style={{ color: fg() }}>{c.name}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: muted() }}>
                    {c.desired_city && <span>{c.desired_city} </span>}
                    {c.budget_max && <span>{BRL(c.budget_max)}</span>}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex-1 grid place-items-center">
              <div className="text-display text-7xl" style={{ color: fg(), fontWeight: 500 }}>{clients.length}</div>
              <div className="text-xs text-center mt-1" style={{ color: muted() }}>clientes cadastrados</div>
            </div>
          )}
        </section>

        {/* Novos imóveis */}
        <section className="surface-glass rounded-2xl p-6 lg:col-span-2">
          <h3 className="text-base font-semibold mb-4" style={{ color: fg() }}>Novos imóveis</h3>
          <div className="space-y-3">
            {[
              { img: propertyImg1, title: 'Apartamento Jardins', price: 'R$ 1.250.000' },
              { img: propertyImg2, title: 'Casa em Condomínio', price: 'R$ 2.800.000' },
            ].map((p) => (
              <div key={p.title}>
                <div
                  className="aspect-[16/10] rounded-xl overflow-hidden"
                  style={{ background: isDark ? 'rgba(240, 238, 235, 0.05)' : 'rgba(26, 27, 30, 0.05)' }}
                >
                  <img src={p.img} alt={p.title} loading="lazy" className="h-full w-full object-cover" />
                </div>
                <div className="mt-2 text-xs font-medium truncate" style={{ color: fg() }}>{p.title}</div>
                <div className="text-[11px]" style={{ color: muted() }}>{p.price}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
