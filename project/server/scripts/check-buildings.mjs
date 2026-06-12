import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const buildings = await prisma.building.findMany({
  where: { address: { not: null }, NOT: { address: '' } },
  take: 30,
  select: { id: true, name: true, address: true, street: true, neighborhood: true, city: true },
});

for (const b of buildings) {
  console.log(JSON.stringify(b));
}

await prisma.$disconnect();
