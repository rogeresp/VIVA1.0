import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVOLUTION_URL = process.env.EVOLUTION_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const INSTANCE_NAME = 'viva1';

let connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
let currentQr: string | null = null;
const QR_CALLBACKS: ((qr: string) => void)[] = [];
let pollTimer: ReturnType<typeof setInterval> | null = null;

function log(msg: string) {
  const line = `[${new Date().toISOString()}] [EVO] ${msg}\n`;
  fs.appendFileSync(path.join(__dirname, '..', 'campaign.log'), line, 'utf8');
}

async function apiFetch(method: string, endpoint: string, body?: any) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (EVOLUTION_API_KEY) headers['apikey'] = EVOLUTION_API_KEY;
  const res = await fetch(`${EVOLUTION_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Evolution ${res.status}: ${text.slice(0, 200)}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(async () => {
    try {
      const state = await apiFetch('GET', `/instance/connectionState/${INSTANCE_NAME}`);
      if (state?.state === 'open') {
        if (connectionStatus !== 'connected') {
          connectionStatus = 'connected';
          currentQr = null;
          QR_CALLBACKS.forEach(cb => cb(''));
          log('Connected');
        }
      } else if (state?.state === 'connecting') {
        connectionStatus = 'connecting';
      } else {
        connectionStatus = 'disconnected';
      }
    } catch {
      connectionStatus = 'disconnected';
    }
  }, 3000);
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

export async function connect(forceFresh = false) {
  connectionStatus = 'connecting';
  currentQr = null;

  try {
    if (forceFresh) {
      try { await apiFetch('DELETE', `/instance/delete/${INSTANCE_NAME}`); } catch {}
    }

    try {
      await apiFetch('POST', '/instance/create', {
        instanceName: INSTANCE_NAME,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        websocket: false,
        webhook: { enabled: false },
      });
    } catch (e: any) {
      if (!e.message?.includes('409') && !e.message?.includes('already exists')) throw e;
    }

    // Try connect
    try {
      const connectResult = await apiFetch('GET', `/instance/connect/${INSTANCE_NAME}`);
      if (connectResult?.base64) {
        currentQr = connectResult.base64;
        QR_CALLBACKS.forEach(cb => cb(connectResult.base64));
        log('QR generated');
      }
    } catch (e: any) {
      log(`Connect error: ${e.message}`);
    }

    startPolling();
  } catch (e: any) {
    log(`Init error: ${e.message}`);
    connectionStatus = 'disconnected';
  }
}

export async function sendMessage(to: string, text: string) {
  if (connectionStatus !== 'connected') throw new Error('WhatsApp não conectado');
  const number = to.replace(/\D/g, '');
  const result = await apiFetch('POST', `/message/sendText/${INSTANCE_NAME}`, {
    number,
    text,
    delay: 0,
  });
  return result;
}

export function getStatus() {
  return { status: connectionStatus, hasQr: currentQr !== null };
}

export function getCurrentQr() {
  return currentQr;
}

export function onQr(cb: (qr: string) => void) {
  QR_CALLBACKS.push(cb);
  return () => {
    const i = QR_CALLBACKS.indexOf(cb);
    if (i >= 0) QR_CALLBACKS.splice(i, 1);
  };
}

export async function disconnect() {
  stopPolling();
  try { await apiFetch('DELETE', `/instance/logout/${INSTANCE_NAME}`); } catch {}
  try { await apiFetch('DELETE', `/instance/delete/${INSTANCE_NAME}`); } catch {}
  connectionStatus = 'disconnected';
  currentQr = null;
}

export async function checkNumber(number: string): Promise<boolean> {
  try {
    const clean = number.replace(/\D/g, '');
    const result = await apiFetch('POST', `/chat/whatsappNumbers/${INSTANCE_NAME}`, { numbers: [clean] });
    return Array.isArray(result) && result[0]?.exists === true;
  } catch { return false; }
}
