import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function extractNumber(address: string): string | null {
  if (!address) return null;

  // Try patterns like "Street, 123", "Street, 123 apto 4", "Street, 1234"
  const match = address.match(/,\s*(\d[\d\s\/]*)$/);
  if (match) {
    const num = match[1].trim();
    if (/^\d+(\s*\/\s*\d+)?$/.test(num)) return num;
    // Extract just the digits
    const digits = num.match(/^\d+/);
    if (digits) return digits[0];
  }

  return null;
}

const buildings = await prisma.building.findMany({
  where: { AND: [{ address: { not: null } }, { NOT: { address: '' } }] },
  select: { id: true, name: true, address: true, number: true },
});

let updated = 0;
for (const b of buildings) {
  const num = extractNumber(b.address!);
  if (num) {
    await prisma.building.update({
      where: { id: b.id },
      data: { number: num },
    });
    updated++;
    if (updated <= 10) {
      console.log(`  OK ${b.name}: "${b.address}" -> number="${num}"`);
    }
  }
}

console.log(`\nTotal: ${buildings.length} buildings, ${updated} with extracted number.`);

await prisma.$disconnect();
