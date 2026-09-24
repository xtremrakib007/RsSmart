import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Billplz X-Signature verification (callback/webhook AND redirect query
 * params use the same scheme). Unlike the WhatsApp Meta webhook elsewhere
 * in this codebase (HMAC over the raw request body), Billplz signs a
 * specific string built from the payload's OWN fields:
 *
 *   1. Take every field except `x_signature`.
 *   2. Sort the field names alphabetically.
 *   3. Join as "key=value" pairs with "|".
 *   4. HMAC-SHA256 that string with the collection's X Signature Key
 *      (a separate secret from the API secret key, found in the Billplz
 *      dashboard under the collection's settings).
 *   5. Compare the hex digest to the `x_signature` field, constant-time.
 *
 * This means it works identically whether the fields came from a
 * form-encoded webhook body or a `billplz[...]`-prefixed redirect query
 * string, as long as the caller has already stripped the `billplz[...]`
 * wrapper down to bare field names before calling this. Kept as a pure
 * function (no NestJS/Injectable) so it can be unit tested without any
 * DI wiring, and so both the webhook and redirect code paths can share it.
 */
export function verifyBillplzSignature(fields: Record<string, string | undefined>, signatureKey: string): boolean {
  if (!signatureKey) return false;
  const provided = fields['x_signature'];
  if (!provided) return false;

  const sourceString = Object.keys(fields)
    .filter((key) => key !== 'x_signature')
    .sort()
    .map((key) => `${key}=${fields[key] ?? ''}`)
    .join('|');

  const expected = createHmac('sha256', signatureKey).update(sourceString).digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(provided, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Billplz redirect query params arrive prefixed, e.g. `billplz[id]`,
 * `billplz[paid]`, `billplz[x_signature]`. Strips the wrapper so the
 * result can be passed straight to verifyBillplzSignature(), which knows
 * nothing about where the fields came from.
 */
export function unwrapBillplzRedirectParams(query: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    const match = /^billplz\[(.+)\]$/.exec(key);
    if (match && typeof value === 'string') {
      result[match[1]] = value;
    }
  }
  return result;
}
