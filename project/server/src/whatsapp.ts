import { makeWASocket, useMultiFileAuthState, DisconnectReason, type WAMessageContent, type WAMessageKey } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { prisma } from './db.js';
import { handleIncomingMessage } from './whatsapp-ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, '..', 'wa_auth');
const QR_CALLBACKS: ((qr: string) => void)[] = [];
function campaignLog(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(path.join(__dirname, '..', 'campaign.log'), line, 'utf8');
}

let sock: ReturnType<typeof makeWASocket> | null = null;
let connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
let currentQr: string | null = null;

// Campaign state
interface CampaignJob {
  userId: string;
  contacts: { phone: string; name: string; propertyId: string; vars: Record<string, any> }[];
  template: string;
  dailyLimit: number;
  sentToday: number;
  totalSent: number;
  active: boolean;
  date: string;
  lastContactDate: string;
  varied?: boolean;
}
let campaign: CampaignJob | null = null;
let campaignInterval: NodeJS.Timeout | null = null;

function ensureDir() {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
}

export function getStatus() {
  return { status: connectionStatus, hasQr: currentQr !== null };
}

export function getCurrentQr() {
  return currentQr;
}

export function onQr(cb: (qr: string) => void) {
  QR_CALLBACKS.push(cb);
  return () => { const i = QR_CALLBACKS.indexOf(cb); if (i >= 0) QR_CALLBACKS.splice(i, 1); };
}

const processedMessages = new Set<string>();

export async function connect(forceFresh = false) {
  ensureDir();

  // Properly close existing socket before creating a new one
  if (sock) {
    try {
      (sock as any).removeAllListeners('connection.update');
      (sock as any).removeAllListeners('creds.update');
      (sock as any).removeAllListeners('messages.upsert');
      sock.end(new Error('Reconnecting'));
    } catch {}
    sock = null;
  }

  if (forceFresh) {
    try {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      ensureDir();
    } catch {}
  }

  connectionStatus = 'connecting';

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    syncFullHistory: false,
    browser: ['NEXIV CRM', 'Chrome', '120.0.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      currentQr = qr;
      QR_CALLBACKS.forEach(cb => cb(qr));
    }
    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      connectionStatus = 'disconnected';
      currentQr = null;
      sock = null;
      if (shouldReconnect) {
        setTimeout(connect, 5000);
      }
    } else if (connection === 'open') {
      connectionStatus = 'connected';
      currentQr = null;
      const connectedUser = (sock as any)?.user;
      campaignLog(`WA connected as: ${JSON.stringify({ id: connectedUser?.id, name: connectedUser?.name })}`);
      // Resume campaign if active
      if (campaign?.active) startCampaignLoop();
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      const fromMe = msg.key?.fromMe;
      const jid = msg.key?.remoteJid;
      if (fromMe) {
        campaignLog(`messages.upsert fromMe=true jid=${jid} id=${msg.key?.id}`);
        continue;
      }
      if (msg.key.remoteJid?.includes('@g.us')) continue; // ignore groups
      if (msg.key.remoteJid?.includes('@s.whatsapp.net')) {
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        if (!text.trim()) continue;

        // Dedup
        const msgId = msg.key.id || '';
        if (processedMessages.has(msgId)) continue;
        processedMessages.add(msgId);

        const reply = await handleIncomingMessage(msg.key.remoteJid, text);
        if (reply && sock) {
          await sleep(randomDelay(2000, 4000));
          await sock.sendMessage(msg.key.remoteJid, { text: reply });
        }
      }
    }
  });
}

export async function disconnect() {
  stopCampaign();
  if (sock) {
    sock.end(new Error('Manually disconnected'));
    sock = null;
  }
  connectionStatus = 'disconnected';
  currentQr = null;
  QR_CALLBACKS.length = 0;
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function randomDelay(min = 2000, max = 5000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 || digits.length === 10) return `55${digits}`;
  if (digits.length === 13 && digits.startsWith('55')) return digits;
  return digits;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export async function sendMessage(to: string, text: string) {
  if (!sock || connectionStatus !== 'connected') throw new Error('WhatsApp não conectado');

  const jid = `${normalizePhone(to)}@s.whatsapp.net`;

  const result = await sock.sendMessage(jid, { text });

  return result;
}

export async function sendWithVariations(to: string, baseText: string, variations: string[]) {
  const idx = Math.floor(Math.random() * variations.length);
  const finalText = variations[idx];
  return sendMessage(to, finalText);
}

export function applyTemplate(template: string, vars: Record<string, any>): string {
  let msg = template;
  for (const [key, val] of Object.entries(vars)) {
    msg = msg.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), String(val ?? ''));
  }
  return msg;
}

export async function sendTemplated(to: string, template: string, vars: Record<string, any>) {
  const msg = applyTemplate(template, vars);
  return sendMessage(to, msg);
}

const MESSAGE_VARIATIONS = [
  `{{greeting}}! {{location}} continua disponível?`,
  `{{greeting}}! {{location}} ainda está disponível?`,
  `{{greeting}}! O {{location}} segue à venda?`,
  `{{greeting}}! Tudo certo? Só passando pra saber se o {{location}} ainda tá disponível.`,
  `{{greeting}}! O {{location}} ainda está no mercado? Tô atualizando aqui e queria confirmar.`,
  `{{greeting}}! Só uma dúvida rápida — o {{location}} ainda está disponível ou já saiu?`,
  `{{greeting}}! Vi aqui no sistema que o {{location}} tá como disponível. Ainda está mesmo?`,
  `{{greeting}}! O {{location}} já foi vendido ou ainda está?`,
  `{{greeting}}! Passando pra saber se o {{location}} segue disponível. Pode me confirmar?`,
  `{{greeting}}! O {{location}} também está disponível, né? Só confirmando.`,
  `{{greeting}}! Pode me dizer se o {{location}} continua à venda?`,
  `{{greeting}}! Tudo tranquilo? Só pra confirmar — o {{location}} ainda está disponível aqui?`,
  `{{greeting}}! O {{code}} segue ativo ou já foi negociado?`,
  `{{greeting}}! Aquele {{location}} ainda tá?`,
  `{{greeting}}! Tô revisando os imóveis aqui. O {{location}} ainda está disponível?`,
  `{{greeting}}! Só passando pra dar uma atualizada — {{location}} ainda no mercado?`,
];

function cleanUnit(raw: string): string {
  return raw.replace(/^(apto|ap|apto\.|apartamento|casa|sala|loja|sobrado|kitnet|flat)\s+/i, '');
}

export function generateVariedMessage(vars: Record<string, any>): string {
  const hour = new Date().getHours();
  const isMorning = hour >= 5 && hour < 12;
  const isAfternoon = hour >= 12 && hour < 18;
  let greeting: string;
  if (isMorning) greeting = 'Bom dia';
  else if (isAfternoon) greeting = 'Boa tarde';
  else greeting = 'Boa noite';

  const fullName = vars.owner_name || vars.client_name || '';
  const firstName = fullName.split(' ')[0] || fullName;

  // Sometimes use just the greeting (no name) for variety
  const useSimpleGreeting = Math.random() < 0.15;
  const greetingText = useSimpleGreeting ? greeting : `${greeting}, ${firstName}`;

  const rawUnit = vars.property_unit || '';
  const unit = cleanUnit(rawUnit);

  const bld = (vars.property_building || '').trim();
  const u = unit.trim();
  const location = bld && u ? `${bld} ${u}` : (bld || u);
  const code = (vars.property_code || '').trim();

  const templateVars: Record<string, string> = {
    greeting: greetingText,
    building: bld,
    unit: u,
    location,
    code,
    neighborhood: vars.property_neighborhood || '',
    city: vars.property_city || '',
    price: vars.property_price || '',
  };

  const idx = Math.floor(Math.random() * MESSAGE_VARIATIONS.length);
  let msg = MESSAGE_VARIATIONS[idx];
  for (const [key, val] of Object.entries(templateVars)) {
    msg = msg.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), val);
  }
  msg = msg.replace(/\s+/g, ' ').trim();

  // Add emoji occasionally
  if (Math.random() < 0.3) {
    const emojis = ['😊', '👍', '🙏', '😃', ''];
    msg += ' ' + emojis[Math.floor(Math.random() * emojis.length)];
  }

  return msg.trim();
}

// ===================== CAMPAIGN SYSTEM =====================

function stopCampaign() {
  if (campaignInterval) {
    clearInterval(campaignInterval);
    campaignInterval = null;
  }
}

export function getCampaignStatus() {
  if (!campaign) return { active: false };
  const today = new Date().toISOString().slice(0, 10);
  if (campaign.date !== today) {
    campaign.sentToday = 0;
    campaign.date = today;
  }
  return {
    active: campaign.active,
    dailyLimit: campaign.dailyLimit,
    sentToday: campaign.sentToday,
    totalSent: campaign.totalSent,
    totalContacts: campaign.contacts.length,
    remaining: Math.max(0, campaign.contacts.length - campaign.totalSent),
  };
}

export async function startCampaign(
  userId: string,
  contacts: { phone: string; name: string; propertyId: string; vars: Record<string, any> }[],
  template: string,
  dailyLimit: number,
) {
  stopCampaign();
  campaign = {
    userId,
    contacts: [...contacts],
    template,
    dailyLimit,
    sentToday: 0,
    totalSent: 0,
    active: true,
    date: new Date().toISOString().slice(0, 10),
    lastContactDate: '',
  };
  startCampaignLoop();
}

export async function startVariedCampaign(
  userId: string,
  contacts: { phone: string; name: string; propertyId: string; vars: Record<string, any> }[],
  dailyLimit: number,
) {
  stopCampaign();
  campaign = {
    userId,
    contacts: [...contacts],
    template: '',
    dailyLimit,
    sentToday: 0,
    totalSent: 0,
    active: true,
    date: new Date().toISOString().slice(0, 10),
    lastContactDate: '',
    varied: true,
  };
  startCampaignLoop();
}

async function campaignTick() {
  if (!campaign || !campaign.active || !sock || connectionStatus !== 'connected') {
    scheduleNextTick();
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  if (campaign.date !== today) {
    campaign.sentToday = 0;
    campaign.date = today;
  }

  if (campaign.sentToday >= campaign.dailyLimit) { scheduleNextTick(); return; }
  if (campaign.totalSent >= campaign.contacts.length) {
    campaign.active = false;
    stopCampaign();
    return;
  }

  const nextContact = campaign.contacts[campaign.totalSent];
  if (!nextContact) {
    campaign.active = false;
    stopCampaign();
    return;
  }

  try {
    const msg = campaign.varied ? generateVariedMessage(nextContact.vars) : applyTemplate(campaign.template, nextContact.vars);
    const result = await sendMessage(nextContact.phone, msg);
    campaignLog(`send OK to ${nextContact.phone}: ${JSON.stringify(result)}`);
    await prisma.whatsAppMessage.create({
      data: {
        userId: campaign.userId,
        to: nextContact.phone,
        content: msg,
        status: 'sent',
        trigger: 'campaign',
        referenceId: nextContact.propertyId,
      },
    });
    campaign.sentToday++;
    campaign.totalSent++;
  } catch (e: any) {
    campaignLog(`send ERROR to ${nextContact.phone}: ${e?.message || e}`);
    campaign.totalSent++;
  }
  scheduleNextTick();
}

function scheduleNextTick() {
  if (campaignInterval) clearTimeout(campaignInterval);
  if (!campaign || !campaign.active) return;
  campaignInterval = setTimeout(campaignTick, randomDelay(3000, 7000));
}

function startCampaignLoop() {
  stopCampaign();
  scheduleNextTick();
}

export function stopCampaignManually() {
  if (campaign) {
    campaign.active = false;
    stopCampaign();
  }
}

// Automation: execute a rule
export async function executeRule(ruleId: string, vars: Record<string, any>) {
  const rule = await prisma.automationRule.findUnique({ where: { id: ruleId } });
  if (!rule || !rule.active) return;

  let targetPhone: string | null = null;

  if (rule.target === 'owner' && vars.owner_phone) {
    targetPhone = vars.owner_phone;
  } else if (rule.target === 'client' && vars.client_phone) {
    targetPhone = vars.client_phone;
  }

  if (!targetPhone) return;

  const message = applyTemplate(rule.template, vars);

  try {
    const result = await sendMessage(targetPhone, message);
    await prisma.whatsAppMessage.create({
      data: {
        userId: rule.userId,
        to: targetPhone,
        content: message,
        status: 'sent',
        trigger: rule.trigger,
        referenceId: vars.property_id || vars.client_id || null,
      },
    });
  } catch (err: any) {
    await prisma.whatsAppMessage.create({
      data: {
        userId: rule.userId,
        to: targetPhone,
        content: message,
        status: 'failed',
        trigger: rule.trigger,
        referenceId: vars.property_id || vars.client_id || null,
      },
    });
  }

  await sleep(randomDelay(3000, 7000));
}

// Auto-connect on startup if auth state exists
ensureDir();
if (fs.existsSync(path.join(AUTH_DIR, 'creds.json'))) {
  connect().catch(() => {});
}
