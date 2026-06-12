import { chromium, type Page, type Browser, type BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

// ─── CONFIG ────────────────────────────────────────────────────────────────
const BASE_URL = 'https://centromar.novobroker.com.br/broker';
const CREDENTIALS = {
  email: 'agenciador@centromar.com.br',
  password: 'centromarimob',
};
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const FOTOS_DIR = path.join(ROOT, 'fotos');
const CHECKPOINT_FILE = path.join(DATA_DIR, 'checkpoint.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'imoveis_exportados.json');
const RELATORIO_FILE = path.join(ROOT, 'relatorio_migracao.txt');

// ─── TYPES ──────────────────────────────────────────────────────────────────
interface ImovelData {
  referencia: string;
  tipo: string;
  finalidade: string;
  edificio: string;
  bairro: string;
  cidade: string;
  estado: string;
  rua: string;
  numero_predio: string;
  numero_apartamento: string;
  box: string | null;
  detalhes: {
    dormitorios: number | null;
    vagas: number | null;
    area_m2: number | null;
    valor_venda: number | null;
    status: string;
    no_site: boolean;
    ultima_atualizacao: string;
  };
  proprietario: {
    nome: string;
    telefone: string;
    vinculo: string;
  };
  chaves: {
    localizacao: string;
    observacoes: string;
  };
  fotos: string[];
}
interface CheckpointItem {
  referencia: string;
  erro: string;
  tentativas: number;
}
interface Checkpoint {
  total_encontrados: number;
  ultimo_processado: string;
  concluidos: string[];
  com_erro: CheckpointItem[];
  pendentes: string[];
}

// ─── HELPERS ────────────────────────────────────────────────────────────────
let totalFotosBaixadas = 0;
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
function ensureDir(dir: string) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

function loadCheckpoint(): Checkpoint | null {
  try { if (fs.existsSync(CHECKPOINT_FILE)) return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8')); } catch {}
  return null;
}
function saveCheckpoint(cp: Checkpoint) {
  ensureDir(DATA_DIR);
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2), 'utf-8');
}
function appendRelatorio(text: string) {
  fs.appendFileSync(RELATORIO_FILE, text + '\n', 'utf-8');
}

function parseBrFloat(val: string): number | null {
  if (!val || val === '0') return null;
  const c = val.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.').trim();
  const n = parseFloat(c);
  return isNaN(n) ? null : n;
}
function parseBrInt(val: string): number | null {
  if (!val) return null;
  const n = parseInt(val.replace(/[^\d]/g, ''), 10);
  return isNaN(n) ? null : n;
}

// ─── LOGIN ──────────────────────────────────────────────────────────────────
async function login(page: Page): Promise<boolean> {
  console.log('[1/5] Login...');
  await page.goto(`${BASE_URL}/index.php/login`, { waitUntil: 'networkidle', timeout: 30000 });
  if (!page.url().includes('login')) { console.log('  → Já logado'); return true; }
  await page.fill('input[name="userlogin"]', CREDENTIALS.email);
  await page.fill('input[name="userpass"]', CREDENTIALS.password);
  await page.click('button[type="submit"], input[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  if (page.url().includes('login')) { console.error('  → Falha no login'); return false; }
  console.log('  → Dashboard carregado');
  return true;
}

// ─── NAVEGAR PARA LISTAGEM ─────────────────────────────────────────────────
async function navigateToListing(page: Page) {
  console.log('[2/5] Navegando para listagem de imóveis à venda...');
  await page.goto(
    `${BASE_URL}/index.php/imovel/imoveis/read/venda/0/?imo_venda=venda&imo_registro=0`,
    { waitUntil: 'networkidle', timeout: 30000 }
  );
  await page.waitForTimeout(1500);
  console.log(`  → ${page.url()}`);
}

// ─── LISTAR TODOS IMÓVEIS ──────────────────────────────────────────────────
async function listAllProperties(page: Page): Promise<{ id: string; ref: string }[]> {
  console.log('[3/5] Extraindo lista com paginação...');
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
  const result = Array.from(all.entries()).map(([id, ref]) => ({ id, ref }));
  console.log(`  → Total: ${result.length}`);
  return result;
}

// ─── EXTRAIR DADOS TEXTUAIS ────────────────────────────────────────────────
async function extractDetailData(page: Page, id: string): Promise<Record<string, string>> {
  await page.goto(`${BASE_URL}/index.php/imovel/imoveis/update/${id}`, {
    waitUntil: 'networkidle', timeout: 30000,
  });
  await page.waitForTimeout(1500);

  const data: Record<string, string> = {};
  const inputs = await page.$$eval('input:not([type="submit"])', els =>
    els.map(el => ({ n: (el as HTMLInputElement).name, v: (el as HTMLInputElement).value }))
  );
  for (const { n, v } of inputs) if (n) data[n] = v;

  const selects = await page.$$eval('select', els =>
    els.map(el => {
      const sel = el as HTMLSelectElement;
      const opt = sel.options[sel.selectedIndex];
      return { n: sel.name, v: sel.value, t: opt?.textContent?.trim() || '' };
    })
  );
  for (const s of selects) { if (s.n) { data[s.n] = s.v; data[`${s.n}_label`] = s.t; } }

  const textareas = await page.$$eval('textarea', els =>
    els.map(el => ({ n: (el as HTMLTextAreaElement).name, v: (el as HTMLTextAreaElement).value }))
  );
  for (const { n, v } of textareas) if (n) data[n] = v;

  const checked = await page.$$eval('input[type="checkbox"]:checked', els =>
    els.map(el => ({ n: (el as HTMLInputElement).name.replace('[]', ''), v: (el as HTMLInputElement).value }))
  );
  for (const { n, v } of checked) {
    if (!data[n]) data[n] = '';
    else data[n] += ',';
    data[n] += v;
  }
  return data;
}

// ─── EXTRAIR LOCALIZAÇÃO DO PAINEL ─────────────────────────────────────────
async function extractLocation(page: Page): Promise<{
  edificio: string; bairro: string; cidade: string; estado: string;
  rua: string; numero_predio: string; numero_apartamento: string; box: string | null;
}> {
  const out = { edificio: '', bairro: '', cidade: '', estado: '',
    rua: '', numero_predio: '', numero_apartamento: '', box: null as string | null };

  try {
    // Try to open location panel
    const pinBtn = page.locator('i.fa-map-marker, i.fa-map-pin, [class*="map-marker"], a[href*="endereco"], button:has-text("Localização")').first();
    if (await pinBtn.isVisible({ timeout: 2000 })) { await pinBtn.click(); await page.waitForTimeout(500); }

    // Get location panel text
    const bodyText = await page.textContent('body') || '';
    const addrBlock = bodyText.match(/item-info-addr[\s\S]*?(?=ultimo-atual|imo_status|$)/i)?.[0] || '';

    if (addrBlock) {
      const lines = addrBlock.split(/<br\s*\/?>|<p>|<div>/i).map(l => l.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (i === 0 && line) out.edificio = line;
        else if (i === 1 && line) {
          const bairroM = line.match(/^([^-]+?)\s*-\s*(.+)$/);
          if (bairroM) {
            out.bairro = bairroM[1].trim();
            const csM = bairroM[2].match(/^(.+?)\s*\/\s*(.+)$/);
            if (csM) { out.cidade = csM[1].trim(); out.estado = csM[2].trim(); }
            else out.cidade = bairroM[2].trim();
          } else {
            const csM = line.match(/^(.+?)\s*\/\s*(.+)$/);
            if (csM) { out.cidade = csM[1].trim(); out.estado = csM[2].trim(); }
            else out.bairro = line;
          }
        } else if (i === 2 && line) {
          const boxM = line.match(/Box:\s*([^\s-][^-]*?)(?:\s*-|\s*$)/i);
          if (boxM) out.box = boxM[1].trim();
          let addrLine = line.replace(/Box:\s*[^-\s][^-]*/i, '').trim();
          const slashParts = addrLine.split('/');
          if (slashParts.length >= 2) {
            const addrPart = slashParts[0].trim();
            out.numero_apartamento = slashParts[1].trim();
            const addrM = addrPart.match(/^(.+?),\s*(\d[\d\w]*)$/);
            if (addrM) { out.rua = addrM[1].trim(); out.numero_predio = addrM[2].trim(); }
            else out.rua = addrPart;
          } else {
            const addrM = addrLine.match(/^(.+?),\s*(\d[\d\w]*)$/);
            if (addrM) { out.rua = addrM[1].trim(); out.numero_predio = addrM[2].trim(); }
            else out.rua = addrLine;
          }
        }
      }
    }
  } catch {}

  // Fallback: read from input fields
  if (!out.rua) out.rua = await page.$eval('input[name="imo_logr"]', el => (el as HTMLInputElement).value).catch(() => '');
  if (!out.numero_predio) out.numero_predio = await page.$eval('input[name="imo_logr_num"]', el => (el as HTMLInputElement).value).catch(() => '');
  if (!out.numero_apartamento) out.numero_apartamento = await page.$eval('input[name="imo_logr_compl"]', el => (el as HTMLInputElement).value).catch(() => '');
  if (!out.bairro) out.bairro = await page.$eval('input[name="imo_bairro"], select[name="imo_bairro"]', el => (el as HTMLInputElement).value || (el as HTMLSelectElement).value).catch(() => '');
  if (!out.cidade) out.cidade = await page.$eval('input[name="imo_cidade"]', el => (el as HTMLInputElement).value).catch(() => '');
  if (!out.estado) out.estado = await page.$eval('select[name="imo_estado"]', el => {
    const s = el as HTMLSelectElement; return s.options[s.selectedIndex]?.textContent?.trim() || '';
  }).catch(() => '');
  if (!out.edificio) out.edificio = await page.$eval('input[name="imo_condominio"], select[name="imo_condominio"]', el => {
    const i = el as HTMLInputElement; if (i.value) return i.value;
    const s = el as HTMLSelectElement; return s.options[s.selectedIndex]?.textContent?.trim() || '';
  }).catch(() => '');

  return out;
}

// ─── BAIXAR FOTOS VIA CENTRAL DE MÍDIAS ───────────────────────────────────
async function downloadPhotos(page: Page, context: BrowserContext, id: string, ref: string): Promise<string[]> {
  console.log('  [FOTOS] Iniciando...');
  const propDir = path.join(FOTOS_DIR, ref);
  ensureDir(propDir);
  const fotos: string[] = [];

  try {
    // Check if camera icon is visible — if not, reload page
    const cameraBtn = page.locator(
      'a[href*="foto"], a[href*="media"], a[href*="galeria"], i.fa-camera, [class*="camera"]'
    ).first();

    try {
      await cameraBtn.waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      console.log('  [FOTOS] Câmera não visível, recarregando página...');
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await cameraBtn.waitFor({ state: 'visible', timeout: 8000 });
    }

    // Open Media Center
    await cameraBtn.click();
    await page.waitForTimeout(2000);

    // Wait for modal
    try {
      await page.waitForSelector('.modal, [class*="modal"], [class*="media"], [class*="fotos"]', { timeout: 8000 });
    } catch {
      console.log('  [FOTOS] Modal não apareceu, tentando fallback...');
    }

    // Extract gallery total from modal
    let galleryTotal: number | null = null;
    try {
      const modalText = await page.textContent('.modal, [class*="media"], [class*="fotos"]').catch(() => '') || '';
      const totalMatch = modalText.match(/(\d+)\s*foto|total[:\s]*(\d+)|(\d+)\s*imagem/i);
      if (totalMatch) {
        galleryTotal = parseInt(totalMatch[1] || totalMatch[2] || totalMatch[3]);
        if (galleryTotal) console.log(`  [FOTOS] Galeria mostra ${galleryTotal} foto(s)`);
      }
    } catch {}

    // Try download all button
    const downloadBtn = page.locator(
      'a:has-text("Download"), button:has-text("Download"), i.fa-download, [title*="Download"], [class*="download"]'
    ).first();

    if (await downloadBtn.isVisible({ timeout: 3000 })) {
      const downloadPromise = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
      await downloadBtn.click();
      console.log('  [FOTOS] Aguardando download...');
      const download = await downloadPromise;

      if (download) {
        const zipPath = path.join(propDir, `fotos_${ref}.zip`);
        await download.saveAs(zipPath);
        console.log(`  [FOTOS] ZIP salvo: ${zipPath}`);

        if (fs.existsSync(zipPath) && fs.statSync(zipPath).size > 0) {
          try {
            new AdmZip(zipPath).extractAllTo(propDir, true);
            console.log('  [FOTOS] Extraído com adm-zip');
          } catch {
            try {
              const { execSync } = require('child_process');
              execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${propDir}' -Force"`, { stdio: 'ignore' });
              console.log('  [FOTOS] Extraído com PowerShell');
            } catch {}
          }
          try { fs.unlinkSync(zipPath); } catch {}
        }
      } else {
        console.log('  [FOTOS] Download não iniciado');
      }
    }

    // List files
    let files = fs.readdirSync(propDir).filter(f => /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(f)).sort();

    // Fallback: capture via evaluate
    if (files.length === 0) {
      console.log('  [FOTOS] Fallback: capturando URLs via evaluate...');
      let fotoUrls: string[] = await page.$$eval('img[src*="foto"], img[src*="imagem"], .media-grid img, .galeria img', els =>
        els.map(el => (el as HTMLImageElement).src).filter(Boolean)
      ).catch(() => []);

      if (fotoUrls.length === 0) {
        const html = await page.content();
        const srcMatches = html.matchAll(/src=["']([^"']+(foto|imagem|img)[^"']+)["']/gi);
        for (const m of srcMatches) {
          const url = m[1];
          if (url.startsWith('http') && !fotoUrls.includes(url)) fotoUrls.push(url);
        }
      }

      if (fotoUrls.length > 0) {
        console.log(`  [FOTOS] ${fotoUrls.length} URLs via fallback`);
        const cookies = await context.cookies();
        const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        for (let i = 0; i < fotoUrls.length; i++) {
          try {
            const res = await fetch(fotoUrls[i], { headers: { Cookie: cookieStr } });
            if (res.ok) {
              const buf = Buffer.from(await res.arrayBuffer());
              const ext = path.extname(new URL(fotoUrls[i]).pathname) || '.jpg';
              fs.writeFileSync(path.join(propDir, `foto_${String(i + 1).padStart(2, '0')}${ext}`), buf);
            }
          } catch {}
        }
      }
    }

    // List again and rename to standard order
    files = fs.readdirSync(propDir).filter(f => /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(f)).sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] || '0');
      const nb = parseInt(b.match(/\d+/)?.[0] || '0');
      return na - nb;
    });

    for (let i = 0; i < files.length; i++) {
      const ext = path.extname(files[i]);
      const newName = `foto_${String(i + 1).padStart(2, '0')}${ext}`;
      if (files[i] !== newName) {
        try { fs.renameSync(path.join(propDir, files[i]), path.join(propDir, newName)); } catch {}
      }
      fotos.push(`fotos/${ref}/${newName}`);
    }

    totalFotosBaixadas += fotos.length;
    console.log(`  [FOTOS] ${fotos.length} foto(s)`);

    // Validação: contar no disco vs gallery total
    const diskCount = fs.readdirSync(propDir).filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f)).length;
    if (galleryTotal && diskCount !== galleryTotal) {
      console.log(`  ⚠ Galeria mostra ${galleryTotal}, disco tem ${diskCount}. Tentando fallback...`);
      // Try fallback only if there's a mismatch
      const html = await page.content();
      const srcMatches = html.matchAll(/src=["']([^"']+(foto|imagem|img)[^"']+)["']/gi);
      const fotoUrls: string[] = [];
      for (const m of srcMatches) {
        const url = m[1];
        if (url.startsWith('http') && !fotoUrls.includes(url)) fotoUrls.push(url);
      }
      if (fotoUrls.length > 0) {
        const cookies = await context.cookies();
        const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        for (let i = 0; i < fotoUrls.length; i++) {
          const fname = `foto_${String(i + 1).padStart(2, '0')}.jpg`;
          const fpath = path.join(propDir, fname);
          if (!fs.existsSync(fpath)) {
            try {
              const res = await fetch(fotoUrls[i], { headers: { Cookie: cookieStr } });
              if (res.ok) fs.writeFileSync(fpath, Buffer.from(await res.arrayBuffer()));
            } catch {}
          }
        }
      }
      const diskCount2 = fs.readdirSync(propDir).filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f)).length;
      console.log(`  [FOTOS] Após fallback: ${diskCount2} foto(s) no disco`);
    }

  } catch (err) {
    console.log(`  [FOTOS] Erro: ${(err as Error).message}`);
  }
  return fotos;
}

// ─── MONTAR OBJETO DE SAÍDA ────────────────────────────────────────────────
function buildImovel(
  id: string, ref: string, inputs: Record<string, string>,
  fotos: string[], location: Awaited<ReturnType<typeof extractLocation>>
): ImovelData {
  const get = (...names: string[]) => {
    for (const n of names) if (inputs[n] !== undefined && inputs[n] !== '') return inputs[n];
    return '';
  };

  let tipo = get('imo_tipo_label', 'imo_tipo');
  if (tipo.includes('»')) tipo = tipo.split('»')[0].trim();

  return {
    referencia: ref,
    tipo: tipo || 'Apartamento',
    finalidade: get('imo_finalidade_label', 'imo_finalidade', 'imo_cat_label', 'imo_cat') || 'Residencial',
    edificio: location.edificio,
    bairro: location.bairro,
    cidade: location.cidade,
    estado: location.estado,
    rua: location.rua,
    numero_predio: location.numero_predio,
    numero_apartamento: location.numero_apartamento,
    box: location.box,
    detalhes: {
      dormitorios: parseBrInt(get('imo_dorm', 'imo_dormitorios')),
      vagas: parseBrInt(get('imo_vaga')),
      area_m2: parseBrFloat(get('imo_area_privativa', 'imo_area_total', 'imo_area')),
      valor_venda: parseBrFloat(get('imo_vl_venda', 'imo_valor_venda')),
      status: get('imo_situacao_label', 'imo_situacao') || 'ativo',
      no_site: get('imo_site', 'imo_net', 'imo_publicar') === '1' || get('imo_site') === 's' || true,
      ultima_atualizacao: get('imo_dt_atual', 'imo_data_atualizacao', 'imo_ultima_atualizacao') || '',
    },
    proprietario: {
      nome: get('imo_prop_nome', 'imo_proprietario', 'proprietario_nome'),
      telefone: get('imo_prop_tel', 'imo_proprietario_tel', 'proprietario_telefone'),
      vinculo: get('imo_prop_vinculo_label', 'imo_prop_vinculo', 'imo_vinculo') || 'Prop',
    },
    chaves: {
      localizacao: get('imo_chaves', 'imo_chave', 'chaves') || 'Prop',
      observacoes: get('imo_obs', 'imo_observacoes', 'imo_obs_acesso'),
    },
    fotos,
  };
}

// ─── MAIN ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  EXTRATOR COMPLETO - NOVOBROKER → JSON');
  console.log(`  ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════\n');

  ensureDir(DATA_DIR);
  ensureDir(FOTOS_DIR);

  const cp = loadCheckpoint();
  if (cp) {
    console.log(`[CHECKPOINT] ${cp.concluidos.length} concluídos, ${cp.com_erro.length} erros, ${cp.pendentes.length} pendentes\n`);
  }

  const browser: Browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1, isMobile: false, hasTouch: false, javaScriptEnabled: true,
  });
  const page = await context.newPage();

  let listingIds: { id: string; ref: string }[] = [];
  const allResults: ImovelData[] = [];

  try {
    // STEP 1: Login
    if (!await login(page)) { await browser.close(); return; }

    // STEP 2: Navigate to listing
    await navigateToListing(page);

    // STEP 3: List all properties
    listingIds = await listAllProperties(page);

    // Build pending list respecting checkpoint
    let pendentes = listingIds.map(l => l.ref);
    if (cp) {
      const concluidosSet = new Set(cp.concluidos);
      pendentes = pendentes.filter(ref => !concluidosSet.has(ref));
      for (const err of cp.com_erro) {
        if (err.tentativas < 2 && !pendentes.includes(err.referencia)) {
          pendentes.push(err.referencia);
        }
      }
    }

    const newCp: Checkpoint = {
      total_encontrados: listingIds.length,
      ultimo_processado: '',
      concluidos: cp?.concluidos || [],
      com_erro: cp?.com_erro || [],
      pendentes,
    };
    saveCheckpoint(newCp);
    console.log(`\n[INÍCIO] ${pendentes.length} para processar\n`);

    // STEP 4: Process one by one
    for (let idx = 0; idx < pendentes.length; idx++) {
      const ref = pendentes[idx];
      const listing = listingIds.find(l => l.ref === ref);
      if (!listing) { console.log(`[${idx + 1}/${pendentes.length}] ${ref} não encontrado`); continue; }

      console.log(`\n[${idx + 1}/${pendentes.length}] 🏠 Ref ${ref} (ID ${listing.id})`);

      try {
        // Extrair dados textuais
        const inputs = await extractDetailData(page, listing.id);

        // Extrair localização do painel
        const location = await extractLocation(page);

        // Baixar fotos
        const fotos = await downloadPhotos(page, context, listing.id, ref);

        // Montar objeto final
        const imovel = buildImovel(listing.id, ref, inputs, fotos, location);
        allResults.push(imovel);

        // Atualizar checkpoint
        newCp.concluidos.push(ref);
        newCp.ultimo_processado = ref;
        newCp.pendentes = newCp.pendentes.filter(r => r !== ref);
        newCp.com_erro = newCp.com_erro.filter(e => e.referencia !== ref);
        saveCheckpoint(newCp);

        // Salvar parcial a cada 10
        if (newCp.concluidos.length % 10 === 0) {
          fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allResults, null, 2), 'utf-8');
          console.log(`  [CHECKPOINT] ${newCp.concluidos.length} salvos`);
        }

        console.log(`  ✅ OK`);
        await sleep(800);

      } catch (err: any) {
        console.error(`  ❌ ${err.message}`);
        const exist = newCp.com_erro.find(e => e.referencia === ref);
        if (exist) { exist.tentativas++; exist.erro = err.message; }
        else newCp.com_erro.push({ referencia: ref, erro: err.message, tentativas: 1 });
        saveCheckpoint(newCp);
      }

      // Fechar modal se aberto
      try {
        const closeBtn = page.locator('.modal .close, .modal button.close, button:has-text("Fechar")').first();
        if (await closeBtn.isVisible({ timeout: 500 })) await closeBtn.click();
      } catch {}
    }

    // STEP 5: Second pass
    const secondPass = newCp.com_erro.filter(e => e.tentativas < 2);
    if (secondPass.length > 0) {
      console.log(`\n[SEGUNDA TENTATIVA] ${secondPass.length}\n`);
      for (const errItem of secondPass) {
        const listing = listingIds.find(l => l.ref === errItem.referencia);
        if (!listing) continue;
        console.log(`\n[RETRY] ${errItem.referencia}`);
        try {
          const inputs = await extractDetailData(page, listing.id);
          const location = await extractLocation(page);
          const fotos = await downloadPhotos(page, context, listing.id, errItem.referencia);
          const imovel = buildImovel(listing.id, errItem.referencia, inputs, fotos, location);
          allResults.push(imovel);
          newCp.concluidos.push(errItem.referencia);
          newCp.com_erro = newCp.com_erro.filter(e => e.referencia !== errItem.referencia);
          saveCheckpoint(newCp);
          console.log(`  ✅ Segunda tentativa OK`);
          await sleep(800);
        } catch (err2: any) {
          const e = newCp.com_erro.find(x => x.referencia === errItem.referencia);
          if (e) e.tentativas = 2;
          saveCheckpoint(newCp);
          console.error(`  ❌ Falhou novamente: ${err2.message}`);
        }
      }
    }

    // Final save
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allResults, null, 2), 'utf-8');
    const totalFotos = allResults.reduce((s, i) => s + i.fotos.length, 0);

    console.log(`\n═══ FINALIZADO ═══`);
    console.log(`Imóveis: ${allResults.length}`);
    console.log(`Falhas: ${newCp.com_erro.length}`);
    console.log(`Fotos: ${totalFotos}`);
    for (const err of newCp.com_erro) console.log(`  - ${err.referencia}: ${err.erro}`);

    appendRelatorio(`\n=== RELATÓRIO DE MIGRAÇÃO ${new Date().toISOString()} ===`);
    appendRelatorio(`Total extraídos: ${listingIds.length}`);
    appendRelatorio(`Importados: ${allResults.length}`);
    appendRelatorio(`Erros: ${newCp.com_erro.length}`);
    for (const e of newCp.com_erro) appendRelatorio(`  - ${e.referencia}: ${e.erro} (${e.tentativas} tent)`);
    appendRelatorio(`Total fotos baixadas: ${totalFotos}`);

  } catch (err: any) {
    console.error(`\n[FATAL] ${err.message}`);
    appendRelatorio(`ERRO FATAL: ${err.message}`);
  } finally {
    await browser.close();
    console.log('\n═══ EXTRAÇÃO FINALIZADA ═══');
  }
}

main().catch(console.error);
