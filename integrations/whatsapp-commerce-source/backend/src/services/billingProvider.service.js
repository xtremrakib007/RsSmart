class MockBillingProvider {
  async createCustomer({ email, name, metadata }) {
    const id = `mock_cus_${Date.now()}`;
    return { id, email, status: 'active' };
  }
  async createSubscription({ customerId, planCode, trialDays = 14 }) {
    const id = `mock_sub_${Date.now()}`;
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + trialDays);
    return {
      id,
      status: trialDays > 0 ? 'trialing' : 'active',
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      trialStart: trialDays > 0 ? now.toISOString() : null,
      trialEnd: trialDays > 0 ? trialEnd.toISOString() : null,
    };
  }
  async cancelSubscription(providerSubscriptionId) {
    return { id: providerSubscriptionId, status: 'cancelled' };
  }
  async constructEvent(payload, signature, secret) {
    return payload;
  }
}

const providers = {
  mock: new MockBillingProvider(),
};

export const getBillingProvider = (providerName = 'mock') => {
  const provider = providers[providerName];
  if (!provider) throw new Error(`Billing provider "${providerName}" not configured.`);
  return provider;
};

export const registerBillingProvider = (name, instance) => {
  providers[name] = instance;
};
