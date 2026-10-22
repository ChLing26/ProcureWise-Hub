import { createHash } from "node:crypto";
import type { GetCurrentUserResponse, GetProcurementRequestResponse } from "@workspace/api-zod";

type Account = ReturnType<typeof GetCurrentUserResponse.parse>;
type Invoice = NonNullable<ReturnType<typeof GetProcurementRequestResponse.parse>["invoice"]>;

/** An internal consent record, not a certificate-backed digital signature. */
export function attachElectronicSignature(
  invoice: Invoice,
  typedName: string,
  account: Account,
  now = new Date(),
): Invoice {
  if (invoice.electronicSignature) throw new Error("Invoice already signed");
  const name = typedName.trim();
  if (name.length < 2 || name.length > 120) throw new Error("Invalid signature name");
  const metadata = {
    typedName: name,
    accountId: account.id,
    accountName: account.name,
    signedAt: now,
    consentVersion: "invoice-signature-v1",
  };
  const documentHash = createHash("sha256")
    .update(JSON.stringify({ invoice, signature: metadata })).digest("hex");
  return { ...invoice, electronicSignature: { ...metadata, documentHash } };
}
