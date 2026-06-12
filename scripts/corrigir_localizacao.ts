import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://centromar.novobroker.com.br/broker';
const CREDENTIALS = { email: 'agenciador@centromar.com.br', password: 'centromarimob' };
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const FOTOS_DIR = path.join(ROOT, 'fotos');
const JSON_FILE = path.join(DATA_DIR, 'imoveis_exportados.json');
const CHECKPOINT_FILE = path.join(DATA_DIR, 'checkpoint_correcao.json');
const LISTING_CACHE = path.join(DATA_DIR, 'listing_cache.json');
function lerFotos(ref: string): string[] {
  const dir = path.join(FOTOS_DIR, ref);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(f)).filter(f => fs.statSync(path.join(dir, f)).size > 0).sort((a, b) => { const na = parseInt(a.match(/\d+/)?.[0] || '0'); const nb = parseInt(b.match(/\d+/)?.[0] || '0'); return na - nb; }).map(f => `fotos/${ref}/${f}`);
}

interface Checkpoint { concluidos: string[]; pendentes: string[]; }
function loadCp(): Checkpoint | null {
  try { if (fs.existsSync(CHECKPOINT_FILE)) return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8')); } catch {}
  return null;
}
function saveCp(cp: Checkpoint) { fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2), 'utf-8'); }

async function login(page: Page) {
  console.log('[LOGIN]');
  await page.goto(`${BASE_URL}/index.php/login`, { waitUntil: 'networkidle', timeout: 30000 });
  if (!page.url().includes('login')) return;
  await page.fill('input[name="userlogin"]', CREDENTIALS.email);
  await page.fill('input[name="userpass"]', CREDENTIALS.password);
  await page.click('button[type="submit"], input[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  if (page.url().includes('login')) throw new Error('Falha no login');
  console.log('  → OK');
}

async function listAll(page: Page): Promise<Map<string, string>> {
  console.log('[LISTAR]');
  await page.goto(`${BASE_URL}/index.php/imovel/imoveis/read/venda/0/?imo_venda=venda&imo_registro=0`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  const all = new Map<string, string>();
  let pn = 0;
  while (true) {
    pn++;
    const html = await page.content();
    const refs = new Map<string, string>();
    for (const m of html.matchAll(/imo_ref[^>]*>(\d+)<\/strong>/g)) refs.set(m[1], m[1]);
    for (const m of html.matchAll(/update\/(\d+)/g)) { const id = m[1]; if (!all.has(id)) all.set(id, refs.get(id) || id); }
    console.log(`  Pag ${pn}: ${all.size}`);
    const next = page.locator('a.next, a:has-text("Próximo"), a:has-text("Próxima"), [rel="next"]').first();
    try {
      if (await next.isVisible({ timeout: 2000 })) {
        const cls = await next.getAttribute('class').catch(() => '');
        if (cls?.includes('disabled')) break;
        await next.click(); await page.waitForTimeout(1500);
      } else break;
    } catch { break; }
  }
  console.log(`  Total: ${all.size}`);
  return all;
}

async function extrairCampos(page: Page, id: string) {
  await page.goto(`${BASE_URL}/index.php/imovel/imoveis/update/${id}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  const inputs: Record<string, string> = {};
  for (const el of await page.$$eval('input:not([type="submit"])', els => els.map(e => ({ n: (e as HTMLInputElement).name, v: (e as HTMLInputElement).value })))) if (el.n) inputs[el.n] = el.v;
  for (const el of await page.$$eval('select', els => els.map(e => { const s = e as HTMLSelectElement; const o = s.options[s.selectedIndex]; return { n: s.name, v: o?.value || '', t: o?.textContent?.trim() || '' }; }))) if (el.n) { inputs[el.n] = el.v; inputs[`${el.n}_label`] = el.t; }
  for (const el of await page.$$eval('textarea', els => els.map(e => ({ n: (e as HTMLTextAreaElement).name, v: (e as HTMLTextAreaElement).value })))) if (el.n) inputs[el.n] = el.v;

  const get = (...names: string[]) => { for (const n of names) if (inputs[n] !== undefined && inputs[n] !== '') return inputs[n]; return ''; };

  const bodyText = await page.textContent('body') || '';
  const ultMatch = bodyText.match(/Última\s+atualiza[çc][ãa]o\s+([\d\s\wáéíóúãõâêôà,:]+(?:atrás|horas|minutos|dias|semanas|meses))/i);
  const ultAtual = ultMatch ? ultMatch[1].trim() : get('imo_dt_atual', 'imo_data_atualizacao', 'imo_ultima_atualizacao');

  const compl = get('imo_logr_compl');
  let numeroAp = '';
  let complemento = '';
  if (compl) {
    const boxM = compl.match(/Box\s*:?\s*(\d+)/i);
    const salaM = compl.match(/Sala\s*:?\s*(\d+)/i);
    const lojaM = compl.match(/Loja\s*:?\s*(\d+)/i);
    if (boxM) { complemento = `Box: ${boxM[1]}`; numeroAp = ''; }
    else if (salaM) { complemento = `Sala: ${salaM[1]}`; numeroAp = ''; }
    else if (lojaM) { complemento = `Loja: ${lojaM[1]}`; numeroAp = ''; }
    else if (/^\d+$/.test(compl.trim())) numeroAp = compl.trim();
    else { numeroAp = compl.trim(); }
  }

  const propNome = get('imo_prop_nome', 'imo_proprietario', 'proprietario_nome');
  const propTel = get('imo_prop_tel', 'imo_proprietario_tel', 'proprietario_telefone');
  const vinculo = get('imo_prop_vinculo_label', 'imo_prop_vinculo', 'imo_vinculo');
  const isCorretor = vinculo.toLowerCase().includes('corretor');
  const proprietario = isCorretor ? null : (propNome || null);
  const corretor = isCorretor ? (propNome ? `${propNome} Corretor` : null) : null;

  const estado = get('imo_estado_label', 'imo_estado');
  const cidadeEstado = estado && estado !== '--'
    ? [get('imo_cidade'), estado].filter(Boolean).join('/')
    : (get('imo_cidade') ? `${get('imo_cidade')}/RS` : null);

  const precoVenda = get('imo_vl_venda', 'imo_valor_venda');
  const precoLocacao = get('imo_vl_locacao', 'imo_valor_locacao', 'imo_aluguel');
  const parseFloatBr = (v: string) => {
    if (!v || v === '' || v === '0' || v === '0,00' || v === 'R$ 0,00') return null;
    return parseFloat(v.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'));
  };

  const observacao = get('imo_obs', 'imo_observacoes', 'imo_obs_acesso');
  const situacao = get('imo_situacao_label', 'imo_situacao');
  const chaves = get('imo_chaves');
  const termosVenda = get('imo_termos_venda', 'imo_termos', 'imo_condicoes_venda');

  return {
    tipo_imovel: (get('imo_tipo_label', 'imo_tipo') || 'APARTAMENTO').toUpperCase(),
    categoria: 'RESIDENCIAL',
    dormitorios: get('imo_dorm', 'imo_dormitorios') ? parseInt(get('imo_dorm', 'imo_dormitorios').replace(/[^\d]/g, '')) || null : null,
    vagas: get('imo_vaga') ? parseInt(get('imo_vaga').replace(/[^\d]/g, '')) || null : null,
    preco_venda: parseFloatBr(precoVenda),
    preco_locacao: parseFloatBr(precoLocacao),
    edificio_condominio: get('imo_condominio') || null,
    bairro: get('imo_bairro') || null,
    cidade_estado: cidadeEstado,
    rua: get('imo_logr') || null,
    numero_edificio: get('imo_logr_num') || null,
    numero_ap: numeroAp || null,
    complemento: complemento || null,
    proprietario,
    corretor,
    telefone: propTel || null,
    ultima_atualizacao: ultAtual || get('imo_dt_atual', 'imo_data_atualizacao', 'imo_ultima_atualizacao') || '',
    observacao,
    situacao,
    chaves,
    termos_venda: termosVenda || null,
  };
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  CORREÇÃO DE LOCALIZAÇÃO VIA INPUTS');
  console.log(`  ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════\n');

  if (!fs.existsSync(JSON_FILE)) { console.error('JSON não encontrado'); return; }

  // Backup do JSON original
  const backupFile = path.join(DATA_DIR, 'imoveis_exportados_backup.json');
  if (!fs.existsSync(backupFile)) {
    fs.copyFileSync(JSON_FILE, backupFile);
    console.log(`Backup criado: ${backupFile}`);
  }

  const imoveis = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8')) as any[];
  console.log(`JSON carregado: ${imoveis.length} imóveis\n`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1366, height: 768 }, isMobile: false, hasTouch: false, javaScriptEnabled: true,
  });
  const page = await context.newPage();

  try {
    await login(page);

    // Cache da listagem (evita paginar 459 páginas de novo)
    let refToId: Map<string, string>;
    if (fs.existsSync(LISTING_CACHE)) {
      const arr: [string, string][] = JSON.parse(fs.readFileSync(LISTING_CACHE, 'utf-8'));
      refToId = new Map(arr);
      console.log(`Listagem carregada do cache: ${refToId.size} imóveis\n`);
    } else {
      refToId = await listAll(page);
      fs.writeFileSync(LISTING_CACHE, JSON.stringify([...refToId.entries()]), 'utf-8');
      console.log(`Listagem salva em cache\n`);
    }

    const cp = loadCp() || { concluidos: [], pendentes: Array.from(refToId.values()) };
    if (!cp.pendentes || cp.pendentes.length === 0) cp.pendentes = Array.from(refToId.values());
    cp.concluidos = cp.concluidos || [];
    saveCp(cp);
    console.log(`\nPendentes: ${cp.pendentes.length}, Concluídos: ${cp.concluidos.length}\n`);

    const totalPendentes = [...cp.pendentes];
    for (let i = 0; i < totalPendentes.length; i++) {
      const ref = totalPendentes[i];
      if (cp.concluidos.includes(ref)) continue;
      const id = [...refToId.entries()].find(([_, r]) => r === ref)?.[0];
      if (!id) { console.log(`[${i+1}/${cp.pendentes.length}] ${ref}: ID não encontrado`); continue; }
      process.stdout.write(`[${i+1}/${cp.pendentes.length}] Ref ${ref}... `);

      try {
        const campos = await extrairCampos(page, id);
        const idx = imoveis.findIndex((im: any) => im.referencia === ref);
        if (idx >= 0) {
          Object.assign(imoveis[idx], campos);
        } else {
          imoveis.push({ ...campos, referencia: ref, fotos: lerFotos(ref) });
        }

        cp.concluidos.push(ref);
        cp.pendentes = cp.pendentes.filter(r => r !== ref);
        saveCp(cp);

        if (cp.concluidos.length % 10 === 0) {
          fs.writeFileSync(JSON_FILE, JSON.stringify(imoveis, null, 2), 'utf-8');
        }
        console.log(`✅ ${campos.bairro || 's/bairro'} | ${campos.proprietario || 's/prop'}`);
      } catch (err: any) {
        console.log(`❌ ${(err as Error).message.slice(0, 80)}`);
      }
    }

    fs.writeFileSync(JSON_FILE, JSON.stringify(imoveis, null, 2), 'utf-8');
    const comBairro = imoveis.filter((i: any) => i.bairro && !i.bairro.includes('$')).length;
    console.log(`\n═══════════════════════════════════════════`);
    console.log(`  CORREÇÃO CONCLUÍDA`);
    console.log(`  Total: ${imoveis.length}`);
    console.log(`  Com bairro válido: ${comBairro}`);
    console.log(`═══════════════════════════════════════════`);
  } catch (err: any) {
    console.error(`\n[FATAL] ${err.message}`);
  } finally {
    await browser.close();
  }
}
main().catch(console.error);
