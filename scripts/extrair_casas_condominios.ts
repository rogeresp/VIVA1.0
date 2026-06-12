import { chromium, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://centromar.novobroker.com.br/broker';
const FILTER_BASE = BASE_URL + '/index.php/imovel/imoveis/index/venda/?cidade_input=Cap%C3%A3o+da+Canoa&imo_cat_id=3&imo_estado_id=43&imo_registro=0';

interface CasaCondominioData {
  ref: string;
  tipo: string;
  quadra: string;
  lote: string;
  numero_ap: string;
}

async function login(page: Page) {
  console.log('[LOGIN]');
  await page.goto(`${BASE_URL}/index.php/login`, { waitUntil: 'networkidle', timeout: 30000 });
  if (!page.url().includes('login')) { console.log('  → Já logado'); return; }
  await page.fill('input[name="userlogin"]', 'agenciador@centromar.com.br');
  await page.fill('input[name="userpass"]', 'centromarimob');
  await page.click('button[type="submit"], input[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  if (page.url().includes('login')) throw new Error('Falha no login');
  console.log('  → OK');
}

async function getTotalPages(page: Page): Promise<number> {
  await page.goto(FILTER_BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  const html = await page.content();
  const totalMatch = html.match(/de\s+(\d+)/);
  const total = totalMatch ? parseInt(totalMatch[1]) : 0;
  const pages = Math.ceil(total / 10);
  console.log(`  Total de imóveis: ${total} (${pages} páginas)`);
  return pages;
}

async function extractPageListings(page: Page, pageNum: number): Promise<{ id: string; ref: string }[]> {
  const url = pageNum === 1 ? FILTER_BASE : `${FILTER_BASE}&page=${pageNum}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  const html = await page.content();
  const blocks = html.split(/<div class="item id_/);
  const results: { id: string; ref: string }[] = [];

  for (const block of blocks.slice(1)) {
    const idMatch = block.match(/^(\d+)/);
    if (!idMatch) continue;
    const id = idMatch[1];
    const refMatch = block.match(/imo_ref[^>]*>(\d+)<\/strong>/);
    const ref = refMatch ? refMatch[1] : id;
    results.push({ id, ref });
  }

  return results;
}

async function extractDetail(page: Page, id: string): Promise<Record<string, string>> {
  await page.goto(`${BASE_URL}/index.php/imovel/imoveis/update/${id}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1200);
  const data: Record<string, string> = {};

  const inputs = await page.$$eval('input', els =>
    els.map(el => ({ n: (el as HTMLInputElement).name, v: (el as HTMLInputElement).value })));
  for (const { n, v } of inputs) if (n) data[n] = v;

  const selects = await page.$$eval('select', els => els.map(el => {
    const s = el as HTMLSelectElement;
    return { n: s.name, v: s.value, t: s.options[s.selectedIndex]?.textContent?.trim() || '' };
  }));
  for (const s of selects) { if (s.n) { data[s.n] = s.v; data[`${s.n}_label`] = s.t; } }

  const textareas = await page.$$eval('textarea', els =>
    els.map(el => ({ n: (el as HTMLTextAreaElement).name, v: (el as HTMLTextAreaElement).value })));
  for (const { n, v } of textareas) if (n) data[n] = v;

  return data;
}

function extractQuadraLote(inputs: Record<string, string>): { quadra: string; lote: string } {
  let quadra = '', lote = '';
  for (const [key, val] of Object.entries(inputs)) {
    const k = key.toLowerCase();
    const v = (val || '').trim();
    if (!v) continue;
    if (k.includes('quadra')) quadra = v;
    if (k === 'lote' || k.includes('lote')) lote = v;
  }
  return { quadra, lote };
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
function ensureDir(dir: string) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  EXTRAIR CASAS EM CONDOMÍNIO');
  console.log('  Buscar quadra e lote no NovoBroker');
  console.log('═══════════════════════════════════════════\n');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);

  try {
    await login(page);

    // Get total pages
    const totalPages = await getTotalPages(page);
    if (totalPages === 0) {
      console.log('Nenhum imóvel encontrado.');
      await browser.close();
      return;
    }

    // Collect all listing IDs from all pages
    console.log('\n[LISTAR] Coletando todas as páginas...');
    const allListings: { id: string; ref: string }[] = [];

    for (let p = 1; p <= totalPages; p++) {
      const listings = await extractPageListings(page, p);
      allListings.push(...listings);
      console.log(`  Pag ${p}/${totalPages}: ${listings.length} imóveis (total: ${allListings.length})`);
    }

    console.log(`\nTotal de imóveis coletados: ${allListings.length}`);

    // Extract details
    console.log('\n[EXTRAIR] Obtendo detalhes de cada imóvel...\n');
    const results: CasaCondominioData[] = [];

    // Load checkpoint if exists
    const dataDir = path.resolve(__dirname, '..', 'data');
    ensureDir(dataDir);
    const checkpointPath = path.join(dataDir, 'checkpoint_casas.json');
    const outPath = path.join(dataDir, 'casas_condominios.json');

    let doneRefs = new Set<string>();
    if (fs.existsSync(checkpointPath)) {
      try {
        doneRefs = new Set(JSON.parse(fs.readFileSync(checkpointPath, 'utf-8')));
        console.log(`Checkpoint carregado: ${doneRefs.size} já processados`);
      } catch {}
    }

    // Load previously saved results
    let savedResults: CasaCondominioData[] = [];
    if (fs.existsSync(outPath)) {
      try {
        savedResults = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
      } catch {}
    }

    for (let i = 0; i < allListings.length; i++) {
      const { id, ref } = allListings[i];

      if (doneRefs.has(ref)) {
        if ((i + 1) % 50 === 0) process.stdout.write(`\r  [${i + 1}/${allListings.length}] ${ref} (pulado)`);
        continue;
      }

      try {
        const inputs = await extractDetail(page, id);
        const tipo = inputs['imo_tipo_label'] || inputs['imo_tipo'] || '';
        const { quadra, lote } = extractQuadraLote(inputs);
        const numeroAp = inputs['imo_logr_compl'] || '';

        const hasQL = quadra || lote;
        process.stdout.write(`\r  [${i + 1}/${allListings.length}] Ref ${ref}${hasQL ? ` Q:${quadra} L:${lote}` : ' (sem Q/L)'}${numeroAp ? ` ${numeroAp}` : ''}   `);

        results.push({ ref, tipo, quadra, lote, numero_ap: numeroAp });
        doneRefs.add(ref);

        // Save checkpoint every 5
        if (doneRefs.size % 5 === 0) {
          fs.writeFileSync(checkpointPath, JSON.stringify([...doneRefs]), 'utf-8');
          const all = [...savedResults, ...results];
          fs.writeFileSync(outPath, JSON.stringify(all, null, 2), 'utf-8');
        }

        await sleep(500);
      } catch (err: any) {
        console.error(`\n  ❌ Ref ${ref}: ${err.message?.slice(0, 100)}`);
      }
    }

    // Final save
    const allResults = [...savedResults, ...results];
    fs.writeFileSync(outPath, JSON.stringify(allResults, null, 2), 'utf-8');
    fs.writeFileSync(checkpointPath, JSON.stringify([...doneRefs]), 'utf-8');

    const comQuadra = allResults.filter(r => r.quadra || r.lote);
    console.log(`\n\n═══════════════════════════════════════════`);
    console.log(`  Total: ${allResults.length}`);
    console.log(`  Com quadra/lote: ${comQuadra.length}`);
    console.log(`  Sem quadra/lote: ${allResults.length - comQuadra.length}`);
    console.log(`  Dados salvos: ${outPath}`);
    console.log(`═══════════════════════════════════════════`);

  } catch (err: any) {
    console.error(`\n[FATAL] ${err.message}`);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
