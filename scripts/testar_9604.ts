import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

const ROOT = path.resolve(__dirname, '..');
const FOTOS_DIR = path.join(ROOT, 'fotos', '9604');
const REF = '9604';

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
function ensureDir(d: string) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
function clearDir(d: string) { if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) try { fs.unlinkSync(path.join(d, f)); } catch {} }

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  TESTE IMÓVEL 9604 - DOWNLOAD DIRETO');
  console.log('═══════════════════════════════════════════\n');

  ensureDir(FOTOS_DIR);
  clearDir(FOTOS_DIR);

  const browser: Browser = await chromium.launch({ headless: false });
  const context: BrowserContext = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1, isMobile: false, hasTouch: false,
  });
  const page: Page = await context.newPage();

  try {
    // 1. LOGIN
    console.log('[1/4] Login...');
    await page.goto('https://centromar.novobroker.com.br/broker/index.php/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('input[name="userlogin"]', 'agenciador@centromar.com.br');
    await page.fill('input[name="userpass"]', 'centromarimob');
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    console.log('  → OK');

    // 2. PRE-SETUP: register download handler on the context
    console.log('\n[2/4] Configurando download...');
    const downloadUrl = `https://centromar.novobroker.com.br/broker/index.php/imovel/imoveis/downloadfiles/${REF}`;
    console.log(`  → URL: ${downloadUrl}`);

    // Register download listener BEFORE navigating
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

    // Navigate — download may start mid-navigation, that's fine
    try {
      await page.goto(downloadUrl, { waitUntil: 'load', timeout: 60000 });
    } catch (e: any) {
      // Expected if download interrupts navigation
      console.log(`  → Navegação interrompida (esperado): ${e.message?.slice(0, 100)}`);
    }

    console.log('  → Aguardando download...');
    const download = await downloadPromise;
    console.log(`  → Download capturado!`);

    const zipPath = path.join(FOTOS_DIR, `fotos_${REF}.zip`);
    await download.saveAs(zipPath);

    const zipSize = fs.statSync(zipPath).size;
    console.log(`  → ZIP salvo: ${zipPath} (${zipSize} bytes)`);

    if (zipSize === 0) {
      console.log('  ❌ ZIP VAZIO! Nenhuma foto disponível para este imóvel.');
    } else {
      // 3. EXTRACT
      console.log('\n[3/4] Extraindo ZIP...');
      try {
        new AdmZip(zipPath).extractAllTo(FOTOS_DIR, true);
        console.log('  → Extraído com adm-zip');
      } catch {
        try {
          const { execSync } = require('child_process');
          execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${FOTOS_DIR}' -Force"`, { stdio: 'ignore' });
          console.log('  → Extraído com PowerShell');
        } catch {}
      }
      try { fs.unlinkSync(zipPath); } catch {}
    }

    // 4. VERIFY
    console.log('\n[4/4] Verificando arquivos...');
    const files = fs.readdirSync(FOTOS_DIR)
      .filter(f => /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(f))
      .sort();

    console.log(`  → ${files.length} foto(s) extraída(s) no disco`);
    console.log(`     Diretório: ${FOTOS_DIR}`);

    if (files.length > 0) {
      files.forEach((f, i) => {
        const fp = path.join(FOTOS_DIR, f);
        const size = fs.statSync(fp).size;
        console.log(`    ${String(i+1).padStart(2,'0')}. ${fp} (${size} bytes)`);
      });
      console.log('\n  ✅ FOTOS BAIXADAS COM SUCESSO!');
    } else {
      console.log('\n  ❌ NENHUMA FOTO ENCONTRADA');
      // Show any files that were extracted
      const all = fs.readdirSync(FOTOS_DIR);
      if (all.length > 0) {
        console.log('  Conteúdo do diretório:');
        all.forEach(f => console.log(`    - ${f} (${fs.statSync(path.join(FOTOS_DIR, f)).size} bytes)`));
      }
    }

  } catch (err: any) {
    console.error(`\n❌ ERRO: ${err.message}`);
    console.error(err.stack?.slice(0, 500));
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('  Browser continua aberto para inspeção');
  console.log('  Feche manualmente quando terminar');
  console.log('═══════════════════════════════════════════');

  await new Promise(() => {});
}

main().catch(console.error);
