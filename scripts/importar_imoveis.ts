import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const FOTOS_DIR = path.join(ROOT, 'fotos');
const TARGET_FOTOS_DIR = path.join(ROOT, 'project', 'public', 'fotos');
const JSON_FILE = path.join(DATA_DIR, 'imoveis_exportados.json');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function generateId(): string {
  const chars = 'abcdef0123456789';
  let id = '';
  for (let i = 0; i < 32; i++) {
    id += chars[Math.floor(Math.random() * 16)];
    if (i === 7 || i === 11 || i === 15 || i === 19) id += '-';
  }
  return id;
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  IMPORTADOR V2 - JSON → Prisma/SQLite');
  console.log('═══════════════════════════════════════════\n');

  if (!fs.existsSync(JSON_FILE)) {
    console.error(`ERRO: ${JSON_FILE} não encontrado`);
    return;
  }

  const imoveis: any[] = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));
  console.log(`📄 ${imoveis.length} imóveis carregados\n`);

  // ── Ensure dirs ──
  ensureDir(TARGET_FOTOS_DIR);

  // ── Find or create default user ──
  let defaultUserId: string;
  const profile = await prisma.profile.findFirst();
  if (profile) {
    defaultUserId = profile.id;
    console.log(`👤 Usando perfil: ${profile.name} (${defaultUserId})`);
  } else {
    const newProfile = await prisma.profile.create({
      data: {
        id: 'user-centromar',
        email: 'admin@centromar.com.br',
        name: 'Admin Centromar',
        role: 'corretor',
      },
    });
    defaultUserId = newProfile.id;
    console.log(`👤 Perfil criado: ${defaultUserId}`);
  }

  // ── Pre-load existing data ──
  const existingProperties = await prisma.property.findMany();
  const existingOwners = await prisma.owner.findMany();
  const existingBuildings = await prisma.building.findMany();

  const ownerByName = new Map(existingOwners.map(o => [o.name.toLowerCase(), o.id]));
  const buildingByName = new Map(existingBuildings.map(b => [b.name.toLowerCase(), b.id]));
  const existingCodes = new Set(existingProperties.map(p => p.code));

  // ── Stats ──
  let imported = 0, updated = 0, errors = 0;
  const errorList: string[] = [];

  // ── Copy photos ──
  console.log('[FOTOS] Copiando...');
  let fotosCopiadas = 0;
  for (const imovel of imoveis) {
    if (!imovel.fotos || imovel.fotos.length === 0) continue;
    const srcDir = path.join(FOTOS_DIR, imovel.referencia);
    const dstDir = path.join(TARGET_FOTOS_DIR, imovel.referencia);
    if (fs.existsSync(srcDir)) {
      ensureDir(dstDir);
      for (const file of fs.readdirSync(srcDir)) {
        const src = path.join(srcDir, file);
        const dst = path.join(dstDir, file);
        if (fs.statSync(src).isFile() && !fs.existsSync(dst)) {
          fs.copyFileSync(src, dst);
          fotosCopiadas++;
        }
      }
    }
  }
  console.log(`  → ${fotosCopiadas} fotos copiadas\n`);

  // ── Parse cidade_estado ──
  function parseCidadeEstado(ce: string): { city: string | null; state: string | null } {
    if (!ce) return { city: null, state: null };
    const parts = ce.split('/');
    return { city: parts[0]?.trim() || null, state: parts[1]?.trim() || null };
  }

  // ── Normalize status ──
  function normalizeStatus(status: string): string {
    const s = (status || '').toLowerCase();
    if (s.includes('reserv')) return 'reservado';
    if (s.includes('vend') || s.includes('negócio') || s.includes('negocio')) return 'vendido';
    if (s.includes('alug')) return 'alugado';
    return 'disponivel';
  }

  // ── Import each property ──
  for (let i = 0; i < imoveis.length; i++) {
    const imovel = imoveis[i];
    process.stdout.write(`[${i + 1}/${imoveis.length}] Ref ${imovel.referencia}... `);

    try {
      const ce = parseCidadeEstado(imovel.cidade_estado);
      const exists = existingCodes.has(imovel.referencia);

      // ── Resolve owner ──
      let ownerId: string | null = null;
      const ownerName = (imovel.proprietario || '').trim();
      if (ownerName) {
        const key = ownerName.toLowerCase();
        if (ownerByName.has(key)) {
          ownerId = ownerByName.get(key)!;
        } else {
          const o = await prisma.owner.create({
            data: {
              id: generateId(),
              name: ownerName,
              phone: imovel.telefone || null,
              userId: defaultUserId,
            },
          });
          ownerId = o.id;
          ownerByName.set(key, ownerId);
        }
      }

      // ── Resolve building ──
      let buildingId: string | null = null;
      const buildingName = (imovel.edificio_condominio || '').trim();
      if (buildingName) {
        const key = buildingName.toLowerCase();
        if (buildingByName.has(key)) {
          buildingId = buildingByName.get(key)!;
        } else {
          const b = await prisma.building.create({
            data: {
              id: generateId(),
              name: buildingName,
              address: [imovel.rua, imovel.numero_edificio].filter(Boolean).join(', ') || null,
              neighborhood: imovel.bairro || null,
              city: ce.city,
              state: ce.state,
              userId: defaultUserId,
            },
          });
          buildingId = b.id;
          buildingByName.set(key, buildingId);
        }
      }

      // ── Complement ──
      const parts: string[] = [];
      if (imovel.numero_ap) parts.push(`Apto ${imovel.numero_ap}`);
      if (imovel.complemento) parts.push(imovel.complemento);
      const complement = parts.join(' / ') || null;

      // ── Internal notes ──
      const notesParts: string[] = [];
      if (imovel.chaves) notesParts.push(`Chaves: ${imovel.chaves}`);
      if (imovel.termos_venda) notesParts.push(`Termos: ${imovel.termos_venda}`);
      if (imovel.corretor) notesParts.push(`Corretor: ${imovel.corretor}`);

      // ── Category: all are venda (residencial) ──
      const category = 'venda';

      // ── PropertyType: normalize from tipo_imovel ──
      const typeMap: Record<string, string> = {
        'apartamento': 'apartamento', 'kitnet': 'apartamento', 'flat': 'apartamento', 'duplex': 'apartamento',
        'casa': 'casa', 'sobrado': 'casa', 'casa comercial': 'casa',
        'cobertura': 'cobertura',
        'terreno': 'terreno', 'lote': 'terreno',
        'sala comercial': 'sala_comercial', 'sala': 'sala_comercial', 'conjunto': 'sala_comercial',
        'loja': 'loja', 'ponto comercial': 'loja',
        'predio': 'predio', 'prédio': 'predio', 'edifício': 'predio',
        'sitio': 'sitio', 'sítio': 'sitio', 'chácara': 'sitio', 'chacara': 'sitio',
        'condominio': 'condominio', 'condomínio': 'condominio',
        'outros': 'outros', 'galpão': 'outros', 'galpao': 'outros', 'depósito': 'outros', 'deposito': 'outros',
      };
      const normType = (imovel.tipo_imovel || '').toLowerCase().trim();
      const propertyType = typeMap[normType] || 'apartamento';

      // ── Photos (already JSON array of paths) ──
      const photos = (imovel.fotos || []).map((f: string) => '/' + f.replace(/\\/g, '/'));

      // ── Build payload ──
      const data: any = {
        code: imovel.referencia,
        reference: imovel.referencia,
        propertyType,
        category,
        status: normalizeStatus(imovel.situacao),
        visibility: 'privado',
        country: 'Brasil',
        state: ce.state,
        city: ce.city,
        neighborhood: imovel.bairro || null,
        street: imovel.rua || null,
        number: imovel.numero_edificio || null,
        complement,
        bedrooms: imovel.dormitorios,
        garages: imovel.vagas,
        salePrice: imovel.preco_venda || null,
        rentPrice: imovel.preco_locacao || null,
        description: imovel.observacao || null,
        internalNotes: notesParts.join(' | ') || null,
        photos: JSON.stringify(photos),
        ownerId,
        buildingId,
        userId: defaultUserId,
      };

      if (exists) {
        const existing = existingProperties.find(p => p.code === imovel.referencia)!;
        await prisma.property.update({ where: { id: existing.id }, data });
        updated++;
        console.log('atualizado');
      } else {
        data.id = generateId();
        await prisma.property.create({ data });
        imported++;
        existingCodes.add(imovel.referencia);
        console.log('importado');
      }
    } catch (err: any) {
      errors++;
      errorList.push(`${imovel.referencia}: ${err.message.slice(0, 80)}`);
      console.log(`❌ ${err.message.slice(0, 80)}`);
    }
  }

  // ── Final report ──
  console.log('\n' + '═'.repeat(50));
  console.log('  RESUMO');
  console.log('═'.repeat(50));
  console.log(`  Total JSON:  ${imoveis.length}`);
  console.log(`  Importados:  ${imported}`);
  console.log(`  Atualizados: ${updated}`);
  console.log(`  Erros:       ${errors}`);
  for (const e of errorList) console.log(`    - ${e}`);
  console.log('\n  IMPORTAÇÃO FINALIZADA');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
