import fs from 'fs';
import path from 'path';

const API_URL = 'https://viva1-0-1.onrender.com/api';
const JSON_FILE = path.resolve('data/imoveis_exportados.json');
const BATCH_SIZE = 3;

interface Imovel {
  tipo_imovel: string;
  categoria: string;
  dormitorios: number;
  vagas: number;
  preco_venda: number;
  preco_locacao: number;
  edificio_condominio: string;
  bairro: string;
  cidade_estado: string;
  rua: string;
  numero_edificio: string;
  numero_ap: string;
  complemento: string;
  proprietario: string;
  corretor: string;
  telefone: string;
  observacao: string;
  referencia: string;
  fotos: string[];
  situacao: string;
  chaves: string;
  termos_venda: string;
}

function parseCityState(ce: string): { city: string; state: string } {
  if (!ce) return { city: '', state: '' };
  const parts = ce.split('/');
  return { city: (parts[0] || '').trim(), state: (parts[1] || '').trim() };
}

function normalizeStatus(s: string): string {
  const lower = (s || '').toLowerCase();
  if (lower.includes('reserv')) return 'reservado';
  if (lower.includes('vend') || lower.includes('negócio') || lower.includes('negocio')) return 'vendido';
  if (lower.includes('alug')) return 'alugado';
  return 'disponivel';
}

function normalizeType(t: string): string {
  const map: Record<string, string> = {
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
  return map[t.toLowerCase().trim()] || 'apartamento';
}

function normalizePhotos(fotos: any): string[] {
  if (!fotos) return [];
  if (Array.isArray(fotos)) return fotos.map(f => '/' + String(f).trim().replace(/\\/g, '/'));
  return [];
}

const USER_ID = 'user-centromar';

async function ensureProfile() {
  process.stdout.write('👤 Verificando perfil... ');
  const res = await fetch(`${API_URL}/profile`, {
    headers: { 'x-user-id': USER_ID },
  });
  if (res.ok) {
    const profile = await res.json();
    console.log(`✅ ${profile.full_name || profile.name}`);
  } else {
    console.log(`⚠️  ${res.status} - a importação pode falhar se o perfil não existir`);
  }
}

async function main() {
  if (!fs.existsSync(JSON_FILE)) {
    console.error(`ERRO: ${JSON_FILE} não encontrado`);
    process.exit(1);
  }

  await ensureProfile();

  const imoveis: Imovel[] = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));
  console.log(`📄 ${imoveis.length} imóveis carregados\n`);

  // Extract unique owners
  const ownerMap = new Map<string, { name: string; phone: string }>();
  for (const imovel of imoveis) {
    const name = (imovel.proprietario || '').trim();
    if (name && !ownerMap.has(name.toLowerCase())) {
      ownerMap.set(name.toLowerCase(), { name, phone: imovel.telefone || '' });
    }
  }
  const owners = Array.from(ownerMap.values());
  console.log(`👤 ${owners.length} proprietários únicos\n`);

  // Transform properties
  const properties = imoveis.map(imovel => {
    const ce = parseCityState(imovel.cidade_estado);
    const parts: string[] = [];
    if (imovel.numero_ap) parts.push(`Apto ${imovel.numero_ap}`);
    if (imovel.complemento) parts.push(imovel.complemento);

    const notesParts: string[] = [];
    if (imovel.chaves) notesParts.push(`Chaves: ${imovel.chaves}`);
    if (imovel.termos_venda) notesParts.push(`Termos: ${imovel.termos_venda}`);
    if (imovel.corretor) notesParts.push(`Corretor: ${imovel.corretor}`);

    return {
      property_type: normalizeType(imovel.tipo_imovel),
      category: 'venda',
      status: normalizeStatus(imovel.situacao),
      city: ce.city,
      neighborhood: imovel.bairro || '',
      street: imovel.rua || '',
      number: imovel.numero_edificio || '',
      complement: parts.join(' / ') || imovel.complemento || '',
      bedrooms: imovel.dormitorios || null,
      garages: imovel.vagas || null,
      sale_price: imovel.preco_venda || null,
      description: imovel.observacao || '',
      internal_notes: notesParts.join(' | ') || '',
      photos: JSON.stringify(normalizePhotos(imovel.fotos)),
      building_name: (imovel.edificio_condominio || '').trim() || undefined,
      owner_name: (imovel.proprietario || '').trim() || undefined,
      owner_phone: imovel.telefone || undefined,
    };
  });

  // Build owner lookup by name -> owner object
  const ownerByName = new Map<string, { name: string; phone: string }>();
  for (const o of owners) ownerByName.set(o.name.toLowerCase(), o);

  // Send in batches
  let created = 0;
  let duplicates = 0;
  let errors = 0;

  for (let i = 0; i < properties.length; i += BATCH_SIZE) {
    const batch = properties.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(properties.length / BATCH_SIZE);

    // Only send owners that are referenced in this batch
    const batchOwnerNames = new Set<string>();
    for (const p of batch) {
      if (p.owner_name) batchOwnerNames.add(p.owner_name.toLowerCase().trim());
    }
    const batchOwners = owners.filter(o => batchOwnerNames.has(o.name.toLowerCase()));
    process.stdout.write(`[${batchNum}/${totalBatches}] ${batch.length} imóveis, ${batchOwners.length} proprietários... `);

    try {
      const res = await fetch(`${API_URL}/properties/batch-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': USER_ID,
        },
        body: JSON.stringify({ properties: batch, owners: batchOwners }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text.slice(0, 200)}`);
      }

      const result = await res.json();
      created += result.created || 0;
      duplicates += result.duplicates || 0;
      errors += result.errors || 0;
      console.log(`✅ criados: ${result.created}, duplicados: ${result.duplicates}, erros: ${result.errors}`);
    } catch (err: any) {
      errors += batch.length;
      console.log(`❌ ${err.message.slice(0, 100)}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('  RESUMO DA IMPORTAÇÃO');
  console.log('='.repeat(50));
  console.log(`  Total no JSON: ${properties.length}`);
  console.log(`  Criados:       ${created}`);
  console.log(`  Duplicados:    ${duplicates}`);
  console.log(`  Erros:         ${errors}`);
  console.log('='.repeat(50));
}

main().catch(console.error);
