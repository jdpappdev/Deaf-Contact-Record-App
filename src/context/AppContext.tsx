import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Person, Visit, Territory, ActiveTab, PersonInput, VisitInput, TerritoryInput } from '../types';
import {
  personService,
  visitService,
  territoryService,
  photoService,
} from '../services/dataService';

export interface ToastInfo {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextType {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  selectedPersonId: string | null;
  setSelectedPersonId: (id: string | null) => void;
  people: Person[];
  territories: Territory[];
  visits: Visit[];
  isLoading: boolean;
  toasts: ToastInfo[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;
  refreshData: () => Promise<void>;
  
  // Person actions
  savePerson: (data: PersonInput) => Promise<Person>;
  deletePerson: (id: string) => Promise<void>;

  // Visit actions
  getVisitsForPerson: (personId: string) => Visit[];
  getLatestVisitForPerson: (personId: string) => Visit | null;
  saveVisit: (data: VisitInput) => Promise<Visit>;
  deleteVisit: (id: string) => Promise<void>;

  // Territory actions
  saveTerritory: (data: TerritoryInput) => Promise<Territory>;
  deleteTerritory: (id: string) => Promise<void>;

  // Photo actions
  loadPhotoUrl: (photoRef: string | null) => Promise<string | null>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('records');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastInfo[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const [allPeople, allTerritories, allVisits] = await Promise.all([
        personService.getAll(),
        territoryService.getAll(),
        visitService.getAll(),
      ]);
      setPeople(allPeople);
      setTerritories(allTerritories);
      setVisits(allVisits);
    } catch (err) {
      console.error('Failed to load local data from IndexedDB:', err);
      showToast('Error loading local data. Please refresh.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const savePerson = useCallback(
    async (data: PersonInput) => {
      const saved = await personService.save(data);
      await refreshData();
      return saved;
    },
    [refreshData]
  );

  const deletePerson = useCallback(
    async (id: string) => {
      await personService.delete(id);
      if (selectedPersonId === id) {
        setSelectedPersonId(null);
      }
      await refreshData();
    },
    [selectedPersonId, refreshData]
  );

  const getVisitsForPerson = useCallback(
    (personId: string) => {
      return visits
        .filter((v) => v.personId === personId)
        .sort((a, b) => new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime());
    },
    [visits]
  );

  const getLatestVisitForPerson = useCallback(
    (personId: string) => {
      const personVisits = getVisitsForPerson(personId);
      return personVisits.length > 0 ? personVisits[0] : null;
    },
    [getVisitsForPerson]
  );

  const saveVisit = useCallback(
    async (data: VisitInput) => {
      const saved = await visitService.save(data);
      await refreshData();
      return saved;
    },
    [refreshData]
  );

  const deleteVisit = useCallback(
    async (id: string) => {
      await visitService.delete(id);
      await refreshData();
    },
    [refreshData]
  );

  const saveTerritory = useCallback(
    async (data: TerritoryInput) => {
      const saved = await territoryService.save(data);
      await refreshData();
      return saved;
    },
    [refreshData]
  );

  const deleteTerritory = useCallback(
    async (id: string) => {
      await territoryService.delete(id);
      await refreshData();
    },
    [refreshData]
  );

  const loadPhotoUrl = useCallback(async (photoRef: string | null): Promise<string | null> => {
    if (!photoRef) return null;
    try {
      const photo = await photoService.getPhoto(photoRef);
      if (!photo) return null;
      if (photo.blob) {
        return URL.createObjectURL(photo.blob);
      }
      if (photo.dataUrl) {
        return photo.dataUrl;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        selectedPersonId,
        setSelectedPersonId,
        people,
        territories,
        visits,
        isLoading,
        toasts,
        showToast,
        dismissToast,
        refreshData,
        savePerson,
        deletePerson,
        getVisitsForPerson,
        getLatestVisitForPerson,
        saveVisit,
        deleteVisit,
        saveTerritory,
        deleteTerritory,
        loadPhotoUrl,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
