import { useState, useEffect } from 'react';
import { TrendingUp, MessageCircle, CheckCircle, Users, Target, BarChart3, MapPin, Activity } from 'lucide-react';

const API = '/api';
function authHeaders(): Record<string, string> { const uid = localStorage.getItem('viva_user_id') || ''; return uid ? { 'x-user-id': uid } : {}; }
async function apiFetch(path: string, opts: RequestInit = {}) {
  const { body, ...rest } = opts;
  const headers = { ...authHeaders(), ...(rest.headers || {}) as Record<string, string> };
  return fetch(`${API}${path}`, { ...rest, headers, body: body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof URLSearchParams) ? JSON.stringify(body) : body });
}

export default function Analytics() {
  const [stats, setStats] = useState<any>({ total: 0, sent: 0, failed: 0, replies: 0 });

  useEffect(() => {
    Promise.all([
      apiFetch('/whatsapp/messages').then(r => r.json()),
      apiFetch('/whatsapp/replies').then(r => r.json()),
    ]).then(([msgs, reps]) => {
      const msgsArr = Array.isArray(msgs) ? msgs : [];
      const repsArr = Array.isArray(reps) ? reps : [];
      setStats({
        total: msgsArr.length,
        sent: msgsArr.filter((m: any) => m.status === 'sent').length,
        failed: msgsArr.filter((m: any) => m.status !== 'sent').length,
        replies: repsArr.length,
      });
    }).catch(() => {});
  }, []);

  const metrics = [
    { label: 'Total Enviadas', value: stats.total, icon: SendIcon, color: 'text-viva-400', bg: 'bg-viva-500/10', change: '+12%' },
    { label: 'Entregues', value: stats.sent, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', change: `${stats.total > 0 ? Math.round(stats.sent / stats.total * 100) : 0}%` },
    { label: 'Falhas', value: stats.failed, icon: XCircleIcon, color: 'text-red-400', bg: 'bg-red-500/10', change: '-' },
    { label: 'Respostas', value: stats.replies, icon: MessageCircle, color: 'text-amber-400', bg: 'bg-amber-500/10', change: `${stats.replies > 0 ? '+' : ''}${stats.replies}` },
  ];

  const dailyData = [
    { day: 'Seg', value: 12 }, { day: 'Ter', value: 18 }, { day: 'Qua', value: 8 },
    { day: 'Qui', value: 22 }, { day: 'Sex', value: 15 }, { day: 'Sáb', value: 5 }, { day: 'Dom', value: 2 },
  ];

  const maxVal = Math.max(...dailyData.map(d => d.value));

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metrics.map(m => (
          <div key={m.label} className="surface-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-lg ${m.bg} flex items-center justify-center`}>
                <m.icon className={`w-4 h-4 ${m.color}`} />
              </div>
              <span className="text-[10px] font-medium text-emerald-400">{m.change}</span>
            </div>
            <p className="text-xl font-bold text-primary">{m.value}</p>
            <p className="text-[10px] text-muted">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="surface-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-viva-400" />
              Mensagens por Dia
            </h3>
          </div>
          <div className="flex items-end gap-2 h-40">
            {dailyData.map(d => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-viva-500/20 rounded-t-lg relative" style={{ height: `${(d.value / maxVal) * 100}%` }}>
                  <div className="absolute inset-0 bg-viva-400/30 rounded-t-lg" />
                </div>
                <span className="text-[9px] text-muted">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-card p-5">
          <h3 className="text-sm font-semibold text-primary flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-viva-400" />
            Taxas
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Taxa de Entrega', value: stats.total > 0 ? Math.round(stats.sent / stats.total * 100) : 0, color: 'bg-emerald-400' },
              { label: 'Taxa de Resposta', value: stats.sent > 0 ? Math.round(stats.replies / stats.sent * 100) : 0, color: 'bg-amber-400' },
              { label: 'Taxa de Leitura', value: 68, color: 'bg-blue-400' },
            ].map(t => (
              <div key={t.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted">{t.label}</span>
                  <span className="font-medium text-primary">{t.value}%</span>
                </div>
                <div className="w-full h-2 bg-white/[0.05] rounded-full overflow-hidden">
                  <div className={`h-full ${t.color} rounded-full transition-all duration-500`} style={{ width: `${t.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="surface-card p-5">
          <h3 className="text-sm font-semibold text-primary flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-viva-400" />
            Horários
          </h3>
          {['08h', '10h', '12h', '14h', '16h', '18h', '20h'].map(h => {
            const v = Math.floor(Math.random() * 80) + 10;
            return (
              <div key={h} className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] text-muted w-7">{h}</span>
                <div className="flex-1 h-3 bg-white/[0.05] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-viva-500 to-emerald-400 rounded-full" style={{ width: `${v}%` }} />
                </div>
                <span className="text-[10px] font-medium text-primary">{v}%</span>
              </div>
            );
          })}
        </div>

        <div className="surface-card p-5">
          <h3 className="text-sm font-semibold text-primary flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-viva-400" />
            Corretores
          </h3>
          {['Você', 'Ana', 'Carlos', 'Maria'].map((name, i) => (
            <div key={name} className="flex items-center gap-3 py-2 border-b border-surface-border last:border-0">
              <div className="w-7 h-7 rounded-full bg-viva-500/20 flex items-center justify-center"><span className="text-[10px] font-medium text-viva-400">{name[0]}</span></div>
              <span className="text-xs text-primary flex-1">{name}</span>
              <span className="text-xs font-medium text-primary">{[42, 28, 15, 8][i]}</span>
            </div>
          ))}
        </div>

        <div className="surface-card p-5">
          <h3 className="text-sm font-semibold text-primary flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-viva-400" />
            Cidades
          </h3>
          {['Capão da Canoa', 'Xangri-lá', 'Tramandaí', 'Imbé', 'Torres'].map((c, i) => (
            <div key={c} className="flex items-center gap-2 py-1.5">
              <span className="text-[10px] text-muted w-2">{i + 1}</span>
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-primary">{c}</span>
                  <span className="text-muted">{[18, 12, 8, 5, 3][i]}</span>
                </div>
                <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                  <div className="h-full bg-viva-400 rounded-full" style={{ width: `${[60, 40, 27, 17, 10][i]}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SendIcon(props: any) { return <TrendingUp {...props} />; }
function XCircleIcon(props: any) { return (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
); }
