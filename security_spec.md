# Security Specification — Deaf Contact Record App (Phase 3C Shared Workspace)

## 1. Data Invariants & Security Architecture

1. **Shared Workspace Boundary**:
   - Shared data lives under `/workspaces/{workspaceId}/...` (`people`, `visits`, `territories`).
   - The initial target workspace is `"default"`.
   - All shared subcollection access is gated strictly by a confirmed membership document at `/workspaces/{workspaceId}/members/{userId}` where `status == "approved"`.
2. **Approval Status Invariant**:
   - Only `status == "approved"` allows read and write operations on shared data.
   - Statuses `"pending"`, `"revoked"`, missing documents, or unauthenticated requests are strictly rejected (`PERMISSION_DENIED`).
3. **No Client-Side Membership/Workspace Mutations**:
   - Workspace root documents (`/workspaces/{workspaceId}`) and member documents (`/workspaces/{workspaceId}/members/{memberId}`) cannot be created, updated, or deleted by client SDKs (`allow create, update, delete: if false`).
   - Membership approval is managed out-of-band via Firebase Console or Admin SDK.
4. **Referential Integrity**:
   - Visit creation under `/workspaces/{workspaceId}/visits/{visitId}` requires that `personId` refers to an existing document at `/workspaces/{workspaceId}/people/{personId}`.
   - Contact creation or territory update targeting `territoryId` requires that the territory document exists at `/workspaces/{workspaceId}/territories/{territoryId}` (or is null/omitted).
5. **No Client Deletion for People & Territories (Integrity Protection)**:
   - Client deletion of `people` is disabled (`allow delete: if false`) to prevent orphaned visit history.
   - Client deletion of `territories` is disabled (`allow delete: if false`) to prevent broken territory assignments.
   - Visit deletion is permitted for approved members to remove mistaken visit entries.
6. **Immutable Fields & Audit Trail**:
   - `id`, `workspaceId`, `createdBy`, and `createdAt` are strictly immutable on update.
   - `lastUpdatedBy` must match `request.auth.uid`.
   - `createdAt` and `updatedAt` must be Firestore Timestamps matching `request.time`.
7. **Type & Bounds Validation**:
   - Strings, identifiers, coordinates (`-90 <= latitude <= 90`, `-180 <= longitude <= 180`), and remark lengths are strictly checked to prevent Denial-of-Wallet or injection attacks.
8. **Catch-All Default Deny**:
   - `match /{document=**} { allow read, write: if false; }` ensures all unmapped roots remain sealed.

---

## 2. Standardized Member Document Specification

- **Document Path**: `/workspaces/{workspaceId}/members/{userId}`  
  *(where `{userId}` matches the member's Firebase Authentication UID)*
- **Required Fields**:
  - `userId` (string): Firebase Authentication UID of the member.
  - `email` (string): Registered email address of the user.
  - `status` (string): Membership status — must be `"approved"` to grant workspace access (also supports `"pending"`, `"revoked"`).
  - `role` (string): User role within workspace (`"member"` or `"admin"`).
  - `createdAt` (timestamp): Document creation timestamp.
  - `updatedAt` (timestamp): Document last update timestamp.
- **Optional Fields**:
  - `displayName` (string): Name or alias of the member.

---

## 3. Firebase Console Manual Provisioning Instructions

When provisioning members or workspaces manually in the Firebase Console:

1. **Workspace Root Document**:
   - Collection: `workspaces`
   - Document ID: `default`
   - Fields:
     - `id` (type: `string`): `default`
     - `name` (type: `string`): `Deaf Ministry Default Workspace`
     - `createdAt` (type: `timestamp`): Select current date and time
     - `updatedAt` (type: `timestamp`): Select current date and time

2. **Member Document**:
   - Collection: `workspaces` -> Document: `default` -> Subcollection: `members`
   - Document ID: `<AUTHENTICATION_UID>` *(Copy the UID directly from Firebase Authentication > Users table)*
   - Fields:
     - `userId` (type: `string`): `<AUTHENTICATION_UID>` *(Must match the document ID)*
     - `email` (type: `string`): `publisher@example.com`
     - `status` (type: `string`): `approved` *(Case-sensitive; must be exactly "approved")*
     - `role` (type: `string`): `member` *(or "admin")*
     - `createdAt` (type: `timestamp`): Select current date and time
     - `updatedAt` (type: `timestamp`): Select current date and time

> **CRITICAL TIMESTAMP INSTRUCTION**:  
> In the Firebase Console UI, **always select `timestamp` from the field type dropdown**.  
> Do **NOT** enter `"[SERVER_TIMESTAMP]"` or `"2026-10-09T00:00:00Z"` with type `string`. Firestore rules enforce `is timestamp`, and a literal string will fail evaluation.

---

## 4. The Shared Workspace "Dirty Dozen" Threat Scenarios

1. **SW-1: Unauthenticated Read/Write to Workspace** — DENIED
2. **SW-2: Authenticated but Unapproved User Access** — DENIED
3. **SW-3: Pending Member Access** — DENIED
4. **SW-4: Revoked Member Access** — DENIED
5. **SW-5: Member Self-Approval / Privilege Escalation** — DENIED
6. **SW-6: Cross-Workspace Snooping** — DENIED
7. **SW-7: Cross-Workspace WorkspaceId Tampering** — DENIED
8. **SW-8: Audit Identity Spoofing (Forged `createdBy`)** — DENIED
9. **SW-9: Tampering with Immutable Fields on Update** — DENIED
10. **SW-10: Shadow Field Injection** — DENIED
11. **SW-11: Broken Referential Integrity (Orphaned Visit Creation)** — DENIED
12. **SW-12: Client-side Deletion of People or Territories** — DENIED (New Phase 3C protection)
