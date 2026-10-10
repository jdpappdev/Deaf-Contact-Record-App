export interface Person {
  id: string;
  name: string;
  photoRef: string | null;
  latitude: number | null;
  longitude: number | null;
  territoryId: string | null;
  messengerUrl: string | null;
  createdAt: string;
  updatedAt: string;
  workspaceId?: string;
  createdBy?: string;
  lastUpdatedBy?: string;
  isLocalOnly?: boolean;
}

export interface Visit {
  id: string;
  personId: string;
  visitedAt: string;
  remarks: string;
  createdAt: string;
  updatedAt: string;
  workspaceId?: string;
  createdBy?: string;
  lastUpdatedBy?: string;
  isLocalOnly?: boolean;
}

export interface Territory {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  workspaceId?: string;
  createdBy?: string;
  lastUpdatedBy?: string;
  isLocalOnly?: boolean;
}

export interface PhotoAsset {
  id: string;
  blob?: Blob;
  dataUrl?: string;
  mimeType: string;
  createdAt: string;
}

export type PersonInput = Omit<Person, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: string; updatedAt?: string };
export type VisitInput = Omit<Visit, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: string; updatedAt?: string };
export type TerritoryInput = Omit<Territory, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: string; updatedAt?: string };

export interface BackupData {
  version: 1;
  exportedAt: string;
  people: Person[];
  visits: Visit[];
  territories: Territory[];
  photos: PhotoAsset[];
}

export type ActiveTab = 'records' | 'territories' | 'map' | 'settings';

/**
 * Sync Queue Model (Phase 2A sync preparation)
 * Defines a privacy-conscious pending operation structure without duplicate personal data.
 */
export type SyncEntityType = 'person' | 'visit' | 'territory';

export type SyncOperationType = 'upsert' | 'delete';

export type SyncOperationStatus = 'pending' | 'processing' | 'failed' | 'completed';

export interface SyncOperation {
  /** Stable unique operation identifier (UUID) */
  id: string;
  /** Entity domain type: 'person' | 'visit' | 'territory' */
  entityType: SyncEntityType;
  /** Primary identifier of the targeted entity */
  entityId: string;
  /** Operation type: 'upsert' (covers create/update) or 'delete' */
  operationType: SyncOperationType;
  /** ISO timestamp when the local operation was created */
  createdAt: string;
  /** Lifecycle status of the pending operation */
  status: SyncOperationStatus;
  /** Number of failed sync attempts */
  retryCount: number;
  /** ISO timestamp of the last attempt, if any */
  lastAttemptAt?: string | null;
  /** Error message from the last failed attempt, if any */
  errorMessage?: string | null;
  /** Client-side timestamp ensuring conflict resolution sequencing */
  clientTimestamp: string;
  /** Optional serialized payload snapshot for upsert operations */
  payload?: Record<string, unknown> | null;
  /** Targeted workspace identifier (defaults to 'default') */
  workspaceId?: string;
}
