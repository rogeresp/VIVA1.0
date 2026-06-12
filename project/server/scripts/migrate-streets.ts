import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function extractStreet(address: string): string {
  if (!address) return '';

  const parts = address.split(',').map(s => s.trim()).filter(Boolean);

  if (parts.length === 0) return address;

  const last = parts[parts.length - 1];
  const isNumber = /^[\d\s]+$/.test(last) || /^s\/n$/i.test(last) || /^sn$/i.test(last);

  if (isNumber && parts.length >= 2) {
    return parts[parts.length - 2];
  }

  if (/^\d/.test(last) && parts.length >= 2) {
    const match = address.match(/^(.+),\s*\d/);
    if (match) return match[1].trim();
    return parts[parts.length - 2];
  }

  const nonLocParts = parts.filter(p =>
    !/^(centro|zona\s+\w+|bairro|\w+\s*-\s*\w+\/\w+)$/i.test(p)
  );
  if (nonLocParts.length > 0) return nonLocParts[0];

  return parts[0] || address;
}

const buildings = await prisma.building.findMany({
  where: { AND: [{ address: { not: null } }, { NOT: { address: '' } }] },
  select: { id: true, name: true, address: true, street: true },
});

let updated = 0;
for (const b of buildings) {
  const street = extractStreet(b.address!);
  if (street && street !== b.street) {
    await prisma.building.update({
      where: { id: b.id },
      data: { street },
    });
    updated++;
    if (updated <= 10) {
      console.log(`  OK ${b.name}: "${b.address}" -> street="${street}"`);
    }
  }
}

console.log(`\nTotal: ${buildings.length} buildings, ${updated} updated.`);

const stillNull = await prisma.building.findMany({
  where: { OR: [{ street: null }, { street: '' }] },
  take: 10,
  select: { id: true, name: true, address: true },
});
if (stillNull.length > 0) {
  console.log(`\nWithout street: ${stillNull.length}`);
  for (const b of stillNull) {
    console.log(`  MISS ${b.name}: "${b.address}"`);
  }
} else {
  console.log('All buildings now have street filled!');
}

await prisma.$disconnect();
