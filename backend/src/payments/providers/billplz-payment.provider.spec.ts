import { NotFoundException, NotImplementedException, ServiceUnavailableException } from '@nestjs/common';
import { BillplzPaymentProvider } from './billplz-payment.provider';

function mockFetchOnce(status: number, body: any) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

describe('BillplzPaymentProvider', () => {
  let provider: BillplzPaymentProvider;
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      BILLPLZ_API_KEY: 'test-api-key',
      BILLPLZ_COLLECTION_ID: 'test-collection',
      BILLPLZ_BASE_URL: 'https://www.billplz-sandbox.com',
    };
    provider = new BillplzPaymentProvider();
    (global as any).fetch = jest.fn();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  it('exposes provider identity and refuses to advertise refund support', () => {
    expect(provider.name).toBe('billplz');
    expect(provider.supportsRefunds).toBe(false);
  });

  describe('createCheckout', () => {
    const params = {
      tenantId: 'tenant-1',
      referenceType: 'Subscription',
      referenceId: 'sub-1',
      amount: { amount: 5000, currency: 'MYR' },
      description: 'Pro plan — monthly',
      successUrl: 'https://app.example.com/billing/success',
      cancelUrl: 'https://app.example.com/billing/cancel',
    };

    it('creates a bill and maps the response into CheckoutResult', async () => {
      mockFetchOnce(200, { id: 'bill_abc', url: 'https://billplz-sandbox.com/bills/bill_abc', paid: false, amount: '5000' });

      const result = await provider.createCheckout(params);

      expect(result).toEqual({
        providerReference: 'bill_abc',
        checkoutUrl: 'https://billplz-sandbox.com/bills/bill_abc',
        status: 'PENDING',
        amount: { amount: 5000, currency: 'MYR' },
      });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.billplz-sandbox.com/api/v3/bills',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('rejects a successful API response with a mismatched amount', async () => {
      mockFetchOnce(200, { id: 'bill_abc', url: 'https://billplz-sandbox.com/bills/bill_abc', paid: false, amount: '4999' });

      await expect(provider.createCheckout(params)).rejects.toThrow(ServiceUnavailableException);
    });

    it('rejects a successful API response with an untrusted checkout URL', async () => {
      mockFetchOnce(200, { id: 'bill_abc', url: 'https://attacker.example/bills/bill_abc', paid: false, amount: '5000' });

      await expect(provider.createCheckout(params)).rejects.toThrow(ServiceUnavailableException);
    });

    it('rejects a successful API response without a bill ID', async () => {
      mockFetchOnce(200, { url: 'https://billplz-sandbox.com/bills/bill_abc', paid: false, amount: '5000' });

      await expect(provider.createCheckout(params)).rejects.toThrow(ServiceUnavailableException);
    });

    it('sends Basic auth built from the API key with an empty password', async () => {
      mockFetchOnce(200, { id: 'bill_abc', url: 'https://billplz-sandbox.com/bills/bill_abc', paid: false, amount: '5000' });

      await provider.createCheckout(params);

      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      const expected = `Basic ${Buffer.from('test-api-key:').toString('base64')}`;
      expect(options.headers.Authorization).toBe(expected);
    });

    it('rejects a non-MYR currency before calling the API at all', async () => {
      await expect(provider.createCheckout({ ...params, amount: { amount: 5000, currency: 'USD' } })).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('surfaces a Billplz API error as ServiceUnavailableException', async () => {
      mockFetchOnce(422, { error: { message: ['Amount must be greater than 100'] } });

      await expect(provider.createCheckout(params)).rejects.toThrow(ServiceUnavailableException);
    });

    it('rejects a configured API base URL outside the trusted Billplz hosts before sending credentials', async () => {
      process.env.BILLPLZ_BASE_URL = 'https://attacker.example';

      await expect(provider.createCheckout(params)).rejects.toThrow(ServiceUnavailableException);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects an HTTP Billplz endpoint to prevent transmitting API credentials insecurely', async () => {
      process.env.BILLPLZ_BASE_URL = 'http://www.billplz.com';

      await expect(provider.createCheckout(params)).rejects.toThrow(ServiceUnavailableException);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects a trusted Billplz hostname with an injected path or query string', async () => {
      process.env.BILLPLZ_BASE_URL = 'https://www.billplz.com/proxy?to=attacker';

      await expect(provider.createCheckout(params)).rejects.toThrow(ServiceUnavailableException);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('throws if BILLPLZ_API_KEY is not configured', async () => {
      delete process.env.BILLPLZ_API_KEY;
      await expect(provider.createCheckout(params)).rejects.toThrow(ServiceUnavailableException);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('verifyPayment / getPaymentStatus', () => {
    it('maps a paid bill to SUCCEEDED with paidAt set', async () => {
      mockFetchOnce(200, { id: 'bill_abc', paid: true, amount: '5000', paid_at: '2026-08-30T10:00:00Z' });

      const result = await provider.verifyPayment('bill_abc');

      expect(result).toEqual({
        providerReference: 'bill_abc',
        status: 'SUCCEEDED',
        amount: { amount: 5000, currency: 'MYR' },
        paidAt: new Date('2026-08-30T10:00:00Z'),
      });
    });

    it('maps an unpaid bill to PENDING with a null paidAt', async () => {
      mockFetchOnce(200, { id: 'bill_abc', paid: false, amount: '5000', paid_at: null });

      const result = await provider.verifyPayment('bill_abc');

      expect(result.status).toBe('PENDING');
      expect(result.paidAt).toBeNull();
    });

    it('rejects a bill response whose ID differs from the requested reference', async () => {
      mockFetchOnce(200, { id: 'bill_other', paid: true, amount: '5000', paid_at: '2026-08-30T10:00:00Z' });

      await expect(provider.verifyPayment('bill_abc')).rejects.toThrow(ServiceUnavailableException);
    });

    it('rejects a malformed bill amount instead of treating it as a valid payment', async () => {
      mockFetchOnce(200, { id: 'bill_abc', paid: true, amount: 'not-a-number', paid_at: null });

      await expect(provider.verifyPayment('bill_abc')).rejects.toThrow(ServiceUnavailableException);
    });

    it('rejects an invalid paid_at timestamp', async () => {
      mockFetchOnce(200, { id: 'bill_abc', paid: true, amount: '5000', paid_at: 'not-a-date' });

      await expect(provider.verifyPayment('bill_abc')).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws NotFoundException for a 404 from Billplz', async () => {
      mockFetchOnce(404, {});
      await expect(provider.verifyPayment('bill_missing')).rejects.toThrow(NotFoundException);
    });

    it('getPaymentStatus delegates to verifyPayment and returns just the status', async () => {
      mockFetchOnce(200, { id: 'bill_abc', paid: true, amount: '5000', paid_at: '2026-08-30T10:00:00Z' });
      await expect(provider.getPaymentStatus('bill_abc')).resolves.toBe('SUCCEEDED');
    });
  });

  describe('refund', () => {
    it('always throws NotImplementedException, defensively, even if called directly', async () => {
      await expect(provider.refund({ providerReference: 'bill_abc' })).rejects.toThrow(NotImplementedException);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
