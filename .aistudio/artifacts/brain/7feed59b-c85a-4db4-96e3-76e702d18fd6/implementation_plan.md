# Implementation Plan: Congregation-Wide Shared Architecture for Deaf Contact Record

This plan outlines the complete transition of the Deaf Contact Record application from isolated user-scoped paths (`/users/{userId}/...`) and legacy workspace paths (`/workspaces/default/...`) to a unified **congregation-wide shared model** under root collections (`/people`, `/visits`, `/territories`), while preserving private user profiles at `/users/{uid}`.

---

## 1. Verified Findings vs. Live Inspection Requirements

### Verified Findings (Codebase & Schema Inspection)
- **Current TypeScript Models** (`src/types.ts`):
  - `Person`: `id`, `name`, `territoryId`, `photoRef`, `photoDataUrl`, `latitude`, `longitude`, `messengerUrl`, `createdAt`, `updatedAt`, `createdBy`, `lastUpdatedBy`.
  - `Visit`: `id`, `personId`, `visitedAt`, `remarks`, `createdAt`, `updatedAt`, `createdBy`, `lastUpdatedBy`.
  - `Territory`: `id`, `name`, `createdAt`, `updatedAt`, `createdBy`, `lastUpdatedBy`.
- **Current Firestore Paths** (`src/services/sharedSyncService.ts`):
  - Currently writes to `/users/{userId}/people/{personId}`, `/users/{userId}/visits/{visitId}`, `/users/{userId}/territories/{territoryId}`.
- **Contact Photo Storage & 1 MiB Limit**:
  - Contact photos are stored as `photoDataUrl` (base64 compressed JPEG/PNG) directly inside the person document and/or locally via `photoService`.
  - Code enforcement caps `photoDataUrl` length at `400,000` characters (~300 KB raw bytes), safely staying below Firestore's 1 MiB document limit.
- **Outbox Queue**:
  - Durable IndexedDB outbox queue (`syncQueueService`) records offline mutations (`create`, `update`, `delete`) with retry logic.

### Live Firebase Inspection Requirements
- Verification of existing live cloud documents in `/workspaces/default/...` vs `/users/{userId}/...` vs `/people/...`.
- Verification of active deployed Firestore rules in the live Firebase console (though `firestore.rules` in repository is fully inspectable).

---

## 2. Target Firestore Paths & Access Policy

### Target Collections
- `/people/{personId}`: Congregation-wide shared contact records.
- `/visits/{visitId}`: Congregation-wide shared visit logs referencing `personId`.
- `/territories/{territoryId}`: Congregation-wide shared territory records.
- `/users/{uid}`: Private user profile data (e.g., settings, display name, email).

### Access Policy
1. **Public Read**: Anyone, including unauthenticated visitors, can read shared people, visits, and territories (`allow read: if true;`).
2. **Authenticated Write**: Any authenticated Firebase account (`request.auth != null`) can create, update, delete, import, and synchronize shared records (`allow write: if request.auth != null;`).
3. **Private Profiles**: User profiles at `/users/{uid}` are readable/writable only by the authenticated owner (`allow read, write: if request.auth != null && request.auth.uid == uid;`).
4. **No Editor Approval Gate**: No membership or editor approval workflow is required.

---

## 3. Security Rules Design (`firestore.rules`)

```cel
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    // Shared People Collection
    match /people/{personId} {
      allow read: if true;
      allow create, update: if isAuthenticated() 
        && request.resource.data.name is string
        && request.resource.data.name.size() <= 100
        && (!request.resource.data.keys().hasAll(['photoDataUrl']) || request.resource.data.photoDataUrl == null || request.resource.data.photoDataUrl.size() <= 400000);
      allow delete: if isAuthenticated();
    }

    // Shared Visits Collection
    match /visits/{visitId} {
      allow read: if true;
      allow create, update: if isAuthenticated()
        && request.resource.data.personId is string
        && request.resource.data.remarks is string
        && request.resource.data.remarks.size() <= 2000;
      allow delete: if isAuthenticated();
    }

    // Shared Territories Collection
    match /territories/{territoryId} {
      allow read: if true;
      allow create, update: if isAuthenticated()
        && request.resource.data.name is string
        && request.resource.data.name.size() <= 100;
      allow delete: if isAuthenticated();
    }

    // Private User Profiles
    match /users/{userId} {
      allow read, write: if isAuthenticated() && request.auth.uid == userId;
    }
  }
}
```

---

## 4. Migration Plan (Legacy Workspaces & User-Scoped Paths to Shared Root)

### Objectives
- Migrate records from legacy `/workspaces/default/people`, `/visits`, `/territories` and user-scoped `/users/{userId}/people`, `/visits`, `/territories` into root collections (`/people`, `/visits`, `/territories`).
- Preserve all IDs, timestamps, contact photos (`photoRef`, `photoDataUrl`), relationships, and audit metadata (`createdBy`, `lastUpdatedBy`).
- Handle conflicts deterministically (Last-Write-Wins based on `updatedAt` / server timestamps, or newer edit priority).

### Migration Routine Flow
1. **Durable Local Backup**: Prior to migration execution, export all local IndexedDB records to a JSON backup file/object in memory.
2. **Idempotent Upsert**:
   - Query all records from local IndexedDB (and optionally remote paths if online).
   - Upsert each record into root collections (`/people/{id}`, `/visits/{id}`, `/territories/{id}`).
   - If a document already exists at the root path, compare `updatedAt` timestamps (or fallback to local version if remote timestamp is older).
3. **Outbox Compatibility**:
   - Re-target outbox queue operations (`syncQueueService`) to target root collection endpoints instead of user-scoped paths.
4. **Rollback & Verification**:
   - If migration encounters failures, local IndexedDB remains intact; local repositories can be restored from the in-memory backup snapshot.
   - Run verification tests verifying total counts and data integrity.

---

## 5. Client-Side Service Refactoring (`src/services/sharedSyncService.ts`)

Update all Firestore service operations to point to top-level collections:
- `pushPersonToFirestore(person)` -> `/people/{personId}`
- `pushTerritoryToFirestore(territory)` -> `/territories/{territoryId}`
- `pushVisitToFirestore(visit)` -> `/visits/{visitId}`
- `deleteVisitFromFirestore(visitId)` -> `/visits/{visitId}`
- Real-time listeners (`onSnapshot`) subscribed to:
  - `collection(db, 'people')`
  - `collection(db, 'visits')`
  - `collection(db, 'territories')`

---

## 6. Implementation Phasing & Acceptance Criteria

### Phase 1: Security Rules & Schema Update
- Update `firestore.rules` with public read / authenticated write rules for root collections.
- Deploy rules via `deploy_firebase`.

### Phase 2: Service Layer Refactoring
- Modify `src/services/sharedSyncService.ts` to use root collections (`/people`, `/visits`, `/territories`).
- Update pull/push sync routines and real-time listeners.

### Phase 3: Migration & Outbox Alignment
- Implement migration helper to promote any local or legacy user records to root collections upon app load.
- Ensure offline outbox sync operations correctly target root collections.

### Phase 4: Verification & Testing
- Run `compile_applet` and `lint_applet` (`tsc --noEmit`).
- Verify unauthenticated visitor read access and authenticated user write access.
- Verify photo payload limits and sync recovery.

---

## Acceptance Criteria
1. Unauthenticated visitors can view all shared people, visits, and territories in real time.
2. Authenticated users can create, update, and delete shared records across devices.
3. Contact photos sync correctly without exceeding Firestore's 1 MiB document limit (`photoDataUrl` <= 400KB).
4. Outbox sync queue processes offline changes seamlessly against root collections.
5. Zero TypeScript or build errors (`compile_applet` and `lint_applet` pass successfully).
