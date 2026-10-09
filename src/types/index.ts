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
}

export interface Visit {
  id: string;
  personId: string;
  visitedAt: string;
  remarks: string;
  createdAt: string;
  updatedAt: string;
}

export interface Territory {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface PhotoAsset {
  id: string;
  blob?: Blob;
  dataUrl?: string;
  mimeType: string;
  createdAt: string;
}

export type PersonInput = Omit<Person, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
export type VisitInput = Omit<Visit, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
export type TerritoryInput = Omit<Territory, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

export interface BackupData {
  version: 1;
  exportedAt: string;
  people: Person[];
  visits: Visit[];
  territories: Territory[];
  photos: PhotoAsset[];
}

export type ActiveTab = 'records' | 'territories' | 'map' | 'settings';
