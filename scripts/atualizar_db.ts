import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface Item {
  ref: string;
  quadra: string;
  lote: string;
}

async function main() {
  const dataPath = path.resolve(__dirname, '..', 'data', 'casas_condominios.json');
  const data: Item[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  const comQuadra = data.filter(r => r.quadra || r.lote);
  console.log(`Total: ${comQuadra.length} com quadra/lote\n`);

  let updated = 0, notFound = 0;

  for (const item of comQuadra) {
    const prop = await prisma.property.findUnique({ where: { code: item.ref } });
    if (!prop) {
      console.log(`  - Ref ${item.ref}: não encontrado`);
      notFound++;
      continue;
    }
    await prisma.property.update({
      where: { code: item.ref },
      data: { quadra: item.quadra || null, lote: item.lote || null },
    });
    console.log(`  ✓ Ref ${item.ref} → Q:${item.quadra} L:${item.lote}`);
    updated++;
  }

  console.log(`\n${updated} atualizados, ${notFound} não encontrados`);
  await prisma.$disconnect();
}

main().catch(console.error);
