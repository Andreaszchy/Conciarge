/**
 * Phase 0 Security Specification Test Suite (Dirty Dozen Verification)
 * Validates that every adversarial payload violates the Firestore Security Rules invariants.
 */

export interface AdversarialCase {
  id: number;
  name: string;
  collection: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  expected: 'PERMISSION_DENIED';
  payload?: Record<string, unknown>;
  ruleGuard: string;
}

export const DIRTY_DOZEN_CASES: AdversarialCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Survey Create',
    collection: '/surveys/survey_01',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { ownerId: 'victim_uid', hotelName: 'Hotel Fake' },
    ruleGuard: 'incoming().ownerId == request.auth.uid',
  },
  {
    id: 2,
    name: 'Shadow Ghost Field Injection',
    collection: '/surveys/survey_02',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { ownerId: 'user_a', hotelName: 'Hotel Test', isAdmin: true },
    ruleGuard: 'data.keys().hasOnly([...])',
  },
  {
    id: 3,
    name: 'Path Variable ID Poisoning',
    collection: '/surveys/' + 'a'.repeat(140) + '!@#',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    ruleGuard: 'isValidId(surveyId)',
  },
  {
    id: 4,
    name: 'Unverified Email Survey Mutation',
    collection: '/surveys/survey_04',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    ruleGuard: 'request.auth.token.email_verified == true',
  },
  {
    id: 5,
    name: 'Immutable Field Mutation on Update',
    collection: '/surveys/survey_05',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { ownerId: 'new_owner', createdAt: 'forged' },
    ruleGuard: 'incoming().ownerId == existing().ownerId && incoming().createdAt == existing().createdAt',
  },
  {
    id: 6,
    name: 'Client Timestamp Forgery',
    collection: '/surveys/survey_06/responses/resp_06',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { submittedAt: '2020-01-01T00:00:00Z' },
    ruleGuard: 'incoming().submittedAt == request.time',
  },
  {
    id: 7,
    name: 'Submission to Paused Survey',
    collection: '/surveys/paused_survey/responses/resp_07',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    ruleGuard: 'get(parent).data.status == "active"',
  },
  {
    id: 8,
    name: 'Orphaned Response Without Parent Survey',
    collection: '/surveys/non_existent/responses/resp_08',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    ruleGuard: 'exists(/databases/$(database)/documents/surveys/$(surveyId))',
  },
  {
    id: 9,
    name: 'Survey Owner Hijacking in Response',
    collection: '/surveys/active_survey/responses/resp_09',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { surveyOwnerId: 'attacker_uid' },
    ruleGuard: 'incoming().surveyOwnerId == get(parent).data.ownerId',
  },
  {
    id: 10,
    name: 'PII Leak via Unauthorized Response Read',
    collection: '/surveys/active_survey/responses/resp_10',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    ruleGuard: 'isSignedIn() && existing().surveyOwnerId == request.auth.uid',
  },
  {
    id: 11,
    name: 'Oversized Denial-of-Wallet Comment Payload',
    collection: '/surveys/active_survey/responses/resp_11',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { openComment: 'x'.repeat(5000) },
    ruleGuard: 'data.openComment.size() <= 2500',
  },
  {
    id: 12,
    name: 'Blanket Survey Enumeration',
    collection: '/surveys',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    ruleGuard: 'isSignedIn() && existing().ownerId == request.auth.uid',
  },
];
