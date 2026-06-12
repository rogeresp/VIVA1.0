import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const total = await prisma.building.count();
const withAddr = await prisma.building.count({ where: { AND: [{ address: { not: null } }, { NOT: { address: '' } }] } });
const withoutStreet = await prisma.building.count({ where: { AND: [{ street: null }, { address: { not: null } }, { NOT: { address: '' } }] } });
console.log(JSON.stringify({ total, withAddress: withAddr, canExtractStreet: withoutStreet }));
await prisma.$disconnect();
