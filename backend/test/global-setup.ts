// e2e: the subscription plans a new company is put on. Signup starts a
// trial on DEFAULT_TRIAL_PLAN_SLUG ('starter'); without the plan the trial
// fails and every plan-limit check after it answers "not found".
import { PrismaClient } from '@prisma/client';

export default async function globalSetup() {
  const prisma = new PrismaClient();
  try {
    const plans = [
      { slug: process.env.DEFAULT_TRIAL_PLAN_SLUG || 'starter', name: 'Starter', sortOrder: 0 },
      { slug: 'pro', name: 'Pro', sortOrder: 1 },
    ];
    for (const p of plans) {
      await prisma.subscriptionPlan.upsert({
        where: { slug: p.slug },
        update: {},
        create: { ...p, priceMonthly: 0, maxOutlets: 50, maxUsers: 100, maxPosDevices: 50, features: {} },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}
