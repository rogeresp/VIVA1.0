import { useEffect } from 'react';
import { Users, Building2, ArrowLeftRight, Target, Activity, TrendingUp } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { BRL } from '../lib/constants';

export default function Dashboard() {
  const { clients, properties, exchanges, aiActions, refreshAll } = useData();

  useEffect(() => { refreshAll(); }, [refreshAll]);

  const available = properties.filter(p => p.status === 'disponivel');
  const hot = clients.filter(c => c.funil === 'quente');
  const warm = clients.filter(c => c.funil === 'morno');
  const cold = clients.filter(c => c.funil === 'frio');
  const portfolioValue = available.reduce((s, p) => s + (p.sale_price || 0), 0);
  const exchangeValue = exchanges.reduce((s, e) => s + (e.estimated_value || 0), 0);

  const stats = [
    { label: 'Clientes', value: clients.length, icon: Users, color: 'text-accent', bg: 'bg-primary/12', sub: `${hot.length} quentes` },
    { label: 'Imóveis', value: available.length, icon: Building2, color: 'text-accent', bg: 'bg-primary/12', sub: BRL(portfolioValue) },
    { label: 'Permutas', value: exchanges.length, icon: ArrowLeftRight, color: 'text-accent', bg: 'bg-primary/12', sub: BRL(exchangeValue) },
    { label: 'Matches', value: hot.length + warm.length, icon: Target, color: 'text-accent', bg: 'bg-primary/12', sub: 'potenciais' },
  ];

  const funil = [
    { label: 'Quente', count: hot.length, color: 'bg-rose-500' },
    { label: 'Morno', count: warm.length, color: 'bg-amber-500' },
    { label: 'Frio', count: cold.length, color: 'bg-sky-500' },
  ];
  const maxFunil = Math.max(...funil.map(f => f.count), 1);

  return (
    <div className="h-full overflow-auto relative">
      <div className="relative z-10 px-8 lg:px-12 pt-6 pb-16 max-w-[1600px] mx-auto">
        <div className="mb-8">
          <h1 className="font-display text-4xl lg:text-5xl leading-[1.05] text-primary">Dashboard</h1>
          <p className="mt-2 text-base text-muted">Visão geral da sua operação</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map(s => (
            <div key={s.label} className="surface-glass rounded-2xl p-5 transition hover:-translate-y-0.5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{s.label}</p>
                  <p className="text-2xl font-bold text-primary mt-0.5">{s.value}</p>
                  <p className="text-[11px] text-muted mt-0.5">{s.sub}</p>
                </div>
                <div className={`h-10 w-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <section className="surface-glass rounded-2xl p-6">
            <h3 className="text-base font-semibold text-primary flex items-center gap-2 mb-5">
              <TrendingUp className="w-4 h-4 text-accent" /> Funil de Clientes
            </h3>
            <div className="space-y-3">
              {funil.map(f => (
                <div key={f.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted">{f.label}</span>
                    <span className="text-muted">{f.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'color-mix(in srgb, var(--border) 50%, transparent)' }}>
                    <div className={`h-full ${f.color} rounded-full transition-all`} style={{ width: `${(f.count / maxFunil) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="flex justify-between text-xs">
                <span className="text-muted">Total</span>
                <span className="text-primary font-medium">{clients.length}</span>
              </div>
            </div>
          </section>

          <section className="surface-glass rounded-2xl p-6">
            <h3 className="text-base font-semibold text-primary flex items-center gap-2 mb-5">
              <Activity className="w-4 h-4 text-accent" /> Atividades da IA
            </h3>
            {aiActions.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--border)' }} />
                <p className="text-xs text-muted">A IA ainda não executou ações</p>
              </div>
            ) : (
              <div className="space-y-2">
                {aiActions.slice(0, 5).map(a => (
                  <div key={a.id} className="surface-card rounded-xl p-3 flex items-start gap-3">
                    <Activity className="w-3.5 h-3.5 text-accent mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-primary truncate">{a.input}</p>
                      <p className="text-[10px] text-muted">{a.action_type}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="surface-glass rounded-2xl p-6">
            <h3 className="text-base font-semibold text-primary flex items-center gap-2 mb-5">
              <Building2 className="w-4 h-4 text-accent" /> Últimos Imóveis
            </h3>
            {available.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--border)' }} />
                <p className="text-xs text-muted">Nenhum imóvel disponível</p>
              </div>
            ) : (
              <div className="space-y-2">
                {available.slice(0, 4).map(p => (
                  <div key={p.id} className="surface-card rounded-xl p-3 flex items-center gap-3">
                    <Building2 className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-primary font-medium truncate">{p.code} - {p.property_type}</p>
                      <p className="text-[10px] text-muted">{p.city || '—'} {p.sale_price ? `| ${BRL(p.sale_price)}` : ''}</p>
                    </div>
                    <span className={`badge ${p.status === 'disponivel' ? 'badge-available' : p.status === 'reservado' ? 'badge-reserved' : 'badge-sold'}`}>{p.status}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
