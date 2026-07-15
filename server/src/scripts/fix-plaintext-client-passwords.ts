/**
 * Remediation: hash client passwords that were carried over from fitforce.io as
 * plaintext (old system's `Client.password` column was never hashed, unlike `User`).
 *
 * Recovers the client's real password by bcrypt-hashing the existing plaintext value
 * in place (same cost factor as the rest of the app). Rows that look like corrupted
 * data rather than a real password (16-char hex fragments, or password === email) are
 * left untouched and reported so they can be handled via a manual password reset.
 *
 * Usage (from server/):
 *   DATABASE_URL="<same as server/.env>" npx tsx src/scripts/fix-plaintext-client-passwords.ts
 *
 * Idempotent — already-bcrypt rows are excluded by the WHERE clause, safe to re-run.
 */

import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BCRYPT_FORMAT = /^\$2[aby]\$\d{2}\$/;
const HEX_FRAGMENT   = /^[0-9a-f]{16}$/i;

function log(msg: string) { console.log(`[fix-plaintext-client-passwords] ${msg}`); }

async function main() {
  const candidates = await prisma.clients.findMany({
    where: { password: { not: null } },
    select: { id: true, email: true, password: true, workspace_id: true },
  });

  const broken = candidates.filter(c => c.password && !BCRYPT_FORMAT.test(c.password));
  log(`found ${broken.length} clients with a non-bcrypt password`);

  const needsReset: typeof broken = [];
  let hashed = 0;

  for (const client of broken) {
    const plain = client.password!;
    const looksLikeEmail = client.email && plain.toLowerCase() === client.email.toLowerCase();

    if (HEX_FRAGMENT.test(plain) || looksLikeEmail) {
      needsReset.push(client);
      continue;
    }

    const hash = await bcrypt.hash(plain, 10);
    await prisma.clients.update({ where: { id: client.id }, data: { password: hash } });
    hashed += 1;
  }

  log(`hashed ${hashed} recoverable plaintext passwords`);
  log(`${needsReset.length} rows need a manual password reset (corrupted/unrecoverable):`);
  for (const c of needsReset) {
    log(`  - ${c.id}  workspace=${c.workspace_id}  email=${c.email}`);
  }
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
