import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function extractNumber(address: string): string | null {
  if (!address) return null;
  const match = address.match(/,\s*(\d[\d\s\/]*)$/);
  if (match) {
    const num = match[1].trim();
    if (/^\d+(\s*\/\s*\d+)?$/.test(num)) return num;
    const digits = num.match(/^\d+/);
    if (digits) return digits[0];
  }
  return null;
}

const buildings = await prisma.building.findMany({
  where: { AND: [{ address: { not: null } }, { NOT: { address: '' } }] },
  select: { id: true, address: true },
});

const updates: { id: string; number: string }[] = [];
for (const b of buildings) {
  const num = extractNumber(b.address!);
  if (num) updates.push({ id: b.id, number: num });
}

// Batch update in chunks of 50
for (let i = 0; i < updates.length; i += 50) {
  const chunk = updates.slice(i, i + 50);
  await Promise.all(chunk.map(u =>
    prisma.building.update({ where: { id: u.id }, data: { number: u.number } })
  ));
}

console.log(`Total: ${buildings.length} buildings, ${updates.length} received numbers.`);
await prisma.$disconnect();
