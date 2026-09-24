/**
 * DI token for whichever PaymentProviderAdapter is currently bound — see
 * PaymentsModule. A Symbol (not a string or the interface itself, which
 * doesn't exist at runtime) so it can't collide with any other provider
 * token in the app.
 */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

/**
 * Which adapter PaymentsModule binds PAYMENT_PROVIDER to. Only 'mock'
 * exists until Phase 21 adds a real provider and its own value here —
 * deliberately not defaulting to a not-yet-built provider name, so an
 * unset/misconfigured env in production fails loud (via the module's
 * useFactory) rather than silently falling back to the mock.
 */
export const PAYMENT_PROVIDER_NAME = process.env.PAYMENT_PROVIDER || 'mock';
