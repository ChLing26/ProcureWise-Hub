import { test } from "node:test";
import assert from "node:assert/strict";
import { attachElectronicSignature } from "./invoice-signature";

const invoice = {
  id: 999, reference: "INV-TEST", requestId: 999, itemName: "Paper", quantity: 10,
  supplierName: "Supplier", buyerName: "Buyer", unitPrice: 2, shippingFee: 3,
  totalAmount: 23, currency: "MYR", issuedAt: new Date("2026-10-22T00:00:00.000Z"),
  signature: "original-hash", signatureType: "Integrity hash",
};
const account = { id: 42, name: "Test Signer", email: "test@example.test" };
const at = new Date("2026-10-22T12:00:00.000Z");

test("records trimmed name, account identity, time and consent without modifying invoice", () => {
  const result = attachElectronicSignature(invoice, "  Test Signer  ", account, at);
  assert.equal(result.electronicSignature?.typedName, "Test Signer");
  assert.equal(result.electronicSignature?.accountId, 42);
  assert.equal(result.electronicSignature?.signedAt.toISOString(), at.toISOString());
  assert.equal(result.electronicSignature?.consentVersion, "invoice-signature-v1");
  assert.match(result.electronicSignature!.documentHash, /^[a-f0-9]{64}$/);
  assert.equal(result.totalAmount, 23);
  assert.equal(result.signature, "original-hash");
  assert.equal("electronicSignature" in invoice, false);
});
test("hash binds invoice values and signing identity", () => {
  const original = attachElectronicSignature(invoice, "Test Signer", account, at).electronicSignature!.documentHash;
  assert.notEqual(original, attachElectronicSignature({ ...invoice, totalAmount: 24 }, "Test Signer", account, at).electronicSignature!.documentHash);
  assert.notEqual(original, attachElectronicSignature(invoice, "Test Signer", { ...account, id: 43 }, at).electronicSignature!.documentHash);
});
test("rejects overwriting an existing signature and invalid names", () => {
  const signed = attachElectronicSignature(invoice, "Test Signer", account, at);
  assert.throws(() => attachElectronicSignature(signed, "Other Signer", account), /already signed/);
  for (const name of [" ", "x", "x".repeat(121)]) {
    assert.throws(() => attachElectronicSignature(invoice, name, account), /Invalid signature name/);
  }
});
