import { createHash } from 'crypto';

/**
 * Publish only after legal review and replacing every [PLACEHOLDER].
 * Bump version whenever a published policy's wording changes. Acceptance
 * records snapshot the SHA-256 hash so later edits cannot rewrite history.
 */
const POLICY_TEXT: Record<string, { title: string; version: string; requiredAtSignup: boolean; text: string }> = {
  TERMS_AND_CONDITIONS: {
    title: 'Terms and Conditions', version: '1.0.0', requiredAtSignup: true,
    text: 'RsSmart SaaS Terms and Conditions. Effective date: [EFFECTIVE DATE]. Legal entity: [FULL LEGAL ENTITY AND REGISTRATION NUMBER]. These terms govern access to and use of RsSmart. The customer is responsible for accurate company details, authorized users, account security, lawful use, and compliance with applicable laws. Service availability, permitted use, suspension, liability, dispute handling, and termination must be governed by the final lawyer-reviewed agreement. Do not publish until all placeholders are completed and the final terms are approved.',
  },
  PRIVACY_POLICY: {
    title: 'Privacy Policy', version: '1.0.0', requiredAtSignup: true,
    text: 'RsSmart Privacy Policy. Effective date: [EFFECTIVE DATE]. Data controller/contact: [LEGAL ENTITY, ADDRESS, PRIVACY EMAIL]. Explain categories of personal data, purposes, lawful bases where applicable, disclosures, retention, security, cross-border transfers, data-subject rights and complaint routes. Complete this notice against actual production data flows and Malaysian legal requirements before publication.',
  },
  ACCEPTABLE_USE_POLICY: {
    title: 'Acceptable Use Policy', version: '1.0.0', requiredAtSignup: true,
    text: 'RsSmart Acceptable Use Policy. Customers must not use the service for unlawful activity, unauthorized access, fraud, malware, abusive traffic, infringement, or attempts to bypass tenant isolation, security controls, or subscription limits. RsSmart may investigate credible abuse and apply proportionate restrictions as permitted by the final agreement and applicable law.',
  },
  REFUND_AND_CANCELLATION_POLICY: {
    title: 'Refund and Cancellation Policy', version: '1.0.0', requiredAtSignup: true,
    text: 'RsSmart Refund and Cancellation Policy. Before purchase, disclose the selected plan, price, billing interval, renewal terms, cancellation process, refund eligibility, and contact route. Do not imply that statutory rights are waived. Complete the operational rules and have them reviewed before enabling paid subscriptions.',
  },
  DATA_PROTECTION_POLICY: {
    title: 'Data Protection and Processing Notice', version: '1.0.0', requiredAtSignup: true,
    text: 'RsSmart Data Protection Notice. Describe customer and processor responsibilities, purposes and duration of processing, data types, data-subject categories, subprocessors, security measures, assistance with rights requests, incident cooperation, retention and deletion. A separate Data Processing Agreement may be required for business customers. Complete against real operations and legal review.',
  },
};

export type PolicyKey = keyof typeof POLICY_TEXT;

export function listPublishedPolicies() {
  return Object.entries(POLICY_TEXT).map(([key, policy]) => ({
    key,
    title: policy.title,
    version: policy.version,
    requiredAtSignup: policy.requiredAtSignup,
    text: policy.text,
    contentHash: createHash('sha256').update(policy.text, 'utf8').digest('hex'),
  }));
}

export function getRequiredSignupPolicies() {
  return listPublishedPolicies().filter((policy) => policy.requiredAtSignup);
}

export function getPolicy(key: string) {
  return listPublishedPolicies().find((policy) => policy.key === key);
}
