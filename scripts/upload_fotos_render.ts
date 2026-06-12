import fs from 'fs';
import path from 'path';

const API_URL = 'https://viva1-0-1.onrender.com/api';
const JSON_FILE = path.resolve('data/imoveis_exportados.json');
const FOTOS_DIR = path.resolve('fotos');
const CONCURRENCY = 3;

interface Imovel {
  referencia: string;
  fotos: string[];
  [key: string]: any;
}

async function uploadPropertyPhotos(code: string): Promise<number> {
  const fotoDir = path.join(FOTOS_DIR, code);
  if (!fs.existsSync(fotoDir)) return 0;

  const files = fs.readdirSync(fotoDir)
    .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
    .sort();

  if (files.length === 0) return 0;

  const formData = new FormData();
  formData.append('code', code);

  for (const file of files) {
    const filePath = path.join(fotoDir, file);
    const buffer = fs.readFileSync(filePath);
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    formData.append('photos', blob, file);
  }

  const res = await fetch(`${API_URL}/upload-photos`, {
    method: 'POST',
    body: formData,
    headers: {
      'x-user-id': 'user-centromar',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  }

  const result = await res.json();
  return result.total || result.urls?.length || 0;
}

async function main() {
  if (!fs.existsSync(JSON_FILE)) {
    console.error(`ERRO: ${JSON_FILE} não encontrado`);
    process.exit(1);
  }

  const imoveis: Imovel[] = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));
  console.log(`📄 ${imoveis.length} imóveis carregados\n`);

  const withFotos = imoveis.filter(i => i.fotos && i.fotos.length > 0);
  console.log(`📸 ${withFotos.length} imóveis com fotos\n`);

  if (withFotos.length === 0) {
    console.log('Nenhum imóvel com fotos para enviar.');
    return;
  }

  let totalUploaded = 0;
  let completed = 0;
  let errors = 0;
  const total = withFotos.length;

  for (let i = 0; i < total; i += CONCURRENCY) {
    const batch = withFotos.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (imovel) => {
        const count = await uploadPropertyPhotos(imovel.referencia);
        return { ref: imovel.referencia, count };
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        totalUploaded += r.value.count;
        completed++;
        process.stdout.write(`\r[${completed}/${total}] ${r.value.ref} → ${r.value.count} fotos ✅`);
      } else {
        errors++;
        process.stdout.write(`\r[${completed + errors}/${total}] ❌ ${r.reason?.message?.slice(0, 60) || 'erro'}`);
      }
    }
  }

  console.log('\n\n' + '='.repeat(50));
  console.log('  RESUMO DO UPLOAD');
  console.log('='.repeat(50));
  console.log(`  Imóveis com fotos: ${total}`);
  console.log(`  Completos:         ${completed}`);
  console.log(`  Erros:             ${errors}`);
  console.log(`  Total fotos env.:  ${totalUploaded}`);
  console.log('='.repeat(50));
  console.log('\nAgora execute: npx tsx scripts/importar_render.ts');
}

main().catch(console.error);
