import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
try {
  const allExchanges = await p.exchange.findMany({ take: 5, select: { id: true, userId: true, assetType: true, assetName: true } });
  console.log('Exchanges:', JSON.stringify(allExchanges));
  const oldUserCount = await p.exchange.count({ where: { userId: 'user-centromar' } });
  const newUserCount = await p.exchange.count({ where: { userId: 'rogerespindula_gmail_com' } });
  console.log('Exchanges with user-centromar:', oldUserCount);
  console.log('Exchanges with rogerespindula:', newUserCount);
  const allUserIds = await p.exchange.groupBy({ by: ['userId'], _count: true });
  console.log('All userIds in exchanges:', JSON.stringify(allUserIds));
} finally {
  await p.$disconnect();
}
