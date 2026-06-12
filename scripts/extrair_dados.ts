import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://centromar.novobroker.com.br/broker';
const CREDENTIALS = {
  email: 'agenciador@centromar.com.br',
  password: 'centromarimob',
};
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const FOTOS_DIR = path.join(ROOT, 'fotos');
const CHECKPOINT_FILE = path.join(DATA_DIR, 'checkpoint_extração.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'imoveis_exportados.json');

interface ImovelFlat {
  tipo_imovel: string;
  categoria: string;
  dormitorios: number | null;
  vagas: number | null;
  preco_venda: number | null;
  preco_locacao: number | null;
  edificio_condominio: string | null;
  bairro: string | null;
  cidade_estado: string | null;
  rua: string | null;
  numero_edificio: string | null;
  numero_ap: string | null;
  complemento: string | null;
  proprietario: string | null;
  corretor: string | null;
  telefone: string | null;
  observacao: string | null;
  referencia: string;
  ultima_atualizacao: string;
  fotos: string[];
}
interface CheckpointItem { referencia: string; erro: string; tentativas: number; }
interface Checkpoint {
  total_encontrados: number;
  ultimo_processado: string;
  concluidos: string[];
  com_erro: CheckpointItem[];
  pendentes: string[];
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
function ensureDir(dir: string) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

function loadCheckpoint(): Checkpoint | null {
  try { if (fs.existsSync(CHECKPOINT_FILE)) return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8')); } catch {}
  return null;
}
function saveCheckpoint(cp: Checkpoint) {
  ensureDir(DATA_DIR); fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2), 'utf-8');
}

async function login(page: Page): Promise<boolean> {
  console.log('[LOGIN]');
  await page.goto(`${BASE_URL}/index.php/login`, { waitUntil: 'networkidle', timeout: 30000 });
  if (!page.url().includes('login')) { console.log('  → Já logado'); return true; }
  await page.fill('input[name="userlogin"]', CREDENTIALS.email);
  await page.fill('input[name="userpass"]', CREDENTIALS.password);
  await page.click('button[type="submit"], input[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  if (page.url().includes('login')) { console.error('  → Falha no login'); return false; }
  console.log('  → OK'); return true;
}

async function listAllProperties(page: Page): Promise<{ id: string; ref: string }[]> {
  console.log('[LISTAR] Extraindo lista com paginação...');
  await page.goto(`${BASE_URL}/index.php/imovel/imoveis/read/venda/0/?imo_venda=venda&imo_registro=0`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  const all = new Map<string, string>();
  let pageNum = 0;
  while (true) {
    pageNum++;
    const html = await page.content();
    const updateMatches = html.matchAll(/update\/(\d+)/g);
    const refMatches = html.matchAll(/imo_ref[^>]*>(\d+)<\/strong>/g);
    const refs = new Map<string, string>();
    for (const m of refMatches) refs.set(m[1], m[1]);
    for (const m of updateMatches) {
      const id = m[1];
      if (!all.has(id)) all.set(id, refs.get(id) || id);
    }
    console.log(`  Pag ${pageNum}: ${all.size}`);
    const nextBtn = page.locator('a.next, a:has-text("Próximo"), a:has-text("Próxima"), [rel="next"]').first();
    try {
      if (await nextBtn.isVisible({ timeout: 2000 })) {
        const cls = await nextBtn.getAttribute('class').catch(() => '');
        if (cls?.includes('disabled')) break;
        await nextBtn.click();
        await page.waitForTimeout(1500);
      } else break;
    } catch { break; }
  }
  return Array.from(all.entries()).map(([id, ref]) => ({ id, ref }));
}

async function extractData(page: Page, id: string): Promise<Record<string, string>> {
  await page.goto(`${BASE_URL}/index.php/imovel/imoveis/update/${id}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  const data: Record<string, string> = {};
  const inputs = await page.$$eval('input:not([type="submit"])', els => els.map(el => ({ n: (el as HTMLInputElement).name, v: (el as HTMLInputElement).value })));
  for (const { n, v } of inputs) if (n) data[n] = v;
  const selects = await page.$$eval('select', els => els.map(el => { const s = el as HTMLSelectElement; const o = s.options[s.selectedIndex]; return { n: s.name, v: s.value, t: o?.textContent?.trim() || '' }; }));
  for (const s of selects) { if (s.n) { data[s.n] = s.v; data[`${s.n}_label`] = s.t; } }
  const textareas = await page.$$eval('textarea', els => els.map(el => ({ n: (el as HTMLTextAreaElement).name, v: (el as HTMLTextAreaElement).value })));
  for (const { n, v } of textareas) if (n) data[n] = v;
  const checked = await page.$$eval('input[type="checkbox"]:checked', els => els.map(el => ({ n: (el as HTMLInputElement).name.replace('[]', ''), v: (el as HTMLInputElement).value })));
  for (const { n, v } of checked) { if (!data[n]) data[n] = ''; else data[n] += ','; data[n] += v; }
  return data;
}

async function extractLocation(page: Page): Promise<{ edificio: string; bairro: string; cidade: string; estado: string; rua: string; numero_predio: string; numero_apartamento: string; box: string | null; }> {
  const out = { edificio: '', bairro: '', cidade: '', estado: '', rua: '', numero_predio: '', numero_apartamento: '', box: null as string | null };
  try {
    const pinBtn = page.locator('i.fa-map-marker, i.fa-map-pin, [class*="map-marker"], a[href*="endereco"], button:has-text("Localização")').first();
    if (await pinBtn.isVisible({ timeout: 2000 })) { await pinBtn.click(); await page.waitForTimeout(500); }
    const bodyText = await page.textContent('body') || '';
    const addrBlock = bodyText.match(/item-info-addr[\s\S]*?(?=ultimo-atual|imo_status|$)/i)?.[0] || '';
    if (addrBlock) {
      const lines = addrBlock.split(/<br\s*\/?>|<p>|<div>/i).map(l => l.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (i === 0 && line) out.edificio = line;
        else if (i === 1 && line) {
          const bairroM = line.match(/^([^-]+?)\s*-\s*(.+)$/);
          if (bairroM) { out.bairro = bairroM[1].trim(); const csM = bairroM[2].match(/^(.+?)\s*\/\s*(.+)$/); if (csM) { out.cidade = csM[1].trim(); out.estado = csM[2].trim(); } else out.cidade = bairroM[2].trim(); }
          else { const csM = line.match(/^(.+?)\s*\/\s*(.+)$/); if (csM) { out.cidade = csM[1].trim(); out.estado = csM[2].trim(); } else out.bairro = line; }
        } else if (i === 2 && line) {
          const boxM = line.match(/Box:\s*([^\s-][^-]*?)(?:\s*-|\s*$)/i);
          if (boxM) out.box = boxM[1].trim();
          let addrLine = line.replace(/Box:\s*[^-\s][^-]*/i, '').trim();
          const slashParts = addrLine.split('/');
          if (slashParts.length >= 2) { const addrPart = slashParts[0].trim(); out.numero_apartamento = slashParts[1].trim(); const addrM = addrPart.match(/^(.+?),\s*(\d[\d\w]*)$/); if (addrM) { out.rua = addrM[1].trim(); out.numero_predio = addrM[2].trim(); } else out.rua = addrPart; }
          else { const addrM = addrLine.match(/^(.+?),\s*(\d[\d\w]*)$/); if (addrM) { out.rua = addrM[1].trim(); out.numero_predio = addrM[2].trim(); } else out.rua = addrLine; }
        }
      }
    }
  } catch {}
  if (!out.rua) out.rua = await page.$eval('input[name="imo_logr"]', el => (el as HTMLInputElement).value).catch(() => '');
  if (!out.numero_predio) out.numero_predio = await page.$eval('input[name="imo_logr_num"]', el => (el as HTMLInputElement).value).catch(() => '');
  if (!out.numero_apartamento) out.numero_apartamento = await page.$eval('input[name="imo_logr_compl"]', el => (el as HTMLInputElement).value).catch(() => '');
  if (!out.bairro) out.bairro = await page.$eval('input[name="imo_bairro"], select[name="imo_bairro"]', el => (el as HTMLInputElement).value || (el as HTMLSelectElement).value).catch(() => '');
  if (!out.cidade) out.cidade = await page.$eval('input[name="imo_cidade"]', el => (el as HTMLInputElement).value).catch(() => '');
  if (!out.estado) out.estado = await page.$eval('select[name="imo_estado"]', el => { const s = el as HTMLSelectElement; return s.options[s.selectedIndex]?.textContent?.trim() || ''; }).catch(() => '');
  if (!out.edificio) out.edificio = await page.$eval('input[name="imo_condominio"], select[name="imo_condominio"]', el => { const i = el as HTMLInputElement; if (i.value) return i.value; const s = el as HTMLSelectElement; return s.options[s.selectedIndex]?.textContent?.trim() || ''; }).catch(() => '');
  return out;
}

function lerFotos(ref: string): string[] {
  const dir = path.join(FOTOS_DIR, ref);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(f)).filter(f => fs.statSync(path.join(dir, f)).size > 0).sort((a, b) => { const na = parseInt(a.match(/\d+/)?.[0] || '0'); const nb = parseInt(b.match(/\d+/)?.[0] || '0'); return na - nb; }).map(f => `fotos/${ref}/${f}`);
}

function parseFloatBr(val: string): number | null {
  if (!val || val === '' || val === '0') return null;
  return parseFloat(val.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.').trim());
}
function parseIntBr(val: string): number | null {
  if (!val) return null;
  return parseInt(val.replace(/[^\d]/g, ''), 10) || null;
}

function buildFlat(inputs: Record<string, string>, loc: Awaited<ReturnType<typeof extractLocation>>, ref: string, fotos: string[]): ImovelFlat {
  const get = (...names: string[]) => { for (const n of names) if (inputs[n] !== undefined && inputs[n] !== '') return inputs[n]; return ''; };
  const rawUltAtual = get('imo_dt_atual', 'imo_data_atualizacao', 'imo_ultima_atualizacao');
  const ultMatch = rawUltAtual.match(/^([\d\s\w]+(?:\s+atrás|horas|minutos|dias|semanas|meses))/i);
  const ultAtual = ultMatch ? ultMatch[1].trim() : rawUltAtual;
  let tipo = get('imo_tipo_label', 'imo_tipo');
  if (tipo.includes('»')) tipo = tipo.split('»')[0].trim();
  const nomeProp = get('imo_prop_nome', 'imo_proprietario', 'proprietario_nome');
  const vinculo = get('imo_prop_vinculo_label', 'imo_prop_vinculo', 'imo_vinculo');
  const propNome = (vinculo || '').toLowerCase().includes('corretor') ? null : (nomeProp || null);
  const corretorNome = (vinculo || '').toLowerCase().includes('corretor') ? (nomeProp ? `${nomeProp} Corretor` : null) : null;
  const complementParts: string[] = [];
  if (loc.box) complementParts.push(`Box: ${loc.box}`);
  if (get('imo_logr_compl')) complementParts.push(get('imo_logr_compl'));
  const precoVenda = parseFloatBr(get('imo_vl_venda', 'imo_valor_venda'));
  const precoLocacao = parseFloatBr(get('imo_vl_locacao', 'imo_valor_locacao', 'imo_aluguel'));
  return {
    tipo_imovel: tipo ? tipo.toUpperCase() : 'APARTAMENTO',
    categoria: (get('imo_finalidade_label', 'imo_finalidade', 'imo_cat_label', 'imo_cat') || 'RESIDENCIAL').toUpperCase(),
    dormitorios: parseIntBr(get('imo_dorm', 'imo_dormitorios')),
    vagas: parseIntBr(get('imo_vaga')),
    preco_venda: precoVenda,
    preco_locacao: precoLocacao,
    edificio_condominio: loc.edificio || null,
    bairro: loc.bairro || null,
    cidade_estado: [loc.cidade, loc.estado].filter(Boolean).join('/') || null,
    rua: loc.rua || null,
    numero_edificio: loc.numero_predio || null,
    numero_ap: loc.numero_apartamento || null,
    complemento: complementParts.join(' / ') || null,
    proprietario: propNome,
    corretor: corretorNome,
    telefone: get('imo_prop_tel', 'imo_proprietario_tel', 'proprietario_telefone') || null,
    observacao: get('imo_obs', 'imo_observacoes', 'imo_obs_acesso') || null,
    referencia: ref,
    ultima_atualizacao: ultAtual,
    fotos,
  };
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  EXTRAÇÃO DE DADOS TEXTUAIS');
  console.log(`  ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════\n');

  const browser: Browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, javaScriptEnabled: true,
  });
  const page = await context.newPage();

  try {
    if (!await login(page)) { await browser.close(); return; }
    const listingIds = await listAllProperties(page);
    console.log(`\nTotal na listagem: ${listingIds.length}\n`);

    const cp = loadCheckpoint();
    const allRefs = listingIds.map(l => l.ref);
    const concluidosSet = new Set(cp?.concluidos || []);
    const pendentes = allRefs.filter(ref => !concluidosSet.has(ref));
    const newCp: Checkpoint = { total_encontrados: listingIds.length, ultimo_processado: '', concluidos: cp?.concluidos || [], com_erro: cp?.com_erro || [], pendentes };
    saveCheckpoint(newCp);
    console.log(`Checkpoint: ${newCp.concluidos.length} concluídos, ${newCp.pendentes.length} pendentes\n`);

    const allResults: ImovelFlat[] = [];

    for (let idx = 0; idx < pendentes.length; idx++) {
      const ref = pendentes[idx];
      const listing = listingIds.find(l => l.ref === ref);
      if (!listing) { console.log(`[${idx+1}/${pendentes.length}] ${ref} skip`); continue; }
      console.log(`\n[${idx+1}/${pendentes.length}] Ref ${ref}`);
      try {
        const inputs = await extractData(page, listing.id);
        const loc = await extractLocation(page);
        const fotos = lerFotos(ref);
        const imovel = buildFlat(inputs, loc, ref, fotos);
        allResults.push(imovel);
        newCp.concluidos.push(ref);
        newCp.ultimo_processado = ref;
        newCp.pendentes = newCp.pendentes.filter(r => r !== ref);
        saveCheckpoint(newCp);
        if (newCp.concluidos.length % 10 === 0) { fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allResults, null, 2), 'utf-8'); console.log(`  [SAVE] ${newCp.concluidos.length} salvos`); }
        console.log(`  ✅ ${fotos.length > 0 ? fotos.length+' foto(s)' : 'sem fotos'} | ${imovel.tipo_imovel} ${imovel.bairro ? '- '+imovel.bairro : ''} | ${imovel.preco_venda ? 'R$ '+imovel.preco_venda.toLocaleString('pt-BR') : 's/preço'}`);
        await sleep(800);
      } catch (err: any) {
        console.error(`  ❌ ${err.message.slice(0, 100)}`);
        const exist = newCp.com_erro.find(e => e.referencia === ref);
        if (exist) { exist.tentativas++; exist.erro = err.message; } else newCp.com_erro.push({ referencia: ref, erro: err.message, tentativas: 1 });
        saveCheckpoint(newCp);
      }
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allResults, null, 2), 'utf-8');
    const comFotos = allResults.filter(i => i.fotos.length > 0).length;
    const totalFotos = allResults.reduce((s, i) => s + i.fotos.length, 0);
    console.log(`\n═══════════════════════════════════════════`);
    console.log(`  EXTRAÇÃO CONCLUÍDA`);
    console.log(`  Total: ${allResults.length}`);
    console.log(`  Com fotos: ${comFotos}`);
    console.log(`  Total fotos: ${totalFotos}`);
    console.log(`  Erros: ${newCp.com_erro.length}`);
    console.log(`═══════════════════════════════════════════`);
  } catch (err: any) {
    console.error(`\n[FATAL] ${err.message}`);
  } finally {
    await browser.close();
  }
}
main().catch(console.error);
