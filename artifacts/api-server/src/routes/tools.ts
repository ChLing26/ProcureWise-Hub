import { Router, type IRouter } from "express";
import { db, toolsSecrets, toolsSecretEvents } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateToolsSecretBody, ReplaceToolsSecretBody, ListToolsSecretsResponse, CreateToolsSecretResponse } from "@workspace/api-zod";
import { encryptSecret, requireToolsAdmin, SECRET_NAME, toolsCapabilities } from "../lib/tools-secrets";

const router: IRouter = Router();
// Explicit projection: neither ciphertext nor actor identifiers leave this router.
const metadata = {
  name: toolsSecrets.name,
  createdAt: toolsSecrets.createdAt,
  updatedAt: toolsSecrets.updatedAt,
};
const publicMetadata = (row: { name: string; createdAt: Date; updatedAt: Date }) => ({
  name: row.name, configured: true, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
});
const validKey = (key: string) => key.trim().length > 0 && Buffer.byteLength(key, "utf8") <= 4096;

router.get("/tools/capabilities", (_req, res) => {
  res.json(toolsCapabilities(res.locals.user.id));
});
router.get("/tools/secrets", async (_req, res) => {
  const rows = await db.select(metadata).from(toolsSecrets).orderBy(toolsSecrets.name);
  res.json(ListToolsSecretsResponse.parse(rows.map(publicMetadata)));
});
router.post("/tools/secrets", requireToolsAdmin, async (req, res): Promise<void> => {
  const input = CreateToolsSecretBody.strict().safeParse(req.body);
  if (!input.success || !validKey(input.data.key)) {
    res.status(400).json({ error: "Use a name of 1–64 uppercase letters, digits or underscores starting with a letter, and a nonblank key up to 4096 UTF-8 bytes." });
    return;
  }
  const { name, key } = input.data;
  const actorId = res.locals.user.id;
  const row = await db.transaction(async tx => {
    const [created] = await tx.insert(toolsSecrets).values({
      name, encryptedValue: encryptSecret(name, key), updatedBy: actorId,
    }).onConflictDoNothing({ target: toolsSecrets.name }).returning(metadata);
    if (created) await tx.insert(toolsSecretEvents).values({ secretName: name, action: "create", actorId });
    return created;
  });
  if (!row) { res.status(409).json({ error: "A secret with this name already exists. Use Replace to change its key." }); return; }
  res.status(201).json(CreateToolsSecretResponse.parse(publicMetadata(row)));
});
router.put("/tools/secrets/:name", requireToolsAdmin, async (req, res): Promise<void> => {
  const name = String(req.params.name);
  const input = ReplaceToolsSecretBody.strict().safeParse(req.body);
  if (!SECRET_NAME.test(name) || !input.success || !validKey(input.data.key)) {
    res.status(400).json({ error: "Use a valid secret name and a nonblank key up to 4096 UTF-8 bytes." }); return;
  }
  const actorId = res.locals.user.id;
  const row = await db.transaction(async tx => {
    const [updated] = await tx.update(toolsSecrets).set({
      encryptedValue: encryptSecret(name, input.data.key), updatedAt: new Date(), updatedBy: actorId,
    }).where(eq(toolsSecrets.name, name)).returning(metadata);
    if (updated) await tx.insert(toolsSecretEvents).values({ secretName: name, action: "replace", actorId });
    return updated;
  });
  if (!row) { res.status(404).json({ error: "This secret no longer exists. Refresh the list." }); return; }
  res.json(CreateToolsSecretResponse.parse(publicMetadata(row)));
});
router.delete("/tools/secrets/:name", requireToolsAdmin, async (req, res): Promise<void> => {
  const name = String(req.params.name);
  if (!SECRET_NAME.test(name)) { res.status(400).json({ error: "Use a valid secret name." }); return; }
  const deleted = await db.transaction(async tx => {
    const rows = await tx.delete(toolsSecrets).where(eq(toolsSecrets.name, name)).returning({ name: toolsSecrets.name });
    if (rows.length) await tx.insert(toolsSecretEvents).values({ secretName: name, action: "delete", actorId: res.locals.user.id });
    return rows.length;
  });
  if (!deleted) { res.status(404).json({ error: "This secret no longer exists. Refresh the list." }); return; }
  res.sendStatus(204);
});

export default router;
