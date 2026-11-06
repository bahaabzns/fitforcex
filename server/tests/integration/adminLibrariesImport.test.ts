import jwt from 'jsonwebtoken';
import { request } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';

const adminCookie = () => `admin_token=${jwt.sign({ isAdmin: true, id: 'test-admin' }, process.env.ADMIN_JWT_SECRET!, { expiresIn: '1h' })}`;
const food = (name: string) => ({ name_en: name, name_ar: 'x', food_category: 'Protein', serving_size: 100, serving_unit: 'g', calories_per_serving: 100, protein_per_serving: 10, carbs_per_serving: 5, fats_per_serving: 2 });

describe('Admin Default Libraries import', () => {
    beforeEach(async () => { await testPrisma.master_food_items.deleteMany(); });
    afterAll(async () => { await testPrisma.master_food_items.deleteMany(); });

    function importFoods(records: unknown[]) {
        return request.post('/api/admin/libraries/food-items/import').set('Cookie', adminCookie()).send({ records });
    }

    it('imports food items once and skips names that already exist on a second import', async () => {
        const records = [food('Import Test Chicken'), food('Import Test Rice')];

        const first = await importFoods(records);
        const second = await importFoods(records);

        expect(first.body).toMatchObject({ imported: 2, skipped: 0 });
        expect(second.body).toMatchObject({ imported: 0, skipped: 2 });
        expect(await testPrisma.master_food_items.count()).toBe(2);
    });

    it('ignores case and repeated names inside the same file', async () => {
        const result = await importFoods([food('Import Test Egg'), food('import test egg'), food('Import Test Milk')]);

        expect(result.body).toMatchObject({ imported: 2, skipped: 1 });
    });
});
