/**
 * Seed demo clients into a workspace.
 *
 * Inserts N clients with realistic names, unique per-workspace client codes,
 * unique emails, and a phone. No subscriptions/transactions are created — these
 * are bare client records (status resolves to "No Subscriptions" in the UI).
 *
 * Usage (from server/):
 *   npx dotenv -e .env -- npx tsx src/scripts/seed-clients.ts [slug] [count]
 *   npx dotenv -e .env -- npx tsx src/scripts/seed-clients.ts bahaa-bzns 100
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SLUG = process.argv[2] || 'bahaa-bzns';
const COUNT = Number(process.argv[3] || 100);

const FIRST_NAMES = [
    'Ahmed', 'Mohamed', 'Mahmoud', 'Omar', 'Ali', 'Hassan', 'Khaled', 'Youssef', 'Mostafa', 'Tarek',
    'Karim', 'Amr', 'Sherif', 'Hossam', 'Tamer', 'Walid', 'Sami', 'Nader', 'Fady', 'Bahaa',
    'Sara', 'Mona', 'Nour', 'Hana', 'Laila', 'Salma', 'Mariam', 'Yasmin', 'Dina', 'Rana',
    'Heba', 'Aya', 'Nada', 'Reem', 'Farida', 'Malak', 'Habiba', 'Jana', 'Lina', 'Rania',
];
const LAST_NAMES = [
    'Hassan', 'Ibrahim', 'Mahmoud', 'Said', 'Fathy', 'Mansour', 'Gamal', 'Saad', 'Adel', 'Naguib',
    'Sabry', 'Lotfy', 'Zaki', 'Shawky', 'Ramadan', 'Fawzy', 'Hamdy', 'Abdel Aziz', 'El Sayed', 'Kamal',
    'Nasser', 'Refaat', 'Sorour', 'Sami', 'Helmy', 'Badr', 'Salem', 'Younes', 'Darwish', 'Anwar',
];
const COUNTRY_CODES = ['+20', '+966', '+971', '+965', '+974'];

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
    if (!COUNT || COUNT < 1) throw new Error(`Invalid count: ${process.argv[3]}`);

    const workspace = await prisma.workspaces.findUnique({
        where: { slug: SLUG },
        select: { id: true, name: true },
    });
    if (!workspace) throw new Error(`Workspace "${SLUG}" not found`);

    // Load existing codes/emails so generated values never collide with current data.
    const existing = await prisma.clients.findMany({
        where: { workspace_id: workspace.id },
        select: { client_code: true, email: true },
    });
    const usedCodes = new Set(existing.map(c => c.client_code));
    const usedEmails = new Set(existing.map(c => c.email.toLowerCase()));

    // Shared demo password — fine for seed data, never for real accounts.
    const password = await bcrypt.hash('Password123!', 10);

    const rows: Prisma.clientsCreateManyInput[] = [];
    for (let i = 0; i < COUNT; i++) {
        const fname = pick(FIRST_NAMES);
        const lname = pick(LAST_NAMES);

        let code = Math.floor(Math.random() * 9999) + 1;
        while (usedCodes.has(code)) code = Math.floor(Math.random() * 9999) + 1;
        usedCodes.add(code);

        let suffix = 0;
        let email = `${fname}.${lname}.${code}@example.com`.toLowerCase().replace(/\s+/g, '');
        while (usedEmails.has(email)) {
            suffix++;
            email = `${fname}.${lname}.${code}-${suffix}@example.com`.toLowerCase().replace(/\s+/g, '');
        }
        usedEmails.add(email);

        const countryCode = pick(COUNTRY_CODES);
        const number = String(Math.floor(1000000000 + Math.random() * 8999999999)).slice(0, 10);
        const phones = [{ countryCode, number }];

        rows.push({
            id: createId(),
            client_code: code,
            fname,
            lname,
            email,
            phone: `${countryCode} ${number}`,
            phones: phones as unknown as Prisma.InputJsonValue,
            subscription_status: 'No Subscriptions',
            workspace_id: workspace.id,
            password,
            // Spread created dates over the past year so the table sorts naturally.
            created_at: new Date(Date.now() - Math.floor(Math.random() * 365) * 86_400_000),
        });
    }

    const result = await prisma.clients.createMany({ data: rows, skipDuplicates: true });
    console.log(`Seeded ${result.count} clients into "${workspace.name}" (${SLUG}).`);
}

main()
    .catch(err => { console.error(err); process.exit(1); })
    .finally(() => prisma.$disconnect());
