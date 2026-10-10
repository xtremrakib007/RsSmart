import { Injectable, NotFoundException, NotImplementedException, ServiceUnavailableException } from '@nestjs/common';
import {
  PaymentProviderAdapter,
  CreateCheckoutParams,
  CheckoutResult,
  PaymentVerificationResult,
  PaymentStatus,
  RefundParams,
  RefundResult,
} from '../interfaces/payment-provider.interface';

/**
 * Real Malaysian payment provider (Phase 21) behind the Phase 20 adapter —
 * Billplz (FPX/DuitNow bank transfer collection). PaymentsService and
 * everything above it are unaffected by this file existing; only
 * PaymentsModule's DI binding changes to select it (see payments.module.ts).
 *
 * Env config is read lazily inside each call, not the constructor — so the
 * app can boot with PAYMENT_PROVIDER=mock (Billplz vars unset) without this
 * class ever being instantiated with a hard failure. It only throws when a
 * request actually needs Billplz and the vars are missing.
 */
@Injectable()
export class BillplzPaymentProvider implements PaymentProviderAdapter {
  readonly name = 'billplz';

  // Billplz has no public API to programmatically reverse a paid FPX/
  // DuitNow bank-transfer bill — refunds there are a manual bank
  // transfer done by the merchant outside any API. Advertising
  // supportsRefunds=false (rather than half-implementing something that
  // isn't really a refund) means PaymentsService.refund() throws
  // NotImplementedException up front without ever calling this class —
  // see payments.service.ts.
  readonly supportsRefunds = false;

  private get apiKey(): string {
    const key = process.env.BILLPLZ_API_KEY;
    if (!key) throw new ServiceUnavailableException('BILLPLZ_API_KEY is not configured');
    return key;
  }

  private get collectionId(): string {
    const id = process.env.BILLPLZ_COLLECTION_ID;
    if (!id) throw new ServiceUnavailableException('BILLPLZ_COLLECTION_ID is not configured');
    return id;
  }

  /**
   * Sandbox vs production Billplz base URL. Never send the API key to an
   * arbitrary host supplied through environment configuration.
   */
  private get baseUrl(): string {
    const configured = process.env.BILLPLZ_BASE_URL || 'https://www.billplz.com';
    let parsed: URL;
    try {
      parsed = new URL(configured);
    } catch {
      throw new ServiceUnavailableException('BILLPLZ_BASE_URL is invalid');
    }
    const allowedHosts = new Set(['www.billplz.com', 'www.billplz-sandbox.com']);
    if (parsed.protocol !== 'https:' || !allowedHosts.has(parsed.hostname.toLowerCase()) ||
        parsed.username || parsed.password || parsed.port || (parsed.pathname !== '/' && parsed.pathname !== '') ||
        parsed.search || parsed.hash) {
      throw new ServiceUnavailableException('BILLPLZ_BASE_URL must be an approved HTTPS Billplz endpoint');
    }
    return parsed.origin;
  }

  private authHeader(): string {
    // Billplz uses HTTP Basic auth with the API secret key as the
    // username and an empty password.
    return `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`;
  }

  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult> {
    if (params.amount.currency !== 'MYR') {
      // Billplz (FPX/DuitNow) only ever settles in MYR — fail before
      // calling the API rather than letting Billplz reject it more
      // opaquely, or worse, silently charge the wrong amount if it
      // ignored the field.
      throw new ServiceUnavailableException(`Billplz only supports MYR, got ${params.amount.currency}`);
    }

    const body = new URLSearchParams({
      collection_id: this.collectionId,
      description: params.description,
      email: params.metadata?.email || 'billing@example.com',
      name: params.metadata?.name || 'Customer',
      amount: String(params.amount.amount), // Billplz amount is already in sen (minor units) — matches our Money type directly.
      callback_url: params.metadata?.callbackUrl || '',
      redirect_url: params.successUrl,
      reference_1_label: params.referenceType,
      reference_1: params.referenceId,
    });

    const response = await fetch(`${this.baseUrl}/api/v3/bills`, {
      method: 'POST',
      headers: { Authorization: this.authHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ServiceUnavailableException(data?.error?.message?.[0] || `Billplz checkout creation failed (${response.status})`);
    }

    const returnedReference = typeof data?.id === 'string' ? data.id.trim() : '';
    const returnedAmount = this.parseMinorAmount(data?.amount);
    const checkoutUrl = this.validateCheckoutUrl(data?.url);
    if (!returnedReference || returnedReference.includes(' ') || returnedReference.includes('/') ||
        returnedReference.includes('\\') || returnedReference.includes('?') || returnedReference.includes('#') ||
        returnedAmount !== params.amount.amount || !checkoutUrl) {
      throw new ServiceUnavailableException('Billplz returned an invalid or mismatched checkout response');
    }

    return {
      providerReference: returnedReference,
      checkoutUrl,
      status: this.mapStatus(data),
      amount: { amount: returnedAmount, currency: 'MYR' },
    };
  }

  async verifyPayment(providerReference: string): Promise<PaymentVerificationResult> {
    const response = await fetch(`${this.baseUrl}/api/v3/bills/${encodeURIComponent(providerReference)}`, {
      headers: { Authorization: this.authHeader() },
    });
    if (response.status === 404) throw new NotFoundException('Payment reference not found');
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ServiceUnavailableException(data?.error?.message?.[0] || `Billplz bill lookup failed (${response.status})`);
    }

    const returnedReference = typeof data?.id === 'string' ? data.id.trim() : '';
    const amount = this.parseMinorAmount(data?.amount);
    const paidAt = data?.paid_at ? new Date(data.paid_at) : null;
    if (!returnedReference || returnedReference !== providerReference ||
        amount === null || (data?.paid_at && (!paidAt || Number.isNaN(paidAt.getTime())))) {
      throw new ServiceUnavailableException('Billplz returned an invalid or mismatched bill response');
    }

    return {
      providerReference: returnedReference,
      status: this.mapStatus(data),
      amount: { amount, currency: 'MYR' },
      paidAt,
    };
  }

  async getPaymentStatus(providerReference: string): Promise<PaymentStatus> {
    return (await this.verifyPayment(providerReference)).status;
  }

  async refund(_params: RefundParams): Promise<RefundResult> {
    // Belt-and-braces: PaymentsService already short-circuits on
    // supportsRefunds before ever reaching this, but this class must
    // never silently no-op if someone calls it directly.
    throw new NotImplementedException('Billplz does not support programmatic refunds — refund manually via bank transfer');
  }

  /**
   * Billplz's own bill state is `state: 'due' | 'paid'` plus a separate
   * `paid: boolean`, with no explicit FAILED/CANCELLED state of its own
   * for FPX (an abandoned/unpaid bill just stays 'due' indefinitely) — so
   * this only ever returns PENDING or SUCCEEDED. A bill that a caller
   * needs to treat as FAILED (e.g. expired without payment) is a product
   * decision for the caller based on `due_at`, not something Billplz's
   * API tells us directly.
   */
  private parseMinorAmount(value: unknown): number | null {
    if (!(typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value)))) {
      return null;
    }
    const amount = Number(value);
    return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
  }

  private validateCheckoutUrl(value: unknown): string | null {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value);
      const allowedHosts = new Set([
        'billplz.com',
        'www.billplz.com',
        'billplz-sandbox.com',
        'www.billplz-sandbox.com',
      ]);
      if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname.toLowerCase()) ||
          url.username || url.password || url.port || url.search || url.hash ||
          !url.pathname.startsWith('/bills/')) {
        return null;
      }
      return url.toString();
    } catch {
      return null;
    }
  }

  private mapStatus(data: any): PaymentStatus {
    return data?.paid === true ? 'SUCCEEDED' : 'PENDING';
  }
}
