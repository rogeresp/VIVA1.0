import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

const ROOT = path.resolve(__dirname, '..');
const FOTOS_DIR = path.join(ROOT, 'fotos');
const CHECKPOINT_PATH = path.join(ROOT, 'data', 'checkpoint.json');
const BASE_URL = 'https://centromar.novobroker.com.br/broker';

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
function ensureDir(d: string) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

function loadCheckpoint(): any {
  return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf-8'));
}

function saveCheckpoint(cp: any): void {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp, null, 2), 'utf-8');
}

async function downloadFotos(page: Page, context: BrowserContext, ref: string): Promise<number> {
  const propDir = path.join(FOTOS_DIR, ref);
  ensureDir(propDir);

  const downloadUrl = `${BASE_URL}/index.php/imovel/imoveis/downloadfiles/${ref}`;

  console.log(`  [${ref}] URL: ${downloadUrl}`);

  const downloadPromise = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);

  try {
    await page.goto(downloadUrl, { waitUntil: 'load', timeout: 60000 });
  } catch (e: any) {
    console.log(`  [${ref}] Navegação interrompida (esperado): ${e.message?.slice(0, 100)}`);
  }

  console.log(`  [${ref}] Aguardando download...`);
  const download = await downloadPromise;

  if (!download) {
    console.log(`  [${ref}] Nenhum download disparado - sem fotos`);
    return 0;
  }

  const zipPath = path.join(propDir, `fotos_${ref}.zip`);
  await download.saveAs(zipPath);

  const zipSize = fs.statSync(zipPath).size;
  console.log(`  [${ref}] ZIP salvo (${zipSize} bytes)`);

  if (zipSize === 0) {
    try { fs.unlinkSync(zipPath); } catch {}
    console.log(`  [${ref}] ZIP vazio - sem fotos`);
    return 0;
  }

  try {
    new AdmZip(zipPath).extractAllTo(propDir, true);
    console.log(`  [${ref}] Extraído com adm-zip`);
  } catch {
    try {
      const { execSync } = require('child_process');
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${propDir}' -Force"`, { stdio: 'ignore' });
      console.log(`  [${ref}] Extraído com PowerShell`);
    } catch {}
  }

  try { fs.unlinkSync(zipPath); } catch {}

  const files = fs.readdirSync(propDir)
    .filter(f => /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(f))
    .sort();

  // Renomear para padrão sequencial
  if (files.length > 0) {
    for (let i = 0; i < files.length; i++) {
      const ext = path.extname(files[i]);
      const newName = `foto_${String(i + 1).padStart(2, '0')}${ext}`;
      if (files[i] !== newName) {
        try {
          fs.renameSync(path.join(propDir, files[i]), path.join(propDir, newName));
        } catch {}
      }
    }
  }

  console.log(`  [${ref}] ${files.length} foto(s) salva(s)`);
  return files.length;
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  RETOMAR DOWNLOAD DE FOTOS');
  console.log('═══════════════════════════════════════════\n');

  const cp = loadCheckpoint();
  console.log(`Total: ${cp.total_encontrados}`);
  console.log(`Já concluídos: ${cp.concluidos.length}`);
  console.log(`Com erro: ${cp.com_erro.length}`);
  console.log(`Pendentes: ${cp.pendentes.length}`);
  console.log(`Último processado: ${cp.ultimo_processado}\n`);

  if (cp.pendentes.length === 0) {
    console.log('✅ Nenhum pendente para processar!');
    return;
  }

  console.log('Iniciando browser...\n');

  const browser: Browser = await chromium.launch({ headless: false });
  const context: BrowserContext = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1, isMobile: false, hasTouch: false,
  });
  const page: Page = await context.newPage();

  try {
    // LOGIN
    console.log('[LOGIN] Entrando...');
    await page.goto(`${BASE_URL}/index.php/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('input[name="userlogin"]', 'agenciador@centromar.com.br');
    await page.fill('input[name="userpass"]', 'centromarimob');
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    console.log('[LOGIN] OK\n');

    const pendentes = [...cp.pendentes];
    let processados = 0;
    const total = pendentes.length;

    for (const ref of pendentes) {
      processados++;
      console.log(`[${processados}/${total}] Processando ref ${ref}...`);

      try {
        const qtd = await downloadFotos(page, context, ref);

        // Atualiza checkpoint
        cp.concluidos.push(ref);
        cp.pendentes = cp.pendentes.filter((p: string) => p !== ref);
        cp.ultimo_processado = ref;
        saveCheckpoint(cp);

        console.log(`  ✅ Ref ${ref} concluído (${qtd} fotos)\n`);

        // Se não tinha fotos e diretório vazio, sinalizar
        if (qtd === 0) {
          console.log(`  ℹ️  Ref ${ref} registrado como concluído (0 fotos)\n`);
        }

      } catch (err: any) {
        console.log(`  ❌ Erro em ${ref}: ${err.message}\n`);

        // Move para erro e salva checkpoint
        cp.com_erro.push(ref);
        cp.pendentes = cp.pendentes.filter((p: string) => p !== ref);
        cp.ultimo_processado = ref;
        saveCheckpoint(cp);
      }

      // Pequena pausa entre requisições
      await sleep(1000);
    }

    console.log('═══════════════════════════════════════════');
    console.log('  PROCESSAMENTO CONCLUÍDO!');
    console.log(`  Concluídos: ${cp.concluidos.length}`);
    console.log(`  Erro: ${cp.com_erro.length}`);
    console.log(`  Pendentes: ${cp.pendentes.length}`);
    console.log('═══════════════════════════════════════════');

  } catch (err: any) {
    console.error(`\n❌ ERRO FATAL: ${err.message}`);
    console.error(err.stack?.slice(0, 500));
  }

  console.log('\nBrowser continua aberto. Feche manualmente quando terminar.');
  await new Promise(() => {});
}

main().catch(console.error);
