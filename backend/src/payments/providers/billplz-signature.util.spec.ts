import { createHmac } from 'crypto';
import { verifyBillplzSignature, unwrapBillplzRedirectParams } from './billplz-signature.util';

const SIGNATURE_KEY = 'test-x-signature-key';

function sign(fields: Record<string, string>): string {
  const sourceString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('|');
  return createHmac('sha256', SIGNATURE_KEY).update(sourceString).digest('hex');
}

describe('verifyBillplzSignature', () => {
  const baseFields = { id: 'bill_123', collection_id: 'col_1', paid: 'true', amount: '5000', state: 'paid' };

  it('accepts a correctly signed payload', () => {
    const x_signature = sign(baseFields);
    expect(verifyBillplzSignature({ ...baseFields, x_signature }, SIGNATURE_KEY)).toBe(true);
  });

  it('is insensitive to field order in the input object (always sorts before hashing)', () => {
    const x_signature = sign(baseFields);
    const reordered = { paid: baseFields.paid, id: baseFields.id, x_signature, amount: baseFields.amount, state: baseFields.state, collection_id: baseFields.collection_id };
    expect(verifyBillplzSignature(reordered, SIGNATURE_KEY)).toBe(true);
  });

  it('rejects a tampered field (e.g. paid flipped after signing)', () => {
    const x_signature = sign(baseFields);
    expect(verifyBillplzSignature({ ...baseFields, paid: 'false', x_signature }, SIGNATURE_KEY)).toBe(false);
  });

  it('rejects the wrong signature key', () => {
    const x_signature = sign(baseFields);
    expect(verifyBillplzSignature({ ...baseFields, x_signature }, 'wrong-key')).toBe(false);
  });

  it('rejects a missing x_signature field', () => {
    expect(verifyBillplzSignature({ ...baseFields }, SIGNATURE_KEY)).toBe(false);
  });

  it('rejects when no signature key is configured', () => {
    const x_signature = sign(baseFields);
    expect(verifyBillplzSignature({ ...baseFields, x_signature }, '')).toBe(false);
  });

  it('never throws on a malformed/non-hex x_signature — just returns false', () => {
    expect(() => verifyBillplzSignature({ ...baseFields, x_signature: 'not-hex-!!' }, SIGNATURE_KEY)).not.toThrow();
    expect(verifyBillplzSignature({ ...baseFields, x_signature: 'not-hex-!!' }, SIGNATURE_KEY)).toBe(false);
  });
});

describe('unwrapBillplzRedirectParams', () => {
  it('strips the billplz[...] wrapper down to bare field names', () => {
    const query = { 'billplz[id]': 'bill_123', 'billplz[paid]': 'true', 'billplz[x_signature]': 'abc123', unrelated: 'ignored' };
    expect(unwrapBillplzRedirectParams(query)).toEqual({ id: 'bill_123', paid: 'true', x_signature: 'abc123' });
  });

  it('ignores non-billplz query params entirely', () => {
    expect(unwrapBillplzRedirectParams({ utm_source: 'google' })).toEqual({});
  });

  it('returns an empty object for an empty query', () => {
    expect(unwrapBillplzRedirectParams({})).toEqual({});
  });
});
