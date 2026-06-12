import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const buildings = await prisma.building.findMany({
  take: 20,
  orderBy: { street: 'asc' },
  select: { id: true, name: true, address: true, street: true },
});

for (const b of buildings) {
  console.log(`${b.name}: addr="${b.address}" street="${b.street}"`);
}

const total = await prisma.building.count();
const nonMatching = await prisma.building.count({ where: { NOT: { street: { startsWith: 'Rua' } }, NOT: { street: { startsWith: 'Av' } }, NOT: { street: { startsWith: 'Travessa' } } } });
console.log(`\nTotal: ${total}`);
await prisma.$disconnect();
