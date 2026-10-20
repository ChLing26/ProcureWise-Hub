import { Router, type IRouter } from "express";
import { db, procurementRecords } from "@workspace/db";
import { eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { CreateProcurementRequestBody, DecideProcurementRequestBody, DecideProcurementRequestParams, GetProcurementRequestParams,
  GetProcurementDashboardResponse, ListProcurementRequestsResponse, CreateProcurementRequestResponse, GetProcurementRequestResponse,
  DecideProcurementRequestResponse, ListProcurementInvoicesResponse, GetProcurementRecommendationsResponse } from "@workspace/api-zod";
import { createRecord, listRecords, makeInvoice, round } from "../lib/procurement";

const router: IRouter = Router();
router.get("/procurement/requests", async (_req,res): Promise<void> => {
  res.json(ListProcurementRequestsResponse.parse(await listRecords()));
});
router.post("/procurement/requests", async (req,res): Promise<void> => {
  const input = CreateProcurementRequestBody.safeParse(req.body);
  if (!input.success) { res.status(400).json({error: input.error.message}); return; }
  res.status(201).json(CreateProcurementRequestResponse.parse(await createRecord(input.data)));
});
router.get("/procurement/requests/:requestId", async (req,res): Promise<void> => {
  const params = GetProcurementRequestParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({error:"Invalid request ID"}); return; }
  const record = (await listRecords()).find(r => r.id === params.data.requestId);
  if (!record) { res.status(404).json({error:"Request not found"}); return; }
  res.json(GetProcurementRequestResponse.parse(record));
});
router.post("/procurement/requests/:requestId/decision", async (req,res): Promise<void> => {
  const params = DecideProcurementRequestParams.safeParse(req.params);
  const input = DecideProcurementRequestBody.safeParse(req.body);
  if (!params.success || !input.success) { res.status(400).json({error:"Please provide a valid decision and manager name."}); return; }
  await db.transaction(async tx => {
    const [row] = await tx.select().from(procurementRecords).where(eq(procurementRecords.id,params.data.requestId)).for("update");
    if (!row) { res.status(404).json({error:"Request not found"}); return; }
    const record = GetProcurementRequestResponse.parse(row.data);
    if (record.status !== "pending_approval") { res.status(400).json({error:"This request has already been reviewed."}); return; }
    const selected = record.offers.find(o => o.id === input.data.offerId);
    if (input.data.decision === "approved" && !selected) { res.status(400).json({error:"Choose a supplier offer to approve."}); return; }
    const updated = { ...record, status: input.data.decision, managerName: input.data.managerName, managerComment: input.data.comment ?? "",
      selectedOfferId: selected?.id ?? null, selectedSupplier: selected?.supplierName ?? null,
      invoice: selected && input.data.decision === "approved" ? makeInvoice(record,selected.id,input.data.managerName) : null };
    await tx.update(procurementRecords).set({data: updated}).where(eq(procurementRecords.id,record.id));
    res.json(DecideProcurementRequestResponse.parse(updated));
  });
});
router.get("/procurement/invoices", async (_req,res): Promise<void> => {
  res.json(ListProcurementInvoicesResponse.parse((await listRecords()).flatMap(r => r.invoice ? [r.invoice] : [])));
});
router.get("/procurement/dashboard", async (_req,res): Promise<void> => {
  const records = await listRecords();
  const approved = records.filter(r => r.status === "approved");
  res.json(GetProcurementDashboardResponse.parse({
    activeRequests: records.filter(r => r.status === "pending_approval" || r.status === "open_for_quotes").length,
    awaitingApproval: records.filter(r => r.status === "pending_approval").length,
    approvedThisMonth: approved.filter(r => r.invoice && new Date(r.invoice.issuedAt).toISOString().slice(0,7) === new Date().toISOString().slice(0,7)).length,
    savingsAgainstBudget: round(approved.filter(r => r.currency === "MYR").reduce((sum,r) => sum + r.budgetAmount - (r.invoice?.totalAmount ?? r.budgetAmount),0)),
    recentActivity: records.slice(0,6).map(r => ({id:String(r.id),title:r.status === "approved" ? "Supplier approved" : r.status === "rejected" ? "Request rejected" : "Request created",
      detail:r.itemName,time:r.createdAt,kind:r.status}))
  }));
});
let insightCache: { key: string; value: unknown } | undefined;
router.get("/procurement/recommendations", async (req,res): Promise<void> => {
  const approved = (await listRecords()).filter(r => r.status === "approved");
  const grouped = new Map<string,number>();
  for (const record of approved) if (record.selectedSupplier) grouped.set(record.selectedSupplier,(grouped.get(record.selectedSupplier) ?? 0)+1);
  const recommendations = [...grouped].sort((a,b) => b[1]-a[1]).map(([supplierName,approvals]) => ({supplierName,approvals,reason:`Selected in ${approvals} approved procurement ${approvals === 1 ? "request" : "requests"}.`}));
  const key = JSON.stringify(recommendations);
  if (insightCache?.key === key) { res.json(insightCache.value); return; }
  let summary = "Approve your first procurement request to get AI recommendations grounded in your team's supplier choices.";
  if (approved.length) {
    try {
      const result = await openai.chat.completions.create({model:"gpt-5-mini",max_completion_tokens:8192,
        messages:[{role:"system",content:"You are a procurement adviser. In 2 brief sentences recommend how to approach the next purchase based only on the supplied illustrative approval history. Do not invent supplier performance facts or claim actual market knowledge."},
          {role:"user",content:JSON.stringify(approved.map(r => ({item:r.itemName,supplier:r.selectedSupplier,budget:r.budgetAmount,total:r.invoice?.totalAmount,offers:r.offers.map(o => ({supplier:o.supplierName,score:o.overallScore,days:o.deliveryDays}))})))}]});
      summary = result.choices[0]?.message.content?.trim() || "No AI insight was returned. Please try again.";
    } catch (error) {
      req.log.error({err:error},"AI recommendations unavailable");
      res.status(503).json({error:"AI recommendations are temporarily unavailable. Your procurement data is safe."}); return;
    }
  }
  const value = GetProcurementRecommendationsResponse.parse({summary,recommendations,generatedAt:new Date().toISOString(),historyCount:approved.length});
  insightCache = {key,value};
  res.json(value);
});
export default router;
