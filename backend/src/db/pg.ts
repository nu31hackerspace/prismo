import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped call sites across the db layer rely on this defaulting to `any`
export async function query<T extends pg.QueryResultRow = any>(text: string, values?: unknown[]): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, values);
}

export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export { pool };
