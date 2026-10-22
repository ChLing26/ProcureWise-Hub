import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { db, pool, accounts, accountSessions, toolsSecrets, toolsSecretEvents, authAttempts } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import app from "../app";
import { digest, newSession } from "../lib/auth";
import { decryptSecret, encryptSecret } from "../lib/tools-secrets";

test("Tools secrets enforce trusted access and metadata-only encrypted persistence", async () => {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/tools`;
  const suffix = randomUUID().replaceAll("-", "").toUpperCase();
  const name = `TEST_${suffix}`;
  const value = `synthetic-${randomUUID()}`;
  const replacement = `replacement-${randomUUID()}`;
  const priorIds = process.env.TOOLS_ADMIN_ACCOUNT_IDS;
  const priorKey = process.env.TOOLS_SECRETS_ENCRYPTION_KEY;
  const ids: number[] = [];
  const call = (path = "/secrets", method = "GET", data?: unknown, cookie?: string, headers = {}) => fetch(`${base}${path}`, {
    method, headers: { "content-type": "application/json", "x-procureflow-request": "1", ...(cookie ? { cookie } : {}), ...headers },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const safeBody = async (response: Response, status: number) => {
    assert.equal(response.status, status);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const text = await response.text();
    assert.ok(!text.includes(value) && !text.includes(replacement));
    assert.ok(!text.includes("encryptedValue") && !text.includes("encrypted_value"));
    return text ? JSON.parse(text) : null;
  };
  try {
    const cookies: string[] = [];
    for (let i = 0; i < 2; i++) {
      const [account] = await db.insert(accounts).values({
        name: "Synthetic Tools Test", email: `tools-${suffix.toLowerCase()}-${i}@example.com`, passwordHash: "unusable-test-hash",
      }).returning();
      ids.push(account.id);
      const session = newSession();
      await db.insert(accountSessions).values({ accountId: account.id, tokenHash: session.tokenHash, expiresAt: session.expiresAt });
      cookies.push(`procureflow_session=${session.token}`);
    }
    const [admin, ordinary] = cookies;
    delete process.env.TOOLS_ADMIN_ACCOUNT_IDS;
    delete process.env.TOOLS_SECRETS_ENCRYPTION_KEY;
    for (const [path, method, body] of [
      ["/capabilities", "GET", undefined], ["/secrets", "GET", undefined],
      ["/secrets", "POST", { name, key: value }], [`/secrets/${name}`, "PUT", { key: value }], [`/secrets/${name}`, "DELETE", undefined],
    ] as const) await safeBody(await call(path, method, body), 401);
    assert.deepEqual(await safeBody(await call("/capabilities", "GET", undefined, admin), 200), { canManageSecrets: false, setupRequired: true });
    await safeBody(await call("/secrets", "POST", { name, key: value, role: "owner" }, admin), 403);

    process.env.TOOLS_ADMIN_ACCOUNT_IDS = String(ids[0]);
    await safeBody(await call("/secrets", "POST", { name, key: value }, admin), 503);
    process.env.TOOLS_SECRETS_ENCRYPTION_KEY = "malformed";
    await safeBody(await call("/secrets", "POST", { name, key: value }, admin), 503);
    process.env.TOOLS_SECRETS_ENCRYPTION_KEY = randomBytes(32).toString("hex");
    assert.deepEqual(await safeBody(await call("/capabilities", "GET", undefined, ordinary), 200), { canManageSecrets: false, setupRequired: false });
    for (const method of ["POST", "PUT", "DELETE"]) {
      await safeBody(await call(method === "POST" ? "/secrets" : `/secrets/${name}`, method, method === "DELETE" ? undefined : { name, key: value, isAdmin: true }, ordinary), 403);
    }
    // Public signup ignores malicious privilege claims, even with setup ready.
    const signup = await fetch(`${base.replace(/\/tools$/, "")}/auth/register`, { method: "POST",
      headers: { "content-type": "application/json", "x-procureflow-request": "1" },
      body: JSON.stringify({ name: "Untrusted role claim", email: `tools-claim-${suffix.toLowerCase()}@example.com`,
        password: "synthetic-long-passphrase-987", passwordConfirmation: "synthetic-long-passphrase-987", role: "owner", isAdmin: true }),
    });
    const claimant = await signup.json() as { id: number };
    assert.equal(signup.status, 201);
    ids.push(claimant.id);
    await safeBody(await call("/secrets", "POST", { name, key: value }, signup.headers.get("set-cookie")!.split(";")[0]), 403);

    for (const headers of [{ origin: "https://evil.example" }, { "x-procureflow-request": "" }, { "sec-fetch-site": "cross-site" }]) {
      await safeBody(await call("/secrets", "POST", { name, key: value }, admin, headers), 403);
    }
    for (const data of [
      { name: "lowercase", key: value }, { name: "A".repeat(65), key: value },
      { name, key: "" }, { name, key: "  " }, { name, key: "x".repeat(4097) },
      { name, key: "😀".repeat(1100) }, { name, key: value, role: "owner" },
    ]) await safeBody(await call("/secrets", "POST", data, admin), 400);

    const created = await safeBody(await call("/secrets", "POST", { name, key: value }, admin), 201);
    assert.deepEqual(Object.keys(created).sort(), ["configured", "createdAt", "name", "updatedAt"]);
    await safeBody(await call("/secrets", "POST", { name, key: value }, admin), 409);
    const [stored] = await db.select().from(toolsSecrets).where(eq(toolsSecrets.name, name));
    assert.ok(!JSON.stringify(stored).includes(value));
    assert.equal(decryptSecret(name, stored.encryptedValue), value);
    assert.notEqual(encryptSecret(name, value), stored.encryptedValue);
    assert.throws(() => decryptSecret("OTHER_NAME", stored.encryptedValue));
    const parts = stored.encryptedValue.split(".");
    parts[2] = Buffer.alloc(16).toString("base64");
    assert.throws(() => decryptSecret(name, parts.join(".")));
    const encryptionKey = process.env.TOOLS_SECRETS_ENCRYPTION_KEY;
    process.env.TOOLS_SECRETS_ENCRYPTION_KEY = randomBytes(32).toString("hex");
    assert.throws(() => decryptSecret(name, stored.encryptedValue));
    process.env.TOOLS_SECRETS_ENCRYPTION_KEY = encryptionKey;
    const listing = await safeBody(await call("/secrets", "GET", undefined, ordinary), 200);
    assert.ok(listing.some((row: { name: string; configured: boolean }) => row.name === name && row.configured));
    await safeBody(await call(`/secrets/${name}`, "PUT", { key: replacement }, admin), 200);
    assert.equal(decryptSecret(name, (await db.select().from(toolsSecrets).where(eq(toolsSecrets.name, name)))[0].encryptedValue), replacement);
    // Revocation and expired sessions take effect on the next request, not just login.
    process.env.TOOLS_ADMIN_ACCOUNT_IDS = String(ids[1]);
    await safeBody(await call(`/secrets/${name}`, "DELETE", undefined, admin), 403);
    process.env.TOOLS_ADMIN_ACCOUNT_IDS = `${ids[0]},invalid`;
    await safeBody(await call(`/secrets/${name}`, "DELETE", undefined, admin), 403);
    process.env.TOOLS_ADMIN_ACCOUNT_IDS = String(ids[0]);
    delete process.env.TOOLS_SECRETS_ENCRYPTION_KEY;
    await safeBody(await call(`/secrets/${name}`, "DELETE", undefined, admin), 503);
    await safeBody(await call("/secrets", "GET", undefined, ordinary), 200);
    process.env.TOOLS_SECRETS_ENCRYPTION_KEY = encryptionKey;
    await safeBody(await call(`/secrets/${name}`, "DELETE", undefined, admin), 204);
    await safeBody(await call(`/secrets/${name}`, "DELETE", undefined, admin), 404);
    await safeBody(await call(`/secrets/${name}`, "PUT", { key: value }, admin), 404);
    const events = await db.select().from(toolsSecretEvents).where(eq(toolsSecretEvents.secretName, name)).orderBy(toolsSecretEvents.id);
    assert.deepEqual(events.map(event => event.action), ["create", "replace", "delete"]);
    assert.ok(events.every(event => event.actorId === ids[0]));
    assert.ok(!JSON.stringify(events).includes(value));
    await db.update(accountSessions).set({ expiresAt: new Date(0) }).where(eq(accountSessions.accountId, ids[0]));
    await safeBody(await call("/secrets", "GET", undefined, admin), 401);
  } finally {
    if (priorIds === undefined) delete process.env.TOOLS_ADMIN_ACCOUNT_IDS; else process.env.TOOLS_ADMIN_ACCOUNT_IDS = priorIds;
    if (priorKey === undefined) delete process.env.TOOLS_SECRETS_ENCRYPTION_KEY; else process.env.TOOLS_SECRETS_ENCRYPTION_KEY = priorKey;
    await db.delete(toolsSecrets).where(eq(toolsSecrets.name, name));
    await db.delete(toolsSecretEvents).where(eq(toolsSecretEvents.secretName, name));
    if (ids.length) await db.delete(accounts).where(inArray(accounts.id, ids));
    await db.delete(authAttempts).where(inArray(authAttempts.key, [`email:${digest(`tools-claim-${suffix.toLowerCase()}@example.com`)}`, `ip:${digest("127.0.0.1")}`]));
    await new Promise<void>(resolve => server.close(() => resolve()));
    await pool.end();
  }
});
