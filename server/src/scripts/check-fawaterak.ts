/**
 * Fawaterak connectivity check — lists the payment methods enabled on the account so you can
 * copy the right IDs into FAWATERAK_METHOD_ID_CARD / _WALLET / _FAWRY. Creates no invoice.
 *
 * Usage (from server/, with FAWATERAK_API_TOKEN + FAWATERAK_BASE_URL set in .env):
 *   npx ts-node src/scripts/check-fawaterak.ts
 */
import 'dotenv/config';
import { env } from '../config/env';
import { getPaymentMethods } from '../lib/fawaterak';

async function main() {
    console.log(`Fawaterak base URL: ${env.FAWATERAK_BASE_URL}`);
    const methods = await getPaymentMethods();
    console.table(methods.map(({ paymentId, name_en, name_ar, redirect }) => ({ paymentId, name_en, name_ar, redirect })));
}

main().catch((err: Error) => { console.error(err.message); process.exit(1); });
