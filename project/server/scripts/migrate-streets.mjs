import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function extractStreet(address: string): string {
  if (!address) return '';

  // Split by comma, trim each part
  const parts = address.split(',').map(s => s.trim()).filter(Boolean);

  if (parts.length === 0) return address;

  // Check if the last part is a number (possibly with "s/n", "sn" etc.)
  const last = parts[parts.length - 1];
  const isNumber = /^[\d\s]+$/.test(last) || /^s\/n$/i.test(last) || /^sn$/i.test(last);

  if (isNumber && parts.length >= 2) {
    // Street is the second-to-last part
    return parts[parts.length - 2];
  }

  // If last part starts with a digit but has other text, still treat second-to-last as street
  if (/^\d/.test(last) && parts.length >= 2) {
    // Check if there's a pattern like "Street, 123" in the last part
    const match = address.match(/^(.+),\s*\d/);
    if (match) {
      return match[1].trim();
    }
    return parts[parts.length - 2];
  }

  // If no number pattern found, return the last part (or whole if only one part)
  // But filter out parts that look like neighborhood/city prefixes
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
      console.log(`  ✓ ${b.name}: "${b.address}" → street="${street}"`);
    }
  }
}

console.log(`\nTotal: ${buildings.length} buildings, ${updated} updated with street.`);

// Show some examples that weren't extracted well
const stillNull = await prisma.building.findMany({
  where: { OR: [{ street: null }, { street: '' }] },
  take: 10,
  select: { id: true, name: true, address: true },
});
if (stillNull.length > 0) {
  console.log(`\nBuildings still without street: ${stillNull.length}`);
  for (const b of stillNull) {
    console.log(`  ✗ ${b.name}: "${b.address}"`);
  }
}

await prisma.$disconnect();
