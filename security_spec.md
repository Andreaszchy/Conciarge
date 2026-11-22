# Security Specification — AlbaStay Hotel Surveys

## 1. Data Invariants
1. **Survey Ownership & Integrity**: A survey in `/surveys/{surveyId}` can only be created, listed, updated, or deleted by its verified `ownerId == request.auth.uid`. `ownerId` and `createdAt` are immutable after creation.
2. **Public Guest Access Without Registration (Strict Scope)**: Unauthenticated guests may ONLY `get` a single survey by exact `surveyId` when `resource.data.status == 'active'`. Unauthenticated guests can NEVER `list` all surveys.
3. **Anonymous/Optional-Info Guest Submission**: Unauthenticated or authenticated guests may `create` a response in `/surveys/{surveyId}/responses/{responseId}` ONLY if the parent survey exists and has `status == 'active'`, AND `surveyOwnerId` strictly matches the parent survey's `ownerId`.
4. **PII Isolation on Responses**: Because responses may contain optional `guestEmail` and `guestName`, `get`, `list`, and `delete` on `/surveys/{surveyId}/responses/{responseId}` are strictly restricted to the survey owner (`resource.data.surveyOwnerId == request.auth.uid`). Responses are immutable (`update: false`).
5. **AI Analysis Ownership**: Automated opinion analyses in `/surveys/{surveyId}/analyses/{analysisId}` can only be created, read, listed, or deleted by the verified parent survey owner (`surveyOwnerId == request.auth.uid`).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing (Survey Create)**: Authenticated user A tries to create a survey with `ownerId: "user-B"`. -> MUST FAIL.
2. **Shadow Ghost Field (Survey Create)**: User A creates a survey including an undeclared field `isAdmin: true`. -> MUST FAIL via `keys().hasOnly(...)`.
3. **Oversized ID Poisoning**: Attacker targets `/surveys/<150-char-invalid-id!@#>` -> MUST FAIL via `isValidId()`.
4. **Unverified Email Write**: Authenticated user with `email_verified: false` tries to create or update a survey. -> MUST FAIL.
5. **Immutable Owner Tampering (Survey Update)**: User A tries to change `ownerId` or `createdAt` on update. -> MUST FAIL.
6. **Client Timestamp Forgery**: Payload submits a forged past `createdAt` or `submittedAt` instead of `request.time`. -> MUST FAIL.
7. **Paused Survey Response Injection**: Guest tries to submit a response to a survey with `status: 'paused'`. -> MUST FAIL via parent `get()` check.
8. **Orphaned Response Creation**: Guest tries to submit a response under a non-existent `surveyId`. -> MUST FAIL via parent `exists()`/`get()` check.
9. **Response Owner Hijacking**: Guest submits a response with `surveyOwnerId: "attacker-uid"` different from parent survey's `ownerId`. -> MUST FAIL.
10. **PII Leak via Response Read**: Unauthenticated guest or User B attempts `get` or `list` on User A's `/surveys/{surveyId}/responses`. -> MUST FAIL.
11. **Oversized Denial-of-Wallet Payload**: Guest submits a 10,000-character `openComment` or 50-question array. -> MUST FAIL via `.size()` caps.
12. **Blanket Survey Enumeration**: Unauthenticated guest or User B attempts `list` on `/surveys` without matching `ownerId == request.auth.uid`. -> MUST FAIL.
