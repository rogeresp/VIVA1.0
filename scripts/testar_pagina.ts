import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://centromar.novobroker.com.br/broker';
const CREDENTIALS = { email: 'agenciador@centromar.com.br', password: 'centromarimob' };
const ROOT = path.resolve(__dirname, '..');
const FOTOS_DIR = path.join(ROOT, 'fotos');

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1366, height: 768 }, isMobile: false, hasTouch: false,
  });
  const page = await ctx.newPage();

  // Login
  await page.goto(`${BASE_URL}/index.php/login`, { waitUntil: 'networkidle', timeout: 30000 });
  if (page.url().includes('login')) {
    await page.fill('input[name="userlogin"]', CREDENTIALS.email);
    await page.fill('input[name="userpass"]', CREDENTIALS.password);
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForLoadState('networkidle'); await page.waitForTimeout(2000);
  }
  console.log('Login OK\n');

  // Listar primeira página
  await page.goto(`${BASE_URL}/index.php/imovel/imoveis/read/venda/0/?imo_venda=venda&imo_registro=0`,
    { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  const html = await page.content();
  const refs = new Map<string, string>();
  for (const m of html.matchAll(/imo_ref[^>]*>(\d+)<\/strong>/g)) refs.set(m[1], m[1]);
  const listings: { id: string; ref: string }[] = [];
  for (const m of html.matchAll(/update\/(\d+)/g)) {
    const id = m[1];
    if (!listings.find(l => l.id === id)) listings.push({ id, ref: refs.get(id) || id });
  }
  console.log(`Primeira página: ${listings.length} imóveis\n`);

  const resultados: any[] = [];

  for (const item of listings) {
    console.log(`────────────── Ref ${item.ref} (ID ${item.id}) ──────────────`);

    // Navegar para página de detalhe
    await page.goto(`${BASE_URL}/index.php/imovel/imoveis/update/${item.id}`,
      { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    // Extrair TODOS os inputs e selects
    const inputs: Record<string, string> = {};
    for (const el of await page.$$eval('input:not([type="submit"])', els =>
      els.map(e => ({ n: (e as HTMLInputElement).name, v: (e as HTMLInputElement).value }))))
      if (el.n) inputs[el.n] = el.v;

    for (const el of await page.$$eval('select', els =>
      els.map(e => { const s = e as HTMLSelectElement; const o = s.options[s.selectedIndex]; return { n: s.name, v: o?.value || '', t: o?.textContent?.trim() || '' }; })))
      if (el.n) { inputs[el.n] = el.v; inputs[`${el.n}_label`] = el.t; }

    for (const el of await page.$$eval('textarea', els =>
      els.map(e => ({ n: (e as HTMLTextAreaElement).name, v: (e as HTMLTextAreaElement).value }))))
      if (el.n) inputs[el.n] = el.v;

    const get = (...names: string[]) => { for (const n of names) if (inputs[n] !== undefined && inputs[n] !== '') return inputs[n]; return ''; };

    // Extrair ultima_atualizacao do body text
    const bodyText = await page.textContent('body') || '';
    const ultMatch = bodyText.match(/Última\s+atualiza[çc][ãa]o\s+([\d\s\wáéíóúãõâêôà,:]+(?:atrás|horas|minutos|dias|semanas|meses))/i);
    const ultAtual = ultMatch ? ultMatch[1].trim() : '';

    // Fotos do disco
    let fotos: string[] = [];
    const fotosDir = path.join(FOTOS_DIR, item.ref);
    if (fs.existsSync(fotosDir)) {
      fotos = fs.readdirSync(fotosDir)
        .filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
        .filter(f => fs.statSync(path.join(fotosDir, f)).size > 0)
        .sort((a, b) => {
          const na = parseInt(a.match(/\d+/)?.[0] || '0');
          const nb = parseInt(b.match(/\d+/)?.[0] || '0');
          return na - nb;
        })
        .map(f => `fotos/${item.ref}/${f}`);
    }

    const tipo = get('imo_tipo_label', 'imo_tipo');
    const finalidade = get('imo_finalidade_label', 'imo_finalidade', 'imo_cat_label', 'imo_cat');
    const propNome = get('imo_prop_nome', 'imo_proprietario', 'proprietario_nome');
    const propTel = get('imo_prop_tel', 'imo_proprietario_tel', 'proprietario_telefone');
    const dorm = get('imo_dorm', 'imo_dormitorios');
    const vaga = get('imo_vaga');
    const precoV = get('imo_vl_venda', 'imo_valor_venda');
    const compl = get('imo_logr_compl');

    // Parse complemento
    let numeroAp = '', complemento = '';
    if (compl) {
      const boxM = compl.match(/Box\s*:?\s*(\d+)/i);
      const salaM = compl.match(/Sala\s*:?\s*(\d+)/i);
      if (boxM) { complemento = `Box: ${boxM[1]}`; }
      else if (salaM) { complemento = `Sala: ${salaM[1]}`; }
      else if (/^\d+$/.test(compl.trim())) numeroAp = compl.trim();
      else numeroAp = compl.trim();
    }

    const obj = {
      referencia: item.ref,
      tipo_imovel: tipo ? tipo.toUpperCase() : 'APARTAMENTO',
      categoria: finalidade ? finalidade.toUpperCase() : 'RESIDENCIAL',
      dormitorios: dorm ? parseInt(dorm.replace(/[^\d]/g, '')) || null : null,
      vagas: vaga ? parseInt(vaga.replace(/[^\d]/g, '')) || null : null,
      preco_venda: precoV ? parseFloat(precoV.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || null : null,
      edificio_condominio: get('imo_condominio') || null,
      bairro: get('imo_bairro') || null,
      cidade_estado: [get('imo_cidade'), get('imo_estado_label', 'imo_estado')].filter(Boolean).join('/') || null,
      rua: get('imo_logr') || null,
      numero_edificio: get('imo_logr_num') || null,
      numero_ap: numeroAp || null,
      complemento: complemento || null,
      proprietario: propNome || null,
      telefone: propTel || null,
      ultima_atualizacao: ultAtual,
      fotos,
    };

    resultados.push(obj);

    // Mostrar resultado
    console.log(JSON.stringify(obj, null, 2));
    console.log('');

    // Mostrar inputs RAW para debug
    console.log('  [RAW inputs relevantes]:');
    const campos = ['imo_condominio', 'imo_bairro', 'imo_cidade', 'imo_estado', 'imo_estado_label',
      'imo_logr', 'imo_logr_num', 'imo_logr_compl', 'imo_prop_nome', 'imo_prop_tel',
      'imo_tipo_label', 'imo_tipo', 'imo_finalidade_label', 'imo_finalidade', 'imo_cat_label', 'imo_cat',
      'imo_dorm', 'imo_vaga', 'imo_vl_venda', 'imo_dt_atual', 'imo_situacao_label', 'imo_situacao',
      'imo_chaves', 'imo_obs'];
    for (const c of campos) {
      if (inputs[c]) console.log(`    ${c} = ${JSON.stringify(inputs[c])}`);
    }
    console.log('');
  }

  console.log('═══════════ RESUMO ═══════════');
  console.log(JSON.stringify(resultados, null, 2));
  console.log('══════════════════════════════');

  await browser.close();
}
main().catch(console.error);
