import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// ======= PROFILES =======
export async function getProfile(id: string) {
  return prisma.profile.findUnique({ where: { id } });
}

export async function upsertProfile(data: {
  id: string; email: string; name: string; phone?: string; region?: string; city?: string; state?: string; agency?: string; role?: string; avatar_url?: string;
}) {
  return prisma.profile.upsert({
    where: { id: data.id },
    update: data,
    create: data,
  });
}

// ======= OWNERS =======
export async function listOwners(userId: string) {
  return prisma.owner.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
}

export async function createOwner(data: {
  name: string; phone?: string; whatsapp?: string; email?: string; city?: string;
  state?: string; cpf_cnpj?: string; notes?: string; userId: string;
}) {
  return prisma.owner.create({ data });
}

export async function updateOwner(id: string, data: any) {
  return prisma.owner.update({ where: { id }, data });
}

export async function deleteOwner(id: string) {
  return prisma.owner.delete({ where: { id } });
}

// ======= CLIENTS =======
export async function listClients(userId: string) {
  return prisma.client.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
}

export async function createClient(data: {
  name: string; phone?: string; whatsapp?: string; email?: string; city?: string; neighborhood?: string;
  description?: string; paymentConditions?: string; budgetMin?: number; budgetMax?: number; desiredPropertyType?: string;
  desiredCity?: string; desiredNeighborhood?: string; bedrooms?: number; suites?: number; garage?: boolean;
  funil?: string; acceptsFinancing?: boolean; installments?: string; notes?: string; userId: string;
}) {
  return prisma.client.create({ data });
}

export async function updateClient(id: string, data: any) {
  return prisma.client.update({ where: { id }, data });
}

export async function deleteClient(id: string) {
  return prisma.client.delete({ where: { id } });
}

// ======= PROPERTIES =======
export async function listProperties(userId: string, page?: number, pageSize?: number, search?: string, type?: string, status?: string, buildingId?: string) {
  const where: any = { userId };
  if (search) {
    where.OR = [
      { code: { contains: search } },
      { neighborhood: { contains: search } },
      { city: { contains: search } },
      { street: { contains: search } },
      { complement: { contains: search } },
      { building: { name: { contains: search } } },
    ];
  }
  if (type) where.propertyType = type;
  if (status) where.status = status;
  if (buildingId) where.buildingId = buildingId;
  const [data, total] = await Promise.all([
    prisma.property.findMany({
      where,
      include: { owner: true, building: true },
      orderBy: { updatedAt: 'desc' },
      ...(page && pageSize ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
    }),
    prisma.property.count({ where }),
  ]);
  return page && pageSize ? { data, total, page, pageSize } : data;
}

export async function listPropertiesByVisibility(visibility: string, page?: number, pageSize?: number) {
  const where = { visibility };
  const [data, total] = await Promise.all([
    prisma.property.findMany({
      where,
      include: { owner: true, building: true, user: { select: { id: true, name: true, phone: true, city: true, rating: true } } },
      orderBy: { updatedAt: 'desc' },
      ...(page && pageSize ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
    }),
    prisma.property.count({ where }),
  ]);
  return page && pageSize ? { data, total, page, pageSize } : data;
}

function serializeArrayFields(data: any) {
  for (const field of ['photos', 'videos', 'amenities'] as const) {
    if (Array.isArray(data[field])) {
      data[field] = JSON.stringify(data[field]);
    }
  }
}

export async function createProperty(data: any) {
  const code = `IMV-${(Date.now()).toString(36).toUpperCase()}`;
  if (data.ownerId === '') { delete data.ownerId; }
  if (data.buildingId === '') { delete data.buildingId; }
  serializeArrayFields(data);
  return prisma.property.create({ data: { ...data, code } });
}

// Ruas de referência de Capão da Canoa para ajudar a separar edifício do logradouro
const STREETS_CC = [
  'PARAGUASSU','RUDA','ARARIGBOIA','ANDIRA','PINDORAMA','CECI','UBIRAJARA','SEPÉ','POTI',
  'GUARACI','MOACIR','MOEMA','TUPANCIRETÃ','MARABÁ','ARGENTINA','PERI','AMOR PERFEITO',
  'ROSAS','CENTRAL','FLÁVIO BOIANOVSKI','BEIRA MAR','ATLÂNTICA','NEUZA GOULART BRIZOLA',
  'MAURÍCIO BOIANOWSKI','CEZAR DA SILVA BITENCOURT','ANDRÉ PUSTI','UBATUBA DE FARIAS',
  'VENÂNCIO AIRES','BRIGADA MILITAR','DIVISÓRIA','JOSÉ MILTON LOPES','THOMAZ JOVINO ESPÍNDOLA',
  'LEVY WENGROVER','GUILHERME GITMAN','EDUARDO DE OLIVEIRA SCHEFFER','HONÓRIO FERREIRA DA SILVA',
  'IBES TEODORO DOS SANTOS','TIARAJU','UBATUBA','PAUL HARRIS',
];

// Tries to extract a known building name from the beginning of an address string
function findBuildingInAddress(address: string, buildings: { id: string; name: string }[]): { buildingId?: string; street: string } {
  const upper = address.toUpperCase().trim();
  // Remove common prefixes that might interfere
  const clean = upper.replace(/^(RUA|AV\.?|AVENIDA|TRAVESSA|ALAMEDA|ESTRADA|ROD\.?)\s+/i, '').trim();

  // 1. Try exact building name match at start (longest first)
  const sorted = [...buildings].sort((a, b) => b.name.length - a.name.length);
  for (const b of sorted) {
    const bn = b.name.toUpperCase();
    // Check if address starts with building name
    if (clean.startsWith(bn)) {
      const remainder = clean.slice(bn.length).trim();
      // Remove leading comma/space and return the street part
      const street = remainder.replace(/^[,.\s]+/, '');
      return { buildingId: b.id, street: capitalizeStreet(street) };
    }
    // Also try "BN, STREET" or "BN STREET" pattern
    const withComma = bn + ',';
    const withSpace = bn + ' ';
    if (clean.startsWith(withComma) || clean.startsWith(withSpace)) {
      const remainder = clean.slice(bn.length).trim().replace(/^[,.\s]+/, '');
      return { buildingId: b.id, street: capitalizeStreet(remainder) };
    }
  }

  // 2. Try to find a known street name in the address, split at that point
  for (const s of STREETS_CC) {
    const idx = clean.indexOf(s);
    if (idx > 0) {
      const possibleBuilding = clean.slice(0, idx).trim();
      // The part before the street might be a building name
      const building = buildings.find(b => b.name.toUpperCase() === possibleBuilding);
      if (building) {
        return { buildingId: building.id, street: capitalizeStreet(clean.slice(idx)) };
      }
      // Building name not found but we identified the street
      return { street: capitalizeStreet(clean) };
    }
  }

  return { street: address };
}

function capitalizeStreet(s: string): string {
  return s.replace(/^[,\s]+/, '').trim();
}

export async function batchImportProperties(data: {
  properties: any[];
  owners?: { name: string; phone?: string; email?: string; city?: string }[];
  userId: string;
}) {
  const result = { created: 0, duplicates: 0, errors: 0, errorsList: [] as any[] };
  const existing = await prisma.property.findMany({ where: { userId: data.userId } });

  // Pre-load all buildings for matching
  const allBuildings = await prisma.building.findMany({ orderBy: { name: 'desc' } });

  // Handle owners: create or find existing, build lookup by name+phone
  const ownerMap = new Map<string, string>();
  if (data.owners && data.owners.length > 0) {
    const existingOwners = await prisma.owner.findMany({ where: { userId: data.userId } });
    for (const oi of data.owners) {
      if (!oi.name?.trim()) continue;
      const key = (k: { name: string; phone?: string; email?: string }) => {
        const n = k.name.trim().toLowerCase();
        const p = (k.phone || '').replace(/\D/g, '');
        const e = (k.email || '').trim().toLowerCase();
        if (n && p) return `${n}:${p}`;
        if (n && e) return `${n}:email:${e}`;
        if (n) return `name-only:${n}`;
        return null;
      };
      const k = key(oi);
      if (!k || ownerMap.has(k)) continue;
      const match = existingOwners.find((o: any) => {
        if (k.startsWith('name-only:')) return o.name.trim().toLowerCase() === oi.name!.trim().toLowerCase();
        const nameMatch = o.name.trim().toLowerCase() === oi.name!.trim().toLowerCase();
        const phoneMatch = oi.phone && (o.phone || '').replace(/\D/g, '') === oi.phone.replace(/\D/g, '');
        const emailMatch = oi.email && (o.email || '').trim().toLowerCase() === oi.email.trim().toLowerCase();
        return nameMatch && (phoneMatch || emailMatch);
      });
      if (match) {
        ownerMap.set(k, match.id);
      } else {
        const created = await prisma.owner.create({
          data: { name: oi.name.trim(), phone: oi.phone || null, email: oi.email || null, city: oi.city || null, userId: data.userId },
        });
        ownerMap.set(k, created.id);
      }
    }
  }

  const findOwnerId = (item: any): string | null => {
    const n = (item.owner_name || '').trim().toLowerCase();
    const p = (item.owner_phone || '').replace(/\D/g, '');
    const e = (item.owner_email || '').trim().toLowerCase();
    for (const [key, id] of ownerMap) {
      if (key.startsWith(`${n}:`) && (key.includes(p) || (e && key.includes(e)))) return id;
      if (key === `${n}:${p}`) return id;
    }
    for (const [key, id] of ownerMap) {
      if (key === `name-only:${n}`) return id;
    }
    return null;
  };

  for (let i = 0; i < data.properties.length; i++) {
    const prop = data.properties[i];
    try {
      const isDuplicate = existing.some((x: any) =>
        String(x.street || '').toLowerCase() === String(prop.street || '').toLowerCase() &&
        Number(x.sale_price || 0) === Number(prop.sale_price || 0)
      );
      if (isDuplicate) {
        result.duplicates++;
        continue;
      }

      let buildingId = prop.building_id;
      let cleanedStreet = prop.street || '';

      if (prop.building_name) {
        const b = allBuildings.find(b => b.name.toLowerCase() === prop.building_name.trim().toLowerCase());
        if (b) buildingId = b.id;
      }

      if (!buildingId && cleanedStreet) {
        const lookup = findBuildingInAddress(cleanedStreet, allBuildings);
        buildingId = lookup.buildingId;
        if (lookup.street) cleanedStreet = lookup.street;
      }

      const code = `IMV-${(Date.now() + i).toString(36).toUpperCase()}`;
      await prisma.property.create({
        data: {
          code,
          propertyType: prop.propertyType || prop.property_type || 'outros',
          category: prop.category || 'venda',
          status: prop.status || 'disponivel',
          visibility: prop.visibility || 'privado',
          city: prop.city || '',
          neighborhood: prop.neighborhood || '',
          street: cleanedStreet || prop.street || '',
          number: prop.number || '',
          complement: prop.complement || '',
          unit: prop.unit || '',
          quadra: prop.quadra || '',
          lote: prop.lote || '',
          privateArea: prop.privateArea || prop.private_area || null,
          totalArea: prop.totalArea || prop.total_area || null,
          bedrooms: prop.bedrooms || null,
          suites: prop.suites || null,
          bathrooms: prop.bathrooms || null,
          garages: prop.garages || null,
          salePrice: prop.salePrice || prop.sale_price || null,

          condoFee: prop.condoFee || prop.condo_fee || null,
          iptu: prop.iptu || null,
          description: prop.description || '',
          amenities: prop.amenities || null,
          photos: prop.photos || null,
          acceptsExchange: prop.acceptsExchange || prop.accepts_exchange || false,
          exchangePercent: prop.exchangePercent || prop.exchange_percent || null,
          exchangeSeeking: prop.exchangeSeeking || prop.exchange_seeking || null,
          ownerId: findOwnerId(prop) || prop.ownerId || prop.owner_id || null,
          buildingId: buildingId || null,
          userId: data.userId,
        },
      });
      result.created++;
    } catch (err: any) {
      result.errors++;
      result.errorsList.push({ row: i + 1, message: err.message, data: prop });
    }
  }

  return result;
}

export async function updateProperty(id: string, data: any) {
  if (data.ownerId === '') { delete data.ownerId; }
  if (data.buildingId === '') { delete data.buildingId; }
  serializeArrayFields(data);
  return prisma.property.update({ where: { id }, data });
}

export async function deleteProperty(id: string) {
  return prisma.property.delete({ where: { id } });
}

// ======= BUILDINGS =======
export async function listBuildings() {
  return prisma.building.findMany({ orderBy: { name: 'asc' } });
}

export async function searchBuildings(query: string) {
  return prisma.building.findMany({
    where: { name: { contains: query } },
    orderBy: { name: 'asc' },
    take: 50,
  });
}

export async function createBuilding(data: {
  name: string; street?: string; number?: string; address?: string; neighborhood?: string; city?: string; state?: string; notes?: string; userId: string;
}) {
  return prisma.building.create({ data });
}

// ======= EXCHANGES =======
export async function listExchanges(userId: string) {
  return prisma.exchange.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listPublicExchanges() {
  return prisma.exchange.findMany({
    where: { visibility: { not: 'privado' }, status: 'active' },
    include: { user: { select: { id: true, name: true, phone: true, city: true, rating: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createExchange(data: {
  assetType: string; assetName: string; description?: string; estimatedValue?: number;
  visibility?: string; seeking?: string; percentAccepted?: number; userId: string;
}) {
  return prisma.exchange.create({ data });
}

export async function updateExchange(id: string, data: any) {
  return prisma.exchange.update({ where: { id }, data });
}

export async function deleteExchange(id: string) {
  return prisma.exchange.delete({ where: { id } });
}

// ======= EXCHANGE MATCHES =======
export async function findMatches(exchangeId: string) {
  const exchange = await prisma.exchange.findUnique({ where: { id: exchangeId } });
  if (!exchange) return [];

  const candidates = await prisma.exchange.findMany({
    where: {
      id: { not: exchangeId },
      status: 'active',
      visibility: { not: 'privado' },
    },
  });

  const matches: { exchangeId: string; score: number; reason: string }[] = [];

  for (const cand of candidates) {
    let score = 0;
    const reasons: string[] = [];

    // Check if seeking matches asset type
    if (exchange.seeking && cand.assetType) {
      if (exchange.seeking.toLowerCase().includes(cand.assetType.toLowerCase())) {
        score += 40;
        reasons.push(`${cand.assetName} corresponde ao que você busca`);
      }
    }
    if (cand.seeking && exchange.assetType) {
      if (cand.seeking.toLowerCase().includes(exchange.assetType.toLowerCase())) {
        score += 40;
        reasons.push(`Você tem o que ${cand.assetName} busca`);
      }
    }

    // Value proximity
    if (exchange.estimatedValue && cand.estimatedValue) {
      const ratio = Math.min(exchange.estimatedValue, cand.estimatedValue) /
                    Math.max(exchange.estimatedValue, cand.estimatedValue);
      if (ratio > 0.5) {
        score += Math.round(ratio * 20);
        reasons.push(`Valores compatíveis (${Math.round(ratio * 100)}%)`);
      }
    }

    if (score > 0) {
      matches.push({
        exchangeId: cand.id,
        score,
        reason: reasons.join('; '),
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

export async function saveMatch(exchangeIdA: string, exchangeIdB: string, score: number) {
  return prisma.exchangeMatch.upsert({
    where: { exchangeIdA_exchangeIdB: { exchangeIdA, exchangeIdB } },
    update: { matchScore: score },
    create: { exchangeIdA, exchangeIdB, matchScore: score },
  });
}

export async function listMatches(userId: string) {
  const userExchanges = await prisma.exchange.findMany({
    where: { userId },
    select: { id: true },
  });
  const ids = userExchanges.map(e => e.id);

  return prisma.exchangeMatch.findMany({
    where: {
      OR: [
        { exchangeIdA: { in: ids } },
        { exchangeIdB: { in: ids } },
      ],
    },
    include: {
      exchangeA: { include: { user: { select: { id: true, name: true, phone: true, city: true } } } },
      exchangeB: { include: { user: { select: { id: true, name: true, phone: true, city: true } } } },
    },
    orderBy: { matchScore: 'desc' },
  });
}

// ======= FEED =======
export async function listFeedPosts(page = 1, limit = 20) {
  return prisma.feedPost.findMany({
    include: {
      user: { select: { id: true, name: true, avatar_url: true, city: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });
}

export async function createFeedPost(data: {
  content?: string; propertyId?: string; exchangeId?: string;
  mediaUrls?: string; userId: string;
}) {
  return prisma.feedPost.create({ data });
}

// ======= CONVERSATIONS =======
export async function listConversations(userId: string) {
  return prisma.conversation.findMany({
    where: { participants: { contains: userId } },
    include: {
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { lastMessageAt: 'desc' },
  });
}

export async function createConversation(participants: string[]) {
  const participantStr = JSON.stringify([...new Set(participants)]);
  return prisma.conversation.create({
    data: { participants: participantStr },
  });
}

export async function getMessages(conversationId: string) {
  return prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function sendMessage(conversationId: string, senderId: string, content: string) {
  const msg = await prisma.chatMessage.create({
    data: { conversationId, senderId, content },
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessage: content, lastMessageAt: new Date() },
  });
  return msg;
}

// ======= AI =======
export async function getAiTraining(userId: string) {
  return prisma.aiTraining.findUnique({ where: { userId } });
}

export async function upsertAiTraining(userId: string, data: {
  style?: string; niche?: string; region?: string; preferences?: string; history?: string;
}) {
  return prisma.aiTraining.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}

export async function logAiAction(userId: string, actionType: string, input: string, result?: string) {
  return prisma.aiAction.create({ data: { userId, actionType, input, result } });
}

export async function listProfiles() {
  return prisma.profile.findMany({
    select: { id: true, name: true, phone: true, whatsapp: true, city: true, state: true, rating: true, salesCount: true, specialties: true, avatar_url: true },
    orderBy: { salesCount: 'desc' },
  });
}
