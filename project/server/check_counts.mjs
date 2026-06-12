import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
try {
  const [props, owners, clients, buildings, exchanges] = await Promise.all([
    p.property.count(),
    p.owner.count(),
    p.client.count(),
    p.building.count(),
    p.exchange.count(),
  ]);
  console.log('Properties:', props);
  console.log('Owners:', owners);
  console.log('Clients:', clients);
  console.log('Buildings:', buildings);
  console.log('Exchanges:', exchanges);
} finally {
  await p.$disconnect();
}
