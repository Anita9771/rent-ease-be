"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const PLANS = [
    {
        name: 'Starter',
        priceMonthly: 49,
        priceYearly: 470,
        unitLimit: 20,
        features: ['Automated invoices', 'Tenant portal', 'Email reminders', 'Basic analytics'],
    },
    {
        name: 'Growth',
        priceMonthly: 129,
        priceYearly: 1238,
        unitLimit: 100,
        features: ['Everything in Starter', 'Custom branding', 'SMS + WhatsApp reminders', 'Advanced reports'],
    },
    {
        name: 'Enterprise',
        priceMonthly: 0,
        priceYearly: 0,
        unitLimit: 9999,
        features: ['Dedicated CSM', 'SLA-backed support', 'BI integrations', 'SAML SSO'],
    },
];
async function main() {
    for (const plan of PLANS) {
        const existing = await prisma.subscriptionPlan.findFirst({ where: { name: plan.name } });
        if (existing) {
            await prisma.subscriptionPlan.update({
                where: { id: existing.id },
                data: {
                    priceMonthly: plan.priceMonthly,
                    priceYearly: plan.priceYearly,
                    unitLimit: plan.unitLimit,
                    features: plan.features,
                },
            });
        }
        else {
            await prisma.subscriptionPlan.create({
                data: {
                    name: plan.name,
                    priceMonthly: plan.priceMonthly,
                    priceYearly: plan.priceYearly,
                    unitLimit: plan.unitLimit,
                    features: plan.features,
                },
            });
        }
    }
    console.log('Subscription plans seeded');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=seed.js.map