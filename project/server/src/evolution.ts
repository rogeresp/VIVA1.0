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

async function apiFetch(method: string, endpoint: string, body?: any, timeoutMs = 60000) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (EVOLUTION_API_KEY) headers['apikey'] = EVOLUTION_API_KEY;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${EVOLUTION_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Evolution ${res.status}: ${text.slice(0, 200)}`);
    }
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  } finally {
    clearTimeout(timer);
  }
}

let pollFailCount = 0;

function startPolling() {
  stopPolling();
  pollFailCount = 0;
  pollTimer = setInterval(async () => {
    try {
      const res = await apiFetch('GET', `/instance/connectionState/${INSTANCE_NAME}`, undefined, 30000);
      pollFailCount = 0;
      const state = res?.instance?.state || res?.state || 'unknown';
      if (state === 'open') {
        if (connectionStatus !== 'connected') {
          connectionStatus = 'connected';
          currentQr = null;
          QR_CALLBACKS.forEach(cb => cb(''));
          log('Connected');
        }
      } else if (state === 'connecting') {
        connectionStatus = 'connecting';
      } else {
        connectionStatus = 'disconnected';
      }
    } catch {
      pollFailCount++;
      if (pollFailCount >= 3) {
        connectionStatus = 'disconnected';
      }
    }
  }, 3000);
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

export async function connect(forceFresh = false) {
  // Check if already connected
  try {
    const inst = await apiFetch('GET', `/instance/connectionState/${INSTANCE_NAME}`, undefined, 10000);
    if (inst?.instance?.state === 'open') {
      connectionStatus = 'connected';
      currentQr = null;
      startPolling();
      return;
    }
  } catch {}

  connectionStatus = 'connecting';
  currentQr = null;

  try {
    if (forceFresh) {
      try { await apiFetch('DELETE', `/instance/delete/${INSTANCE_NAME}`, undefined, 10000); } catch {}
    }

    try {
      await apiFetch('POST', '/instance/create', {
        instanceName: INSTANCE_NAME,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
        syncFullHistory: false,
      }, 30000);
    } catch (e: any) {
      if (!e.message?.includes('409') && !e.message?.includes('already exists')) throw e;
    }

    // Try connect to get QR
    try {
      const connectResult = await apiFetch('GET', `/instance/connect/${INSTANCE_NAME}`, undefined, 15000);
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

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 || digits.length === 10) return `55${digits}`;
  if (digits.length === 13 && digits.startsWith('55')) return digits;
  return digits;
}

export async function sendMessage(to: string, text: string) {
  if (connectionStatus !== 'connected') throw new Error('WhatsApp não conectado');
  const number = normalizePhone(to);
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
