/**
 * Provider-agnostic payment contract (Phase 20 — Payment Provider Adapter).
 *
 * Nothing in this file, or in anything that depends only on this file,
 * knows or should ever know which real payment gateway is behind it. Phase
 * 21 wires a real Malaysian/target-market provider (Billplz/Stripe/etc.)
 * behind this same interface; PaymentsService and everything above it stay
 * unchanged when that happens — only PaymentsModule's DI binding changes
 * (see payments.module.ts).
 *
 * Amounts are always minor units (sen, not ringgit — i.e. RM 10.00 is
 * `{ amount: 1000, currency: 'MYR' }`) to avoid float rounding issues,
 * matching how every real payment gateway's API represents money.
 */

export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED' | 'CANCELLED';

export interface Money {
  /** Minor units — e.g. sen for MYR, cents for USD. Always a non-negative integer. */
  amount: number;
  currency: string;
}

export interface CreateCheckoutParams {
  /** Never trusted from a client request body — always the caller's own session tenant. */
  tenantId: string;
  /** What this checkout is paying for. Opaque to the provider, meaningful to PaymentsService's callers (e.g. a Subscription id). */
  referenceType: string;
  referenceId: string;
  amount: Money;
  description: string;
  successUrl: string;
  cancelUrl: string;
  /** Arbitrary provider-agnostic metadata echoed back on webhooks/verification where the provider supports it. */
  metadata?: Record<string, string>;
}

export interface CheckoutResult {
  /** The provider's own identifier for this checkout/payment intent — what verifyPayment/getPaymentStatus/refund key off of. */
  providerReference: string;
  /** Where to send the payer's browser. A real provider returns its own hosted checkout page; see MockPaymentProvider for the local dev equivalent. */
  checkoutUrl: string;
  status: PaymentStatus;
  amount: Money;
}

export interface PaymentVerificationResult {
  providerReference: string;
  status: PaymentStatus;
  amount: Money;
  paidAt: Date | null;
}

export interface RefundParams {
  providerReference: string;
  /** Omit for a full refund of the original amount. */
  amount?: Money;
  reason?: string;
}

export interface RefundResult {
  providerReference: string;
  refundReference: string;
  status: PaymentStatus;
  amount: Money;
}

/**
 * Implemented once per real provider (Phase 21) plus MockPaymentProvider
 * (this phase, and permanently available for tests/local dev). Every
 * method is provider-reference-scoped, never tenant-scoped internally —
 * tenant checks belong in PaymentsService, which is the only thing that
 * should hold a reference to this interface outside of PaymentsModule's
 * own DI wiring.
 */
export interface PaymentProviderAdapter {
  /** Machine-readable provider name for logging/audit — e.g. 'mock', 'billplz'. */
  readonly name: string;

  /** Whether refund() is meaningfully implemented, so callers can check before calling rather than catching NotImplementedException. */
  readonly supportsRefunds: boolean;

  createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult>;

  verifyPayment(providerReference: string): Promise<PaymentVerificationResult>;

  getPaymentStatus(providerReference: string): Promise<PaymentStatus>;

  /** Throws NotImplementedException if supportsRefunds is false. */
  refund(params: RefundParams): Promise<RefundResult>;
}
