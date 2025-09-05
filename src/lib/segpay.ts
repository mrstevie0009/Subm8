// Minimaler Stub. Später echte Segpay-Integration (Signature/Webhooks).
export async function segpayCharge(input: {
  amountCents: number;
  currency: string;
  orderId: string;
}): Promise<{ ok: true; providerRef: string; providerFeeCents: number } | { ok: false; error: string }> {
  // Demo: 3% Provider-Fee – in echt aus Segpay-Response/Webhook übernehmen.
  const providerFeeCents = Math.round((input.amountCents || 0) * 0.03);
  return {
    ok: true,
    providerRef: `segpay_${input.orderId}`,
    providerFeeCents,
  };
}
