import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

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
interface ImovelFotos {
  referencia: string;
  fotos: string[];
}

function ensureDir(dir: string) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

function loadCheckpoint(): Checkpoint | null {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  } catch {}
  return null;
}
function saveCheckpoint(cp: Checkpoint) {
  ensureDir(DATA_DIR);
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2), 'utf-8');
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
  console.log('  → OK');
  return true;
}

async function baixarZip(context: BrowserContext, ref: string): Promise<{ ok: boolean; fotos: string[] }> {
  const propDir = path.join(FOTOS_DIR, ref);
  ensureDir(propDir);

  const cookies = await context.cookies();
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  const downloadUrl = `${BASE_URL}/index.php/imovel/imoveis/downloadfiles/${ref}`;

  console.log(`  [FETCH] ${downloadUrl}`);
  const response = await fetch(downloadUrl, { headers: { Cookie: cookieHeader } });

  if (!response.ok) {
    console.log(`  → HTTP ${response.status}`);
    return { ok: false, fotos: [] };
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) {
    console.log('  → ZIP vazio');
    return { ok: false, fotos: [] };
  }

  const zipPath = path.join(propDir, `fotos_${ref}.zip`);
  fs.writeFileSync(zipPath, buffer);
  console.log(`  [ZIP] ${buffer.length} bytes`);

  try {
    new AdmZip(zipPath).extractAllTo(propDir, true);
  } catch (e) {
    console.log(`  [ZIP] Erro ao extrair: ${(e as Error).message}`);
    fs.unlinkSync(zipPath);
    return { ok: false, fotos: [] };
  }
  fs.unlinkSync(zipPath);
  console.log('  [ZIP] Extraído');

  let files = fs.readdirSync(propDir).filter(f => /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(f));
  files.sort((a, b) => {
    const na = parseInt(a.match(/\d+/)?.[0] || '0');
    const nb = parseInt(b.match(/\d+/)?.[0] || '0');
    return na - nb;
  });

  const fotos: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const ext = path.extname(files[i]);
    const newName = `foto_${String(i + 1).padStart(2, '0')}${ext}`;
    if (files[i] !== newName) {
      try { fs.renameSync(path.join(propDir, files[i]), path.join(propDir, newName)); } catch {}
    }
    fotos.push(`fotos/${ref}/${newName}`);
  }

  // Remove 0-byte files
  for (const f of fotos) {
    const full = path.join(ROOT, f);
    if (fs.existsSync(full) && fs.statSync(full).size === 0) {
      fs.unlinkSync(full);
    }
  }
  const fotosValidas = fotos.filter(f => {
    const full = path.join(ROOT, f);
    return fs.existsSync(full) && fs.statSync(full).size > 0;
  });

  return { ok: fotosValidas.length > 0, fotos: fotosValidas };
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  DOWNLOAD DE FOTOS VIA FETCH + COOKIES');
  console.log(`  ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════\n');

  let cp = loadCheckpoint();
  if (!cp) {
    console.error('Checkpoint não encontrado em', CHECKPOINT_FILE);
    return;
  }

  // ─── RESTAURAR OS 51 INCORRETAMENTE MARCADOS ───
  const originais = new Set([
    "9604","8430","6866","5","1342","9030","9759","9727","9777","3529",
    "9476","5154","9411","9749","4672","110","914","10240","6010","10543",
    "5750","9950","1221","7405","10542","7316","1344","2978","8636","4133"
  ]);

  const buggy = cp.concluidos.filter(r => !originais.has(r));
  if (buggy.length > 0) {
    console.log(`Removendo ${buggy.length} itens marcados incorretamente como concluídos:`);
    for (const r of buggy) console.log(`  - ${r}`);
    cp.concluidos = cp.concluidos.filter(r => originais.has(r));
    for (const r of buggy) {
      if (!cp.pendentes.includes(r)) cp.pendentes.push(r);
    }
    cp.com_erro = [];
    cp.ultimo_processado = cp.concluidos[cp.concluidos.length - 1] || '';
    saveCheckpoint(cp);
    console.log(`\nCheckpoint restaurado:`);
    console.log(`  Concluídos (reais): ${cp.concluidos.length}`);
    console.log(`  Pendentes: ${cp.pendentes.length}`);
    console.log('');
  } else {
    console.log('Nenhum item incorreto encontrado.');
  }

  const browser: Browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    isMobile: false, hasTouch: false, javaScriptEnabled: true,
  });
  const page = await context.newPage();

  try {
    if (!await login(page)) { await browser.close(); return; }

    const pendentes = [...cp.pendentes];
    const imoveisFotos: ImovelFotos[] = [];

    for (let idx = 0; idx < pendentes.length; idx++) {
      const ref = pendentes[idx];
      console.log(`\n[${idx + 1}/${pendentes.length}] Ref ${ref}`);

      const result = await baixarZip(context, ref);

      if (result.ok) {
        console.log(`  ✅ ${result.fotos.length} foto(s)`);
      } else {
        console.log(`  ✅ Sem fotos (array vazio)`);
      }

      imoveisFotos.push({ referencia: ref, fotos: result.fotos });

      cp.concluidos.push(ref);
      cp.ultimo_processado = ref;
      cp.pendentes = cp.pendentes.filter(r => r !== ref);
      saveCheckpoint(cp);

      // Salva dados parciais das fotos a cada 10
      if (imoveisFotos.length % 10 === 0) {
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(imoveisFotos, null, 2), 'utf-8');
        console.log(`  [CHECKPOINT] ${cp.concluidos.length} concluídos`);
      }
    }

    // Save final
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(imoveisFotos, null, 2), 'utf-8');

    const totalComFotos = imoveisFotos.filter(i => i.fotos.length > 0).length;
    const totalFotos = imoveisFotos.reduce((s, i) => s + i.fotos.length, 0);

    console.log(`\n═══════════════════════════════════════════`);
    console.log(`  FINALIZADO`);
    console.log(`  Concluídos: ${cp.concluidos.length}`);
    console.log(`  Com fotos: ${totalComFotos}`);
    console.log(`  Sem fotos: ${imoveisFotos.length - totalComFotos}`);
    console.log(`  Total de fotos: ${totalFotos}`);
    console.log(`  Erros: ${cp.com_erro.length}`);
    console.log(`═══════════════════════════════════════════`);
  } catch (err: any) {
    console.error(`\n[FATAL] ${err.message}`);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
