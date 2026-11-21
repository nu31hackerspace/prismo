/**
 * Signed-in session for the test-stand suite, without going through Google.
 *
 * The app's session is a JWT (`{ userId }`, HS256, signed with the backend's
 * SESSION_SECRET) carried in the `session` cookie; /api/auth/me verifies it
 * and looks the user up in Postgres. Google is only involved at sign-up, to
 * learn the email and name. So the suite emulates a user who registered
 * earlier: it writes the same rows the Google callback would
 * (workspace-service.ts ensureUserAndMembership) straight into the stack's
 * database, mints the JWT itself, and opens the app with the cookie set.
 *
 * Signing in through the real Google flow on every CI run made Google treat
 * the stand as a suspicious device and eventually refuse the account.
 */
import crypto from "node:crypto";
import type { BrowserContext } from "@playwright/test";
import { config } from "./env";
import { run } from "./exec";

const SESSION_COOKIE = "session";

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function psql(sql: string): Promise<string> {
  const { stdout } = await run(
    "docker",
    [
      "exec",
      config.postgresContainer,
      "psql",
      "-U",
      config.postgresUser,
      "-d",
      config.postgresDb,
      "-v",
      "ON_ERROR_STOP=1",
      "-qtA",
      "-c",
      sql,
    ],
    { timeoutMs: 30_000 },
  );
  return stdout.trim();
}

/**
 * Create the test user and their workspace if they don't exist yet (same
 * rows as a first Google sign-in) and return the user id.
 */
export async function ensureTestUser(): Promise<string> {
  const email = sqlString(config.testUserEmail);
  const name = sqlString(config.testUserName);
  const workspaceName = sqlString(`${config.testUserName}'s workspace`);
  const out = await psql(`
    INSERT INTO "user" (email, name) VALUES (${email}, ${name})
      ON CONFLICT (email) DO NOTHING;
    WITH ws AS (
      INSERT INTO workspace (name)
        SELECT ${workspaceName}
        WHERE NOT EXISTS (
          SELECT 1 FROM "user"
          WHERE email = ${email} AND jsonb_array_length(workspaces) > 0
        )
        RETURNING id
    )
    UPDATE "user" SET workspaces = workspaces || jsonb_build_array(ws.id)
      FROM ws WHERE "user".email = ${email};
    SELECT id FROM "user" WHERE email = ${email};
  `);
  const userId = out.split("\n").pop()?.trim();
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    throw new Error(`Could not create the test user, psql said: ${out}`);
  }
  return userId;
}

function base64url(data: string | Buffer): string {
  return Buffer.from(data).toString("base64url");
}

/** HS256 JWT in the shape backend/src/auth.ts createSession() issues. */
export function signSessionToken(userId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({ userId, iat: now, exp: now + 24 * 60 * 60 }),
  );
  const signature = crypto
    .createHmac("sha256", config.sessionSecret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

/** Make `context` signed in as the (pre-registered) test user. */
export async function signIn(context: BrowserContext): Promise<void> {
  const userId = await ensureTestUser();
  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value: signSessionToken(userId),
      url: new URL(config.baseUrl).origin,
      httpOnly: true,
    },
  ]);
}
