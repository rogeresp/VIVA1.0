import { chromium } from 'playwright';
const BASE_URL = 'https://centromar.novobroker.com.br/broker';
const CREDENTIALS = { email: 'agenciador@centromar.com.br', password: 'centromarimob' };

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto(`${BASE_URL}/index.php/login`, { waitUntil: 'networkidle', timeout: 30000 });
  if (page.url().includes('login')) {
    await page.fill('input[name="userlogin"]', CREDENTIALS.email);
    await page.fill('input[name="userpass"]', CREDENTIALS.password);
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForLoadState('networkidle'); await page.waitForTimeout(2000);
  }
  console.log('Login OK');

  await page.goto(`${BASE_URL}/index.php/imovel/imoveis/update/9604`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  const inputs: Record<string, string> = {};
  for (const el of await page.$$eval('input:not([type="submit"])', els =>
    els.map(e => ({ n: (e as HTMLInputElement).name, v: (e as HTMLInputElement).value }))))
    if (el.n) inputs[el.n] = el.v;
  for (const el of await page.$$eval('select', els =>
    els.map(e => { const s = e as HTMLSelectElement; const o = s.options[s.selectedIndex]; return { n: s.name, v: s.value, t: o?.textContent?.trim() || '' }; })))
    if (el.n) { inputs[el.n] = el.v; inputs[`${el.n}_label`] = el.t; }
  for (const el of await page.$$eval('textarea', els =>
    els.map(e => ({ n: (e as HTMLTextAreaElement).name, v: (e as HTMLTextAreaElement).value }))))
    if (el.n) inputs[el.n] = el.v;

  // Mostrar TODOS os campos
  const keys = Object.keys(inputs).sort();
  for (const k of keys) {
    console.log(`${k} = ${JSON.stringify(inputs[k])}`);
  }

  // Procurar por termos no body
  const body = await page.textContent('body') || '';
  const termoMatch = body.match(/[Tt]ermo|[Cc]ondição|[Cc]ondicao|[Pp]agamento|[Ff]orma\s*de\s*[Pp]agto|[Ee]ntrada|[Pp]arcelas?/g);
  if (termoMatch) console.log('\nTermos encontrados no body:', [...new Set(termoMatch)]);

  await browser.close();
}
main().catch(console.error);
