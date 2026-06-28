/**
 * Seed a super-admin account.
 * Run with: npx ts-node -r tsconfig-paths/register prisma/seedAdmin.ts
 *
 * Credentials can be overridden with env vars:
 *   ADMIN_EMAIL    (default: admin@fitforce.app)
 *   ADMIN_PASSWORD (default: Admin@123)
 *   ADMIN_FNAME    (default: Super)
 *   ADMIN_LNAME    (default: Admin)
 */
import { PrismaClient } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const EMAIL    = process.env.ADMIN_EMAIL    ?? 'admin@fitforce.app';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin@123';
const FNAME    = process.env.ADMIN_FNAME    ?? 'Super';
const LNAME    = process.env.ADMIN_LNAME    ?? 'Admin';

async function main() {
    const hashed = await bcrypt.hash(PASSWORD, 12);

    const existing = await prisma.admins.findFirst({ where: { email: EMAIL } });

    if (existing) {
        await prisma.admins.update({
            where: { id: existing.id },
            data:  { password: hashed, fname: FNAME, lname: LNAME },
        });
        console.log(`Admin updated: ${EMAIL}`);
    } else {
        await prisma.admins.create({
            data: { id: createId(), email: EMAIL, password: hashed, fname: FNAME, lname: LNAME },
        });
        console.log(`Admin created: ${EMAIL}`);
    }
}

main()
    .catch((err) => { console.error(err); process.exit(1); })
    .finally(() => prisma.$disconnect());
