import { test as base, type BrowserContext, type Page } from '@playwright/test';
import { MongoClient } from 'mongodb';

const MONGODB_URL = process.env.MONGODB_URL ?? 'mongodb://localhost:27017';
const TEST_DATABASE = 'prismo_e2e';

async function resetDatabase(): Promise<void> {
    const client = new MongoClient(MONGODB_URL);
    try {
        await client.connect();
        await client.db(TEST_DATABASE).dropDatabase();
    } finally {
        await client.close();
    }
}

export const test = base.extend<{ ctx: BrowserContext; page: Page }>({
    ctx: async ({ browser }, use) => {
        await resetDatabase();
        const context = await browser.newContext();
        await use(context);
        await context.close();
    },
    page: async ({ ctx }, use) => {
        const page = await ctx.newPage();
        await use(page);
        await page.close();
    }
});

export { expect } from '@playwright/test';
