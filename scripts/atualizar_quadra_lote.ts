import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface CasaCondominioData {
  ref: string;
  tipo: string;
  quadra: string;
  lote: string;
  numero_ap: string;
  complemento: string;
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  ATUALIZAR QUADRA E LOTE NO BANCO');
  console.log('═══════════════════════════════════════════\n');

  const dataPath = path.resolve(__dirname, '..', 'data', 'casas_condominios.json');
  if (!fs.existsSync(dataPath)) {
    console.error(`Arquivo não encontrado: ${dataPath}`);
    console.error('Execute primeiro: npx tsx scripts/extrair_casas_condominios.ts');
    process.exit(1);
  }

  const data: CasaCondominioData[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  console.log(`Carregados ${data.length} registros\n`);

  let updated = 0;
  let notFound = 0;
  let skipped = 0;

  for (const item of data) {
    const { ref, quadra, lote } = item;

    // Check if property exists by code
    const property = await prisma.property.findUnique({ where: { code: ref } });

    if (!property) {
      console.log(`  - Ref ${ref}: não encontrado no banco`);
      notFound++;
      continue;
    }

    // Only update if there's actual quadra/lote data
    if (!quadra && !lote) {
      skipped++;
      continue;
    }

    await prisma.property.update({
      where: { code: ref },
      data: {
        quadra: quadra || null,
        lote: lote || null,
      },
    });

    console.log(`  ✓ Ref ${ref}: Q="${quadra || '-'}" L="${lote || '-'}"`);
    updated++;
  }

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  Atualizados: ${updated}`);
  console.log(`  Não encontrados: ${notFound}`);
  console.log(`  Sem quadra/lote: ${skipped}`);
  console.log(`═══════════════════════════════════════════`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
