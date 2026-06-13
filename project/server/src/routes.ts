import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import Groq from 'groq-sdk';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function transformKeysIn(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(transformKeysIn);
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj.toISOString();
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    const ck = snakeToCamel(k);
    out[ck] = transformKeysIn(v);
  }
  return out;
}

function transformKeys(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(transformKeys);
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj.toISOString();
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    const sk = camelToSnake(k);
    if (sk === 'photos' && typeof v === 'string') {
      try { out[sk] = JSON.parse(v); } catch { out[sk] = []; }
    } else if (sk === 'amenities' && typeof v === 'string') {
      try { out[sk] = JSON.parse(v); } catch { out[sk] = []; }
    } else if (sk === 'videos' && typeof v === 'string') {
      try { out[sk] = JSON.parse(v); } catch { out[sk] = []; }
    } else {
      out[sk] = transformKeys(v);
    }
  }
  return out;
}

import {
  prisma, getProfile, upsertProfile,
  listOwners, createOwner, updateOwner, deleteOwner,
  listClients, createClient, updateClient, deleteClient,
  listProperties, listPropertiesByVisibility, createProperty, updateProperty, deleteProperty, batchImportProperties,
  listBuildings, searchBuildings, createBuilding,
  listExchanges, listPublicExchanges, createExchange, updateExchange, deleteExchange,
  findMatches, saveMatch, listMatches,
  listFeedPosts, createFeedPost,
  listConversations, createConversation, getMessages, sendMessage as sendChatMessage,
  getAiTraining, upsertAiTraining, logAiAction,
  listProfiles,
} from './db.js';
import {
  connect as waConnect, disconnect as waDisconnect, getStatus as waStatus,
  onQr, sendTemplated, applyTemplate, executeRule, sendMessage as waSendMessage, getCurrentQr,
  startCampaign, startVariedCampaign, getCampaignStatus, stopCampaignManually,
} from './whatsapp.js';
import QRCode from 'qrcode';

const upload = multer({ dest: 'uploads/' });
const router = Router();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

// Simple auth middleware (using user-id header for now, can be replaced with JWT)
function userId(req: Request): string | null {
  return (req.headers['x-user-id'] as string) || null;
}

function requireUser(req: Request, res: Response): string | false {
  const uid = userId(req);
  if (!uid) { res.status(401).json({ error: 'Usuário não autenticado' }); return false; }
  return uid;
}

// ===================== AUTH / PROFILE =====================
router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, name } = req.body;
    if (!email) { res.status(400).json({ error: 'Email obrigatório' }); return; }
    let profile = await prisma.profile.findUnique({ where: { email } });
    if (!profile) {
      profile = await prisma.profile.create({
        data: {
          id: email.replace(/[^a-zA-Z0-9]/g, '_'),
          email,
          name: name || email.split('@')[0],
          role: 'corretor',
        },
      });
    }
    const result = { ...profile, full_name: profile.name };
    delete (result as any).name;
    res.json(result);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/profile', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    let profile = await getProfile(uid);
    if (!profile) {
      profile = await upsertProfile({ id: uid, email: `${uid}@email.com`, name: uid });
    }
    const result = transformKeys(profile) as any;
    // Map Prisma 'name' to frontend 'full_name'
    if (result.name !== undefined) {
      result.full_name = result.name;
      delete result.name;
    }
    res.json(result);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/profile', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    let data = transformKeysIn(req.body) as any;
    // Map frontend 'fullName' to Prisma 'name'
    if (data.fullName !== undefined) {
      data.name = data.fullName;
      delete data.fullName;
    }
    const profile = await prisma.profile.update({
      where: { id: uid },
      data,
    });
    const result = transformKeys(profile) as any;
    if (result.name !== undefined) {
      result.full_name = result.name;
      delete result.name;
    }
    res.json(result);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/profiles', async (_req: Request, res: Response) => {
  try {
    const profiles = await listProfiles();
    res.json(transformKeys(profiles));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ===================== OWNERS =====================
router.get('/owners', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try { res.json(transformKeys(await listOwners(uid))); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/owners', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try { res.json(await createOwner({ ...req.body, userId: uid })); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/owners/:id', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try { res.json(await updateOwner(req.params.id as string, req.body)); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/owners/:id', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try { res.json(await deleteOwner(req.params.id as string)); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ===================== CLIENTS =====================
router.get('/clients', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try { res.json(transformKeys(await listClients(uid))); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/clients', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try { res.json(await createClient({ ...req.body, userId: uid })); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/clients/:id', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try { res.json(await updateClient(req.params.id as string, req.body)); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/clients/:id', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try { res.json(await deleteClient(req.params.id as string)); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ===================== PROPERTIES =====================
router.get('/properties', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const page = parseInt(req.query.page as string) || undefined;
    const limit = parseInt(req.query.limit as string) || undefined;
    const search = req.query.search as string || undefined;
    const type = req.query.type as string || undefined;
    const status = req.query.status as string || undefined;
    const buildingId = req.query.building_id as string || undefined;
    res.json(transformKeys(await listProperties(uid, page, limit, search, type, status, buildingId)));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/properties/public', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || undefined;
    const limit = parseInt(req.query.limit as string) || undefined;
    res.json(transformKeys(await listPropertiesByVisibility('rede', page, limit)));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/properties', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try { res.json(transformKeys(await createProperty({ ...transformKeysIn(req.body), userId: uid }))); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/properties/:id', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try { res.json(transformKeys(await updateProperty(req.params.id as string, transformKeysIn(req.body)))); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/properties/:id', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try { res.json(await deleteProperty(req.params.id as string)); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/properties/batch-import', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const { properties, owners } = req.body;
    if (!properties || !Array.isArray(properties)) {
      res.status(400).json({ error: 'Array de imóveis obrigatório' }); return;
    }
    const result = await batchImportProperties({ properties, owners: owners || [], userId: uid });
    res.json(result);
  } catch (err: any) { console.error('batch-import error:', err); res.status(500).json({ error: err.message || 'Erro desconhecido' }); }
});

// ===================== BUILDINGS =====================
router.get('/buildings', async (_req: Request, res: Response) => {
  try { res.json(transformKeys(await listBuildings())); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/buildings/search', async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '');
    if (!q.trim()) { res.json([]); return; }
    res.json(transformKeys(await searchBuildings(q.trim())));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/buildings', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try { res.json(await createBuilding({ ...req.body, userId: uid })); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ===================== EXCHANGES (PERMUTAS) =====================
router.get('/exchanges', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try { res.json(transformKeys(await listExchanges(uid))); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/exchanges/public', async (_req: Request, res: Response) => {
  try { res.json(transformKeys(await listPublicExchanges())); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/exchanges', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try { res.json(await createExchange({ ...req.body, userId: uid })); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/exchanges/:id', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try { res.json(await updateExchange(req.params.id as string, req.body)); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/exchanges/:id', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try { res.json(await deleteExchange(req.params.id as string)); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ===================== EXCHANGE MATCHES =====================
router.get('/exchanges/:id/matches', async (req: Request, res: Response) => {
  try {
    const matches = await findMatches(req.params.id as string);
    // Save matches to DB
    for (const m of matches) {
      await saveMatch(req.params.id as string, m.exchangeId, m.score);
    }
    res.json(matches);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/matches', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try { res.json(transformKeys(await listMatches(uid))); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ===================== FEED =====================
router.get('/feed', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    res.json(transformKeys(await listFeedPosts(page, limit)));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/feed', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try { res.json(await createFeedPost({ ...req.body, userId: uid })); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ===================== CHAT =====================
router.get('/conversations', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try { res.json(transformKeys(await listConversations(uid))); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/conversations', async (req: Request, res: Response) => {
  try {
    const { participants } = req.body;
    if (!participants || !Array.isArray(participants) || participants.length < 2) {
      res.status(400).json({ error: 'Mínimo de 2 participantes' }); return;
    }
    res.json(await createConversation(participants));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/conversations/:id/messages', async (req: Request, res: Response) => {
  try { res.json(transformKeys(await getMessages(req.params.id as string))); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/conversations/:id/messages', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const { content } = req.body;
    if (!content) { res.status(400).json({ error: 'Conteúdo obrigatório' }); return; }
    res.json(await sendChatMessage(req.params.id as string, uid, content));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ===================== AI =====================
router.get('/ai/training', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try { res.json(transformKeys(await getAiTraining(uid))); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/ai/training', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try { res.json(await upsertAiTraining(uid, req.body)); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// AI command: process natural language input
router.post('/ai/command', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const { command } = req.body;
    if (!command) { res.status(400).json({ error: 'Comando obrigatório' }); return; }

    const user = await getProfile(uid);
    const training = await getAiTraining(uid);

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Você é um assistente de CRM imobiliário. Analise o comando do usuário e retorne JSON.

Contexto do usuário:
- Nome: ${user?.name || 'desconhecido'}
- Região: ${user?.region || 'não definida'}
- Nicho: ${training?.niche || 'não definido'}
- Estilo: ${training?.style || 'não definido'}

EXTRAIA TODOS OS DADOS do comando. Regras:
- teleone: extraia números (5199372617 → "5199372617")
- funil: "quente", "morno" ou "frio". Se disser "bote como quente" → funil: "quente"
- bairro desejado → desiredNeighborhood
- cidade desejada → desiredCity
- dormitórios → bedrooms (número)
- valor/orçamento → budgetMax (número, sem pontuação)
- Se cliente vier com preferências de imóvel, inclua TUDO no create_client

REGRAS PARA paymentConditions (CAMPO OBRIGATÓRIO se houver menção a pagamento):
- "entrada de 80 mil" → "Entrada de R$ 80.000"
- "financiado em 60 meses" → "Saldo financiado em 60 meses"
- "pagamento a vista" → "Pagamento à vista"
- "80 mil de entrada + financiamento" → "Entrada de R$ 80.000, saldo financiado"
- Combine todas as condições de pagamento em uma única frase

Comandos possíveis:
1. Adicionar cliente (com preferências) → { "action": "create_client", "data": { "name": "...", "phone": "...", "email": "...", "city": "...", "neighborhood": "...", "desiredCity": "...", "desiredNeighborhood": "...", "desiredPropertyType": "...", "bedrooms": 0, "suites": 0, "garage": true/false, "budgetMax": 0, "funil": "quente|morno|frio", "description": "descrição natural COMPLETA de TODAS as preferências do cliente em uma frase", "paymentConditions": "condições de pagamento (entrada, financiamento, parcelas, à vista)" } }
2. Adicionar imóvel → { "action": "create_property", "data": { "propertyType": "casa|apartamento|terreno|comercial", "city": "...", "neighborhood": "...", "street": "...", "salePrice": 0, "bedrooms": 0, "garages": 0, "suites": 0, "description": "..." } }
3. Adicionar proprietário → { "action": "create_owner", "data": { "name": "...", "phone": "...", "email": "...", "city": "..." } }
4. Adicionar permuta → { "action": "create_exchange", "data": { "assetType": "...", "assetName": "...", "estimatedValue": 0, "seeking": "...", "description": "..." } }
5. Pergunta geral → { "action": "query", "data": { "question": "...", "answer": "..." } }
6. Match de permutas → { "action": "find_exchange_matches", "data": {} }
7. Gerar anúncio → { "action": "generate_ad", "data": { "propertyInfo": "...", "adText": "..." } }

EXEMPLO: "cadastre um cliente para mim, nome joao, numero 5199372617, quer um 2 dormitórios no bairro navegantes em capao da canoa, bote ele como quente"
→ {"action":"create_client","data":{"name":"Joao","phone":"5199372617","desiredNeighborhood":"Navegantes","desiredCity":"Capao da Canoa","bedrooms":2,"funil":"quente","description":"Cliente procura imóvel com 2 dormitórios no bairro Navegantes em Capao da Canoa."}}

EXEMPLO 2: "cadastre maria 51999887766 quer 3 dormitórios com garagem e vista mar na praia do cassino em rio grande, bote quente"
→ {"action":"create_client","data":{"name":"Maria","phone":"51999887766","desiredNeighborhood":"Praia do Cassino","desiredCity":"Rio Grande","bedrooms":3,"garage":true,"funil":"quente","description":"Cliente procura imóvel com 3 dormitórios, garagem e vista para o mar na Praia do Cassino em Rio Grande."}}

EXEMPLO 3: "cliente joão 5199372617 quer apto 2 quartos em capao até 500 mil, pagamento a vista, bote quente"
→ {"action":"create_client","data":{"name":"João","phone":"5199372617","desiredCity":"Capao da Canoa","desiredPropertyType":"apartamento","bedrooms":2,"budgetMax":500000,"funil":"quente","description":"Cliente procura apartamento com 2 dormitórios em Capao da Canoa com orçamento até R$ 500.000.","paymentConditions":"Pagamento à vista."}}

EXEMPLO 4 (CRÍTICO - pagamento complexo): "cadastro ana nome ela quer 12 quartos no bairro navegantes em capao da canoa ela tem 80 mil para dar de entrada e o saldo financiado em 60 meses"
→ {"action":"create_client","data":{"name":"Ana","desiredNeighborhood":"Navegantes","desiredCity":"Capao da Canoa","bedrooms":12,"funil":"frio","description":"Cliente procura imóvel com 12 dormitórios no bairro Navegantes em Capão da Canoa.","paymentConditions":"Entrada de R$ 80.000, saldo financiado em 60 meses."}}

IMPORTANTE: paymentConditions é UM CAMPO OBRIGATÓRIO sempre que o usuário mencionar: entrada, financiamento, parcelas, à vista, sinal, pagamento, parcela, meses. Combine TUDO em uma frase.

Retorne APENAS JSON válido. Se não entender, retorne {"action":"unknown","data":{"message":"Não entendi o comando. Tente algo como: cadastre um cliente para mim..."}}`
        },
        { role: 'user', content: command },
      ],
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { action: 'error', data: { message: 'Erro ao processar resposta da IA' } };
    }

    // Manual payment conditions fallback: scan command for payment keywords
    if (parsed?.action === 'create_client' && parsed?.data && !parsed.data.paymentConditions) {
      const cmd = command.toLowerCase();
      const parts: string[] = [];
      // entrada de X mil
      const ent = cmd.match(/(\d+)\s*(mil|k)\s*(de\s*)?(entrada|sinal)/i);
      if (ent) parts.push(`Entrada de R$ ${ent[1]}.000`);
      // X mil de entrada
      const ent2 = cmd.match(/(entrada|sinal)\s*(de\s*)?(\d+)\s*(mil|k)/i);
      if (ent2) parts.push(`Entrada de R$ ${ent2[3]}.000`);
      // financiado / financiamento
      if (/financ/i.test(cmd)) {
        const m = cmd.match(/(\d+)\s*(meses|mes)/i);
        parts.push(m ? `saldo financiado em ${m[1]} meses` : 'saldo financiado');
      }
      // à vista / a vista / avista
      if (/a\s*vista|avista/i.test(cmd)) parts.push('Pagamento à vista');
      // parcelas
      if (/parcelas?|prestac/i.test(cmd)) {
        const m = cmd.match(/(\d+)\s*(vezes|x|parcelas?)/i);
        if (m) parts.push(`${m[1]} parcelas`);
      }
      if (parts.length > 0) {
        const s = parts.join(', ');
        parsed.data.paymentConditions = s.charAt(0).toUpperCase() + s.slice(1);
      }
    }

    await logAiAction(uid, parsed.action || 'unknown', command, JSON.stringify(parsed));

    // Frontend will use parsed data to create via DataContext (keeps state in sync)
    res.json({ parsed });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// AI generate ad from photos and property info
router.post('/ai/generate-ad', upload.array('photos', 10), async (req: Request, res: Response) => {
  try {
    const { propertyInfo } = req.body;
    if (!propertyInfo) { res.status(400).json({ error: 'Informações do imóvel obrigatórias' }); return; }

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `Você é um redator de anúncios imobiliários. Crie um anúncio atraente em português brasileiro com:
- Título chamativo
- Descrição detalhada destacando pontos fortes
- Tags relevantes
Retorne APENAS JSON: {"title":"...","description":"...","tags":["..."]}`
        },
        { role: 'user', content: propertyInfo },
      ],
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content || '{}';
    let ad: any;
    try { ad = JSON.parse(content); } catch { ad = { title: 'Imóvel', description: content.slice(0, 500), tags: [] }; }

    res.json(ad);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ===================== PHOTO UPLOAD =====================
router.post('/upload-photos', upload.array('photos', 50), async (req: Request, res: Response) => {
  try {
    const code = req.body.code as string;
    if (!code) { res.status(400).json({ error: 'Código do imóvel é obrigatório' }); return; }
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400).json({ error: 'Nenhuma foto enviada' }); return;
    }

    const fotosDir = path.resolve(__dirname, '../../../fotos', code);
    if (!fs.existsSync(fotosDir)) fs.mkdirSync(fotosDir, { recursive: true });

    const urls: string[] = [];
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i] as Express.Multer.File;
      const ext = path.extname(file.originalname) || '.jpg';
      const filename = `foto_${String(i + 1).padStart(2, '0')}${ext}`;
      const destPath = path.join(fotosDir, filename);
      fs.copyFileSync(file.path, destPath);
      try { fs.unlinkSync(file.path); } catch {}
      urls.push(`/fotos/${code}/${filename}`);
    }

    res.json({ urls, total: urls.length, code });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ===================== PDF UPLOAD (keep existing) =====================
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'Nenhum arquivo' }); return; }
    const buffer = fs.readFileSync(req.file.path);
    let text = buffer.toString('utf-8');

    if (!text.includes('Apartamento') && !text.includes('Dormitório')) {
      try {
        const pdfParse = (await import('pdf-parse')).default;
        const data = await pdfParse(buffer);
        text = data.text;
      } catch {}
    }

    // Try regex parser
    const { parseBrokerPDF } = await import('./parser.js');
    const dados = parseBrokerPDF(text);

    if (dados.length === 0) {
      res.status(422).json({ error: 'Parser padrão falhou', needsAI: true, rawText: text.slice(0, 50000) });
      return;
    }

    res.json({ total: dados.length, preview: dados.slice(0, 10) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
  finally { if (req.file) try { fs.unlinkSync(req.file.path); } catch {} }
});

router.post('/upload/classified', async (req: Request, res: Response) => {
  try {
    const { dados, tipo } = req.body;
    if (!dados || !Array.isArray(dados)) { res.status(400).json({ error: 'Dados inválidos' }); return; }
    res.json({ total: dados.length, preview: dados.slice(0, 10) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export { router, upload, groq };

// ===================== WHATSAPP AUTOMATION =====================

// Track the auto-trigger functions to avoid duplicate listeners
let triggersInitialized = false;

function initTriggers() {
  if (triggersInitialized) return;
  triggersInitialized = true;
  // Triggers will be checked on-demand via API
}

router.get('/whatsapp/status', async (_req: Request, res: Response) => {
  res.json(waStatus());
});

router.post('/whatsapp/connect', async (_req: Request, res: Response) => {
  try {
    const currentStatus = waStatus();
    if (currentStatus.status === 'connected') {
      res.json({ status: 'connected', qr: null });
      return;
    }

    // Force fresh = always get new QR
    await waConnect(true);

    // Wait up to 30s for QR
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const qrText = getCurrentQr();
      if (qrText) {
        try {
          const qrImage = await QRCode.toDataURL(qrText, { errorCorrectionLevel: 'L', version: 40 });
          res.json({ status: 'connecting', qr: qrImage.replace('data:image/png;base64,', '') });
        } catch {
          res.json({ status: 'connecting', qr: qrText });
        }
        return;
      }
      const s = waStatus();
      if (s.status === 'connected') {
        res.json({ status: 'connected', qr: null });
        return;
      }
    }
    res.json({ status: waStatus().status, qr: null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/whatsapp/qr', async (_req: Request, res: Response) => {
  try {
    const qrText = getCurrentQr();
    if (!qrText) {
      res.json({ qr: null });
      return;
    }
    const qrImage = await QRCode.toDataURL(qrText, { errorCorrectionLevel: 'L', version: 40 });
    res.json({ qr: qrImage.replace('data:image/png;base64,', '') });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/whatsapp/test-send', async (req: Request, res: Response) => {
  try {
    const { to } = req.body;
    if (!to) { res.status(400).json({ error: 'Número obrigatório' }); return; }
    const result = await waSendMessage(to, '🔧 Teste do sistema NEXIV - mensagem enviada com sucesso!');
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/whatsapp/disconnect', async (_req: Request, res: Response) => {
  try {
    await waDisconnect();
    res.json({ success: true, status: 'disconnected' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/whatsapp/send', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const { to, text } = req.body;
    if (!to || !text) { res.status(400).json({ error: 'Destinatário e texto obrigatórios' }); return; }
    const result = await waSendMessage(to, text);
    await prisma.whatsAppMessage.create({
      data: { userId: uid, to, content: text, status: 'sent' },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ===== AUTOMATION RULES =====
router.get('/automation/rules', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const rules = await prisma.automationRule.findMany({ where: { userId: uid }, orderBy: { createdAt: 'desc' } });
    res.json(rules);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/automation/rules', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const { trigger, action, target, template } = req.body;
    if (!trigger || !action || !target || !template) {
      res.status(400).json({ error: 'trigger, action, target e template obrigatórios' }); return;
    }
    const rule = await prisma.automationRule.create({
      data: { userId: uid, trigger, action, target, template },
    });
    res.json(rule);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/automation/rules/:id', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const id = req.params.id as string;
    const rule = await prisma.automationRule.findFirst({ where: { id, userId: uid } });
    if (!rule) { res.status(404).json({ error: 'Regra não encontrada' }); return; }
    const updated = await prisma.automationRule.update({
      where: { id },
      data: {
        trigger: req.body.trigger ?? rule.trigger,
        action: req.body.action ?? rule.action,
        target: req.body.target ?? rule.target,
        template: req.body.template ?? rule.template,
        active: req.body.active ?? rule.active,
      },
    });
    res.json(updated);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/automation/rules/:id', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const id = req.params.id as string;
    await prisma.automationRule.deleteMany({ where: { id, userId: uid } });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ===== MESSAGE LOG =====
router.get('/whatsapp/messages', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const messages = await prisma.whatsAppMessage.findMany({
      where: { userId: uid },
      orderBy: { sentAt: 'desc' },
      take: 100,
    });
    res.json(messages);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/whatsapp/replies', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const replies = await prisma.whatsAppMessage.findMany({
      where: { userId: uid, trigger: { in: ['owner_reply', 'client_reply'] } },
      orderBy: { sentAt: 'desc' },
      take: 50,
    });
    res.json(replies);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ===== CAMPAIGN =====
router.get('/campaign/status', async (_req: Request, res: Response) => {
  res.json(getCampaignStatus());
});

router.post('/campaign/start', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  const ws = waStatus();
  if (ws.status !== 'connected') {
    res.status(400).json({ error: 'WhatsApp não está conectado. Escaneie o QR code primeiro.' }); return;
  }
  try {
    const { dailyLimit, template, target = 'properties', propertyIds } = req.body;
    if (!template || !dailyLimit) {
      res.status(400).json({ error: 'template e dailyLimit obrigatórios' }); return;
    }
    if (!dailyLimit || dailyLimit < 1 || dailyLimit > 50) {
      res.status(400).json({ error: 'dailyLimit deve ser entre 1 e 50' }); return;
    }

    if (target === 'clients') {
      const hour = new Date().getHours();
      const greet = hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite';
      const clients = await prisma.client.findMany({
        where: { userId: uid, OR: [{ phone: { not: null } }, { whatsapp: { not: null } }] },
      });
      const contacts = clients
        .map(c => ({
          phone: c.whatsapp || c.phone || '',
          name: c.name,
          propertyId: c.id,
          vars: {
            greeting: `${greet}, ${c.name.split(' ')[0] || c.name}`,
            client_name: c.name,
            client_phone: c.phone || c.whatsapp || '',
            client_city: c.city || '',
            client_desired_city: c.desiredCity || '',
            client_budget: c.budgetMax ? `R$ ${c.budgetMax.toLocaleString('pt-BR')}` : '',
            client_funil: c.funil,
          },
        }))
        .filter(c => c.phone);

      if (contacts.length === 0) {
        res.status(400).json({ error: 'Nenhum cliente com telefone encontrado' }); return;
      }

      await startCampaign(uid, contacts, template, dailyLimit);
      res.json({ contacts: contacts.length, dailyLimit, target });
      return;
    }

    // Properties campaign (default)
    const where: any = { userId: uid, OR: [{ phone: { not: null } }, { whatsapp: { not: null } }] };
    const owners = await prisma.owner.findMany({
      where,
      include: {
        properties: propertyIds?.length
          ? { where: { id: { in: propertyIds } }, include: { building: true } }
          : { take: 1, include: { building: true } },
      },
    });

    const hour = new Date().getHours();
    const greeting = hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite';

    const contacts = owners
      .filter(o => o.properties.length > 0)
      .map(o => {
        const p = o.properties[0];
        const firstName = o.name.split(' ')[0] || o.name;
        return {
          phone: o.whatsapp || o.phone || '',
          name: o.name,
          propertyId: p.id,
          vars: {
            greeting: `${greeting}, ${firstName}`,
            owner_name: o.name,
            property_code: p.code,
            property_type: p.propertyType,
            property_street: p.street || '',
            property_city: p.city || '',
            property_neighborhood: p.neighborhood || '',
            property_building: p.building?.name || '',
            property_unit: p.complement || p.unit || '',
            property_status: p.status,
            property_price: p.salePrice
              ? `R$ ${p.salePrice.toLocaleString('pt-BR')}`
              : '',
          },
        };
      })
      .filter(c => c.phone);

    if (contacts.length === 0) {
      res.status(400).json({ error: 'Nenhum proprietário com imóvel e telefone encontrado' }); return;
    }

    await startCampaign(uid, contacts, template, dailyLimit);
    res.json({ contacts: contacts.length, dailyLimit, target });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/campaign/stop', async (_req: Request, res: Response) => {
  stopCampaignManually();
  res.json({ success: true });
});

router.get('/campaign/last-send/:propertyId', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const last = await prisma.whatsAppMessage.findFirst({
      where: { userId: uid, referenceId: req.params.propertyId as string, trigger: 'campaign' },
      orderBy: { sentAt: 'desc' },
    });
    res.json({ lastSend: last ? last.sentAt : null });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/properties/by-ids', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) { res.json([]); return; }
    const props = await prisma.property.findMany({
      where: { id: { in: ids }, userId: uid },
      include: { building: true, owner: true },
    });
    res.json(transformKeys(props));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/campaign/history', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const messages = await prisma.whatsAppMessage.findMany({
      where: { userId: uid, trigger: 'campaign' },
      orderBy: { sentAt: 'desc' },
      take: 50,
    });
    const propIds = messages.map(m => m.referenceId).filter(Boolean) as string[];
    const [props, clients] = await Promise.all([
      prisma.property.findMany({ where: { id: { in: propIds } }, select: { id: true, code: true } }),
      prisma.client.findMany({ where: { id: { in: propIds } }, select: { id: true, name: true } }),
    ]);
    const propMap = Object.fromEntries(props.map(p => [p.id, p.code]));
    const clientMap = Object.fromEntries(clients.map(c => [c.id, c.name]));
    const enriched = messages.map(m => ({
      ...m,
      propertyCode: m.referenceId ? propMap[m.referenceId] || clientMap[m.referenceId] || null : null,
    }));
    res.json(enriched);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ===== AI CAMPAIGN: generate message and start =====
router.post('/campaign/ai-start', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const { dailyLimit = 20, target = 'properties', propertyIds } = req.body;

    // Fetch corretor profile for identity
    const corretorProfile = await getProfile(uid);
    const corretorName = corretorProfile?.name || 'Corretor';
    const corretorAgency = corretorProfile?.agency || '';

    // Fetch first property to generate contextual message
    let contextInfo = '';
    if (target === 'properties') {
      const where: any = { userId: uid };
      if (propertyIds?.length) where.id = { in: propertyIds };
      const props = await prisma.property.findMany({
        where,
        include: { owner: true, building: true },
        take: 1,
      });
      if (props[0]) {
        const p = props[0];
        contextInfo = [
          `Proprietário: ${p.owner?.name || 'Cliente'}`,
          `Tipo: ${p.propertyType}`,
          `Edifício: ${p.building?.name || 'sem edifício'}`,
          `Unidade/Apto: ${p.complement || p.unit || 'sem unidade'}`,
          `Cidade: ${p.city || ''}`,
        ].filter(Boolean).join('\n');
      }
    }

    const today = new Date().toLocaleDateString('pt-BR');
    const prompt = `Você é um corretor de imóveis brasileiro. Gere uma mensagem CURTA (máximo 120 caracteres) para enviar via WhatsApp a um proprietário.

A mensagem deve perguntar APENAS se o imóvel no edifício mencionado e unidade indicada ainda está disponível para venda.

Você deve se identificar como ${corretorName}${corretorAgency ? ` da ${corretorAgency}` : ''} no final da mensagem, de forma natural. Exemplo: "aqui é ${corretorName}, da ${corretorAgency || 'imobiliária'}".

Use UM dos formatos abaixo (escolha o mais natural):
- "{{property_building}}, apto {{property_unit}} ainda segue a venda? Aqui é ${corretorName}${corretorAgency ? `, da ${corretorAgency}` : ''}."
- "O {{property_building}} apto {{property_unit}} ainda está disponível? ${corretorName}${corretorAgency ? ` da ${corretorAgency}` : ''} aqui."
- "O imóvel no {{property_building}} apto {{property_unit}} continua a venda? Sou ${corretorName}${corretorAgency ? `, da ${corretorAgency}` : ''}."

IMPORTANTE: Use as variáveis {{property_building}} e {{property_unit}} exatamente como mostrado acima, sem substituir pelos valores reais.

Não use saudações, não use o nome do proprietário, não use emojis, não use markdown, não use aspas. Vá direto ao ponto.

Contexto de exemplo:
${contextInfo}

Data: ${today}

Retorne APENAS o texto da mensagem, sem formatação adicional.`;

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: `Você é ${corretorName}, corretor de imóveis${corretorAgency ? ` da ${corretorAgency}` : ''}. Gere mensagens curtas e diretas para WhatsApp imobiliário. Use variáveis {{property_building}} e {{property_unit}} no texto. Retorne apenas o texto da mensagem, sem markdown.` },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    });

    let template = response.choices[0]?.message?.content?.trim() || '';
    // Fallback: ensure template contains the variables
    if (!template.includes('{{property_building}}') || !template.includes('{{property_unit}}')) {
      template = '{{property_building}}, apto {{property_unit}} ainda segue a venda?';
    }

    // Build contacts
    const hour = new Date().getHours();
    const aiGreeting = hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite';
    let contactWhere: any = { userId: uid };
    if (target === 'properties') {
      contactWhere.OR = [{ phone: { not: null } }, { whatsapp: { not: null } }];
      const owners = await prisma.owner.findMany({
        where: contactWhere,
        include: {
          properties: propertyIds?.length
            ? { where: { id: { in: propertyIds } }, include: { building: true } }
            : { take: 1, include: { building: true } },
        },
      });

      const contacts = owners
        .filter(o => o.properties.length > 0)
        .map(o => {
          const p = o.properties[0];
          const firstName = o.name.split(' ')[0] || o.name;
          return {
            phone: o.whatsapp || o.phone || '',
            name: o.name,
            propertyId: p.id,
            vars: {
              greeting: `${aiGreeting}, ${firstName}`,
              owner_name: o.name,
              property_code: p.code,
              property_type: p.propertyType,
              property_street: p.street || '',
              property_city: p.city || '',
              property_neighborhood: p.neighborhood || '',
              property_building: p.building?.name || '',
              property_unit: p.complement || p.unit || '',
              property_status: p.status,
              property_price: p.salePrice ? `R$ ${p.salePrice.toLocaleString('pt-BR')}` : '',
            },
          };
        })
        .filter(c => c.phone);

      if (contacts.length === 0) {
        res.status(400).json({ error: 'Nenhum proprietário com imóvel e telefone encontrado' }); return;
      }

      await startCampaign(uid, contacts, template, dailyLimit);
      res.json({ template, contacts: contacts.length, dailyLimit, target });
    } else {
      // Clients campaign
      const clients = await prisma.client.findMany({
        where: { userId: uid, OR: [{ phone: { not: null } }, { whatsapp: { not: null } }] },
      });
      const contacts = clients
        .map(c => ({
          phone: c.whatsapp || c.phone || '',
          name: c.name,
          propertyId: c.id,
          vars: {
            greeting: `${aiGreeting}, ${c.name.split(' ')[0] || c.name}`,
            client_name: c.name,
            client_phone: c.phone || c.whatsapp || '',
            client_city: c.city || '',
            client_desired_city: c.desiredCity || '',
            client_budget: c.budgetMax ? `R$ ${c.budgetMax.toLocaleString('pt-BR')}` : '',
            client_funil: c.funil,
          },
        }))
        .filter(c => c.phone);

      if (contacts.length === 0) {
        res.status(400).json({ error: 'Nenhum cliente com telefone encontrado' }); return;
      }

      await startCampaign(uid, contacts, template, dailyLimit);
      res.json({ template, contacts: contacts.length, dailyLimit, target });
    }
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/campaign/varied-start', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  const ws = waStatus();
  if (ws.status !== 'connected') {
    res.status(400).json({ error: 'WhatsApp não está conectado. Escaneie o QR code primeiro.' }); return;
  }
  try {
    const { dailyLimit = 20, target = 'properties', propertyIds } = req.body;
    if (!dailyLimit || dailyLimit < 1 || dailyLimit > 50) {
      res.status(400).json({ error: 'dailyLimit deve ser entre 1 e 50' }); return;
    }

    if (target === 'properties') {
      const where: any = { userId: uid, OR: [{ phone: { not: null } }, { whatsapp: { not: null } }] };
      const owners = await prisma.owner.findMany({
        where,
        include: {
          properties: propertyIds?.length
            ? { where: { id: { in: propertyIds } }, include: { building: true } }
            : { take: 1, include: { building: true } },
        },
      });

      const contacts = owners
        .filter(o => o.properties.length > 0)
        .map(o => {
          const p = o.properties[0];
          return {
            phone: o.whatsapp || o.phone || '',
            name: o.name,
            propertyId: p.id,
            vars: {
              owner_name: o.name,
              property_code: p.code,
              property_type: p.propertyType,
              property_street: p.street || '',
              property_city: p.city || '',
              property_neighborhood: p.neighborhood || '',
              property_building: p.building?.name || '',
              property_unit: p.complement || p.unit || '',
              property_status: p.status,
              property_price: p.salePrice ? `R$ ${p.salePrice.toLocaleString('pt-BR')}` : '',
            },
          };
        })
        .filter(c => c.phone);

      if (contacts.length === 0) {
        res.status(400).json({ error: 'Nenhum proprietário com imóvel e telefone encontrado' }); return;
      }

      await startVariedCampaign(uid, contacts, dailyLimit);
      res.json({ contacts: contacts.length, dailyLimit, target, varied: true });
    } else {
      const clients = await prisma.client.findMany({
        where: { userId: uid, OR: [{ phone: { not: null } }, { whatsapp: { not: null } }] },
      });
      const contacts = clients
        .map(c => ({
          phone: c.whatsapp || c.phone || '',
          name: c.name,
          propertyId: c.id,
          vars: {
            client_name: c.name,
            client_phone: c.phone || c.whatsapp || '',
            client_city: c.city || '',
            client_desired_city: c.desiredCity || '',
            client_budget: c.budgetMax ? `R$ ${c.budgetMax.toLocaleString('pt-BR')}` : '',
            client_funil: c.funil,
          },
        }))
        .filter(c => c.phone);

      if (contacts.length === 0) {
        res.status(400).json({ error: 'Nenhum cliente com telefone encontrado' }); return;
      }

      await startVariedCampaign(uid, contacts, dailyLimit);
      res.json({ contacts: contacts.length, dailyLimit, target, varied: true });
    }
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ===== AUTO-TRIGGER: Property status change =====
router.post('/automation/trigger/property', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const { property_id, event } = req.body;
    if (!property_id || !event) { res.status(400).json({ error: 'property_id e event obrigatórios' }); return; }

    const property = await prisma.property.findUnique({
      where: { id: property_id },
      include: { owner: true },
    });
    if (!property) { res.status(404).json({ error: 'Imóvel não encontrado' }); return; }

    const rules = await prisma.automationRule.findMany({
      where: { userId: uid, active: true, trigger: event },
    });

    for (const rule of rules) {
      await executeRule(rule.id, {
        property_code: property.code,
        property_type: property.propertyType,
        property_city: property.city || '',
        property_neighborhood: property.neighborhood || '',
        property_status: property.status,
        property_price: property.salePrice ? `R$ ${property.salePrice.toLocaleString('pt-BR')}` : '',
        owner_name: property.owner?.name || '',
        owner_phone: property.owner?.whatsapp || property.owner?.phone || '',
      });
    }

    res.json({ triggered: rules.length });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ===== AUTO-TRIGGER: Client created/updated =====
router.post('/automation/trigger/client', async (req: Request, res: Response) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const { client_id, event } = req.body;
    if (!client_id || !event) { res.status(400).json({ error: 'client_id e event obrigatórios' }); return; }

    const client = await prisma.client.findUnique({ where: { id: client_id } });
    if (!client) { res.status(404).json({ error: 'Cliente não encontrado' }); return; }

    const rules = await prisma.automationRule.findMany({
      where: { userId: uid, active: true, trigger: event },
    });

    for (const rule of rules) {
      await executeRule(rule.id, {
        client_name: client.name,
        client_phone: client.whatsapp || client.phone || '',
        client_city: client.city || '',
        client_desired_city: client.desiredCity || '',
        client_budget: client.budgetMax ? `R$ ${client.budgetMax.toLocaleString('pt-BR')}` : '',
        client_funil: client.funil,
      });
    }

    res.json({ triggered: rules.length });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
