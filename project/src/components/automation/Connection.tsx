import { useState, useEffect } from 'react';
import { Smartphone, Wifi, WifiOff, QrCode, RefreshCw, Send, Clock, Shield, MessageCircle, Zap, Timer, Brain, GripHorizontal, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const API = '/api';
function authHeaders(): Record<string, string> { const uid = localStorage.getItem('viva_user_id') || ''; return uid ? { 'x-user-id': uid } : {}; }
async function apiFetch(path: string, opts: RequestInit = {}) {
  const { body, ...rest } = opts;
  const headers = { ...authHeaders(), ...(rest.headers || {}) as Record<string, string> };
  return fetch(`${API}${path}`, { ...rest, headers, body: body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof URLSearchParams) ? JSON.stringify(body) : body });
}

const ANTI_BAN = [
  { icon: Timer, title: 'Delay Inteligente', desc: '2 a 7 segundos aleatórios entre mensagens' },
  { icon: Brain, title: 'Digitação Simulada', desc: 'Simula "digitando..." antes de cada envio' },
  { icon: Clock, title: 'Horário Comercial', desc: 'Respeita horários configurados (8h-20h)' },
  { icon: MessageCircle, title: 'Mensagens Variadas', desc: '12 variações de mensagens para evitar padrão' },
  { icon: Zap, title: 'Intervalo Automático', desc: 'Pausas estratégicas a cada lote de envios' },
  { icon: Shield, title: 'Limite Diário', desc: 'Máximo 30 mensagens/dia por número' },
  { icon: GripHorizontal, title: 'Humanização', desc: 'Saudações por horário, emojis leves, tom natural' },
  { icon: CheckCircle, title: 'Anti-Spam', desc: 'Detecta e evita comportamentos de spam' },
];

export default function Connection() {
  const [waStatus, setWaStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [waInfo, setWaInfo] = useState<any>(null);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  async function checkStatus() {
    try {
      const res = await apiFetch('/whatsapp/status');
      const data = await res.json();
      setWaStatus(data.status);
      if (data.status === 'connecting' && data.hasQr) {
        const qrRes = await apiFetch('/whatsapp/qr');
        const qrData = await qrRes.json();
        if (qrData.qr) setQrCode(qrData.qr);
      }
      if (data.status === 'connected') {
        setQrCode(null);
        setPairingCode(null);
        const w = await apiFetch('/whatsapp/info').then(r => r.json()).catch(() => null);
        if (w) setWaInfo(w);
      }
    } catch {}
  }

  async function connect() {
    setWaStatus('connecting');
    setQrCode(null);
    setPairingCode(null);
    try {
      const res = await apiFetch('/whatsapp/connect', { method: 'POST' });
      const data = await res.json();
      if (data.qr) setQrCode(data.qr);
      setWaStatus(data.status);
      if (data.status === 'connected') setQrCode(null);
      if (data.status === 'connecting' && data.qr) {
        const interval = setInterval(async () => {
          const r = await apiFetch('/whatsapp/status');
          const s = await r.json();
          if (s.status === 'connected') { setWaStatus('connected'); setQrCode(null); clearInterval(interval); }
        }, 2000);
        setTimeout(() => clearInterval(interval), 120000);
      }
    } catch { setWaStatus('disconnected'); }
  }

  async function requestPair() {
    if (!phoneNumber) { alert('Digite seu número do WhatsApp'); return; }
    setWaStatus('connecting');
    setQrCode(null);
    setPairingCode(null);
    try {
      const res = await apiFetch('/whatsapp/pair', { method: 'POST', body: { phone: phoneNumber } });
      const data = await res.json();
      if (data.code) setPairingCode(data.code);
      const interval = setInterval(async () => {
        const r = await apiFetch('/whatsapp/status');
        const s = await r.json();
        if (s.status === 'connected') { setWaStatus('connected'); setPairingCode(null); clearInterval(interval); }
      }, 2000);
      setTimeout(() => clearInterval(interval), 120000);
    } catch { setWaStatus('disconnected'); }
  }

  async function disconnect() {
    await apiFetch('/whatsapp/disconnect', { method: 'POST' });
    setWaStatus('disconnected');
    setQrCode(null);
    setPairingCode(null);
    setWaInfo(null);
  }

  async function testSend() {
    const to = (document.getElementById('testNumber') as HTMLInputElement)?.value;
    if (!to) { alert('Digite um número'); return; }
    await apiFetch('/whatsapp/test-send', { method: 'POST', body: { to } });
    alert('Mensagem de teste enviada! Verifique seu WhatsApp.');
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="surface-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  waStatus === 'connected' ? 'bg-emerald-500/20' : waStatus === 'connecting' ? 'bg-amber-500/20' : 'bg-red-500/20'
                }`}>
                  <Smartphone className={`w-5 h-5 ${
                    waStatus === 'connected' ? 'text-emerald-400' : waStatus === 'connecting' ? 'text-amber-400' : 'text-red-400'
                  }`} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-primary">WhatsApp</h2>
                  <p className="text-xs text-muted">Gerencie sua conexão com o WhatsApp</p>
                </div>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                waStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-400' : waStatus === 'connecting' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  waStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : waStatus === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-red-400'
                }`} />
                {waStatus === 'connected' ? 'Conectado' : waStatus === 'connecting' ? 'Conectando...' : 'Desconectado'}
              </div>
            </div>

            {waStatus === 'disconnected' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="surface-glass p-5 text-center space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-viva-500/20 flex items-center justify-center mx-auto">
                      <QrCode className="w-6 h-6 text-viva-400" />
                    </div>
                    <h3 className="text-sm font-medium text-primary">QR Code</h3>
                    <p className="text-xs text-muted">Escaneie com o WhatsApp do seu celular</p>
                    <button onClick={connect} className="btn-primary w-full justify-center gap-2 rounded-xl">
                      <QrCode className="w-4 h-4" />
                      Conectar com QR Code
                    </button>
                  </div>

                  <div className="surface-glass p-5 space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-viva-500/20 flex items-center justify-center">
                      <Smartphone className="w-6 h-6 text-viva-400" />
                    </div>
                    <h3 className="text-sm font-medium text-primary">Código de Pareamento</h3>
                    <p className="text-xs text-muted">Digite seu número com DDD e país</p>
                    <div className="flex gap-2">
                      <input
                        type="text" value={phoneNumber}
                        onChange={e => setPhoneNumber(e.target.value)}
                        className="input flex-1" placeholder="5511999999999"
                      />
                      <button onClick={requestPair} className="btn-primary gap-2 rounded-xl whitespace-nowrap">
                        <Smartphone className="w-4 h-4" />
                        Código
                      </button>
                    </div>
                    <p className="text-[10px] text-muted">Vá em: WhatsApp {'>'} Dispositivos Conectados {'>'} Conectar dispositivo</p>
                  </div>
                </div>
              </div>
            )}

            {qrCode && (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted">Escaneie o QR Code com o WhatsApp do seu celular</p>
                <div className="inline-block p-4 bg-white rounded-2xl shadow-premium-lg">
                  <img src={`data:image/png;base64,${qrCode}`} alt="QR Code" className="w-56 h-56" />
                </div>
                <div className="flex gap-2 justify-center">
                  <button onClick={connect} className="btn-ghost gap-2 rounded-xl">
                    <RefreshCw className="w-4 h-4" /> Gerar novo QR
                  </button>
                  <button onClick={disconnect} className="btn-ghost gap-2 rounded-xl text-red-400">
                    <WifiOff className="w-4 h-4" /> Cancelar
                  </button>
                </div>
              </div>
            )}

            {pairingCode && (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted">Digite o código abaixo no seu WhatsApp:</p>
                <p className="text-xs text-muted">WhatsApp {'>'} Dispositivos Conectados {'>'} Conectar dispositivo</p>
                <div className="inline-block px-8 py-5 surface-glass rounded-2xl">
                  <span className="text-3xl font-mono font-bold tracking-[0.3em] text-viva-400">{pairingCode}</span>
                </div>
                <div className="flex gap-2 justify-center">
                  <button onClick={requestPair} className="btn-ghost gap-2 rounded-xl">
                    <RefreshCw className="w-4 h-4" /> Gerar novo código
                  </button>
                  <button onClick={disconnect} className="btn-ghost gap-2 rounded-xl text-red-400">
                    <WifiOff className="w-4 h-4" /> Cancelar
                  </button>
                </div>
              </div>
            )}

            {waStatus === 'connected' && (
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 surface-glass rounded-xl">
                  <div className="w-14 h-14 rounded-full bg-viva-500/20 flex items-center justify-center">
                    <Smartphone className="w-7 h-7 text-viva-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary">{waInfo?.name || 'WhatsApp Conectado'}</p>
                    <p className="text-xs text-muted">{waInfo?.number || 'Número conectado'}</p>
                  </div>
                  <div className="text-right text-xs text-muted">
                    <p className="text-emerald-400 font-medium">Online</p>
                    <p>{waInfo?.since || 'Conectado'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Mensagens hoje', value: waInfo?.sentToday || '0', icon: Send, color: 'text-viva-400' },
                    { label: 'Tempo conectado', value: waInfo?.uptime || '—', icon: Clock, color: 'text-amber-400' },
                    { label: 'Última sinc.', value: waInfo?.lastSync || '—', icon: RefreshCw, color: 'text-blue-400' },
                  ].map(s => (
                    <div key={s.label} className="surface-glass p-3 rounded-xl text-center">
                      <s.icon className={`w-4 h-4 ${s.color} mx-auto mb-1`} />
                      <p className="text-lg font-bold text-primary">{s.value}</p>
                      <p className="text-[10px] text-muted">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input type="text" id="testNumber" className="input flex-1" placeholder="Nº do celular para teste (ex: 5551999999999)" />
                  <button onClick={testSend} className="btn-primary gap-2 rounded-xl whitespace-nowrap">
                    <Send className="w-4 h-4" /> Testar Envio
                  </button>
                </div>

                <div className="flex gap-2">
                  <button onClick={connect} className="btn-ghost flex-1 justify-center gap-2 rounded-xl">
                    <RefreshCw className="w-4 h-4" /> Reconectar
                  </button>
                  <button onClick={disconnect} className="btn-ghost flex-1 justify-center gap-2 rounded-xl text-red-400">
                    <WifiOff className="w-4 h-4" /> Desconectar
                  </button>
                </div>
              </div>
            )}

            {!qrCode && !pairingCode && waStatus === 'connecting' && (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-6 h-6 text-amber-400 animate-spin" />
                </div>
                <p className="text-sm text-muted">Conectando ao WhatsApp...</p>
                <button onClick={disconnect} className="btn-ghost gap-2 rounded-xl text-red-400 mt-4">
                  <WifiOff className="w-4 h-4" /> Cancelar
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="surface-card p-5">
            <h3 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-viva-400" />
              Boas Práticas Anti-Ban
            </h3>
            <div className="space-y-2.5">
              {ANTI_BAN.map(item => (
                <div key={item.title} className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-viva-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <item.icon className="w-3.5 h-3.5 text-viva-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-primary">{item.title}</p>
                    <p className="text-[10px] text-muted">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
