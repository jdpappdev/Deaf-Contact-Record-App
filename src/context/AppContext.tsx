import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { Person, Visit, Territory, ActiveTab, PersonInput, VisitInput, TerritoryInput } from '../types';
import {
  personService,
  visitService,
  territoryService,
  photoService,
  syncQueueService,
} from '../services/dataService';
import {
  auth,
  signInWithEmailAccount,
  sendPasswordReset,
  signOutAccount,
  getFriendlyAuthErrorMessage,
} from '../services/firebase';
import {
  processOutboxQueue,
  pullAndReconcileSharedData,
  subscribeToSharedWorkspace,
  reconcileLocalOnlyData,
  PullResult,
  PushResult,
} from '../services/sharedSyncService';
import { AuthPromptModal } from '../components/common/AuthPromptModal';

export interface ToastInfo {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export type CloudSyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

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

  // Authorization & Read-Only Guest Mode
  canMutate: boolean;
  requestAuthGate: (actionName?: string) => boolean;
  openAuthPrompt: (actionName?: string) => void;
  closeAuthPrompt: () => void;

  // Firebase Auth & Shared Workspace Sync
  user: FirebaseUser | null;
  isAuthLoading: boolean;
  isSyncing: boolean;
  cloudSyncStatus: CloudSyncStatus;
  pendingSyncCount: number;
  lastPullResult: PullResult | null;
  lastPushResult: PushResult | null;
  signIn: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  syncAllToCloud: () => Promise<PushResult>;
  pullFromCloud: () => Promise<PullResult>;
  reconcileLocalRecords: () => Promise<{ reconciledPeople: number; reconciledVisits: number; reconciledTerritories: number }>;

  // Person actions (protected)
  savePerson: (data: PersonInput) => Promise<Person>;
  deletePerson: (id: string) => Promise<void>;

  // Visit actions (protected)
  getVisitsForPerson: (personId: string) => Visit[];
  getLatestVisitForPerson: (personId: string) => Visit | null;
  saveVisit: (data: VisitInput) => Promise<Visit>;
  deleteVisit: (id: string) => Promise<void>;

  // Territory actions (protected)
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

  // Auth gate modal state
  const [isAuthPromptOpen, setIsAuthPromptOpen] = useState(false);
  const [authPromptAction, setAuthPromptAction] = useState('modify records');

  // Firebase state
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>('idle');
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [lastPullResult, setLastPullResult] = useState<PullResult | null>(null);
  const [lastPushResult, setLastPushResult] = useState<PushResult | null>(null);

  // Authoritative authorization flag: only authenticated users can mutate
  const canMutate = !!user;

  const openAuthPrompt = useCallback((actionName = 'modify records') => {
    setAuthPromptAction(actionName);
    setIsAuthPromptOpen(true);
  }, []);

  const closeAuthPrompt = useCallback(() => {
    setIsAuthPromptOpen(false);
  }, []);

  const requestAuthGate = useCallback((actionName = 'modify records'): boolean => {
    if (canMutate) {
      return true;
    }
    openAuthPrompt(actionName);
    return false;
  }, [canMutate, openAuthPrompt]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updatePendingCount = useCallback(async () => {
    try {
      const count = await syncQueueService.countPending();
      setPendingSyncCount(count);
    } catch {
      // Safe fallback
    }
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
      await updatePendingCount();
    } catch (err) {
      console.error('Failed to load local data from IndexedDB:', err);
      showToast('Error loading local data. Please refresh.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast, updatePendingCount]);


  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setIsAuthLoading(false);
        if (currentUser) {
          setCloudSyncStatus('synced');
          processOutboxQueue(currentUser, true).then(() => {
            updatePendingCount();
          }).catch((err) => console.warn('Outbox processing error on login:', err));
        } else {
          setCloudSyncStatus('idle');
        }
      },
      (error) => {
        console.error('Firebase Auth state error:', error);
        setIsAuthLoading(false);
      }
    );
    return () => unsubscribe();
  }, [updatePendingCount]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Real-time synchronization subscription for shared workspace
  useEffect(() => {
    const unsub = subscribeToSharedWorkspace('default', () => {
      refreshData();
    });
    return () => {
      unsub();
    };
  }, [refreshData]);

  // Online / offline reconnect sync handler
  useEffect(() => {
    const handleOnline = () => {
      if (user) {
        setCloudSyncStatus('syncing');
        processOutboxQueue(user, true)
          .then(() => {
            setCloudSyncStatus('synced');
            updatePendingCount();
            refreshData();
          })
          .catch(() => setCloudSyncStatus('error'));
      }
    };

    const handleOffline = () => {
      setCloudSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user, updatePendingCount, refreshData]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        setIsAuthLoading(true);
        const signedInUser = await signInWithEmailAccount(email, password);
        showToast(`Signed in as ${signedInUser.email}`, 'success');
        setCloudSyncStatus('synced');
      } catch (err: unknown) {
        const message = getFriendlyAuthErrorMessage(err);
        showToast(message, 'error');
        throw new Error(message);
      } finally {
        setIsAuthLoading(false);
      }
    },
    [showToast]
  );

  const resetPassword = useCallback(
    async (email: string) => {
      try {
        await sendPasswordReset(email);
        showToast('Password reset email sent. Please check your inbox.', 'success');
      } catch (err: unknown) {
        const message = getFriendlyAuthErrorMessage(err);
        showToast(message, 'error');
        throw new Error(message);
      }
    },
    [showToast]
  );

  const signOut = useCallback(async () => {
    try {
      await signOutAccount();
      showToast('Signed out successfully. Guest read-only mode active.', 'info');
      setCloudSyncStatus('idle');
    } catch (err: unknown) {
      const message = getFriendlyAuthErrorMessage(err);
      showToast(message, 'error');
    }
  }, [showToast]);

  const syncAllToCloud = useCallback(async (): Promise<PushResult> => {
    if (!user) {
      openAuthPrompt('push local changes to the cloud');
      showToast('Sign in to push changes', 'info');
      return {
        success: false,
        processedCount: 0,
        failedCount: 0,
        errorMessage: 'Authentication required to push to cloud.',
      };
    }
    try {
      setIsSyncing(true);
      setCloudSyncStatus('syncing');

      const result = await processOutboxQueue(user, true);
      setLastPushResult(result);
      await updatePendingCount();

      if (result.success) {
        setCloudSyncStatus('synced');
        showToast(
          result.processedCount > 0
            ? `Successfully pushed ${result.processedCount} queued change(s) to cloud`
            : 'Outbox is clean. All changes are already synchronized',
          'success'
        );
      } else {
        setCloudSyncStatus('error');
        showToast(`Push completed with ${result.failedCount} error(s): ${result.errorMessage}`, 'error');
      }
      return result;
    } catch (err: unknown) {
      console.error('Cloud sync error:', err);
      setCloudSyncStatus('error');
      const msg = err instanceof Error ? err.message : 'Cloud push failed.';
      showToast(msg, 'error');
      return {
        success: false,
        processedCount: 0,
        failedCount: 1,
        errorMessage: msg,
      };
    } finally {
      setIsSyncing(false);
    }
  }, [user, openAuthPrompt, updatePendingCount, showToast]);

  // Pull is public and available to signed-out guests and members alike
  const pullFromCloud = useCallback(async (): Promise<PullResult> => {
    try {
      setIsSyncing(true);
      setCloudSyncStatus('syncing');

      const result = await pullAndReconcileSharedData('default');
      setLastPullResult(result);
      await refreshData();

      if (result.success) {
        setCloudSyncStatus('synced');
        showToast(
          `Pulled ${result.totalRemoteCount} records (${result.addedCount} added, ${result.updatedCount} updated, ${result.unchangedCount} unchanged${result.skippedCount > 0 ? `, ${result.skippedCount} skipped` : ''})`,
          'success'
        );
      } else if (result.isPartial) {
        setCloudSyncStatus('error');
        showToast(
          `Partial pull completed: ${result.totalRemoteCount} records (${result.errorMessage})`,
          'info'
        );
      } else {
        setCloudSyncStatus('error');
        showToast(`Failed to pull records: ${result.errorMessage}`, 'error');
      }
      return result;
    } catch (err: unknown) {
      console.error('Pull from cloud error:', err);
      setCloudSyncStatus('error');
      const msg = err instanceof Error ? err.message : 'Failed to pull from cloud.';
      showToast(msg, 'error');
      return {
        success: false,
        addedCount: 0,
        updatedCount: 0,
        unchangedCount: 0,
        skippedCount: 0,
        totalRemoteCount: 0,
        peopleCount: 0,
        visitsCount: 0,
        territoriesCount: 0,
        errorMessage: msg,
      };
    } finally {
      setIsSyncing(false);
    }
  }, [refreshData, showToast]);

  const reconcileLocalRecords = useCallback(async () => {
    if (!user) {
      openAuthPrompt('reconcile local records to the shared workspace');
      showToast('Sign in to reconcile local data', 'error');
      throw new Error('Not authorized');
    }
    try {
      setIsSyncing(true);
      setCloudSyncStatus('syncing');

      const result = await reconcileLocalOnlyData(user, 'default');
      await refreshData();
      setCloudSyncStatus('synced');
      showToast(
        `Reconciled ${result.reconciledPeople} contacts, ${result.reconciledVisits} visits, ${result.reconciledTerritories} territories to workspace`,
        'success'
      );
      return result;
    } catch (err) {
      setCloudSyncStatus('error');
      showToast('Reconciliation failed. Local records preserved.', 'error');
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [user, openAuthPrompt, refreshData, showToast]);

  // Protected Person Save: intercept if signed out
  const savePerson = useCallback(
    async (data: PersonInput) => {
      if (!user) {
        openAuthPrompt(data.id ? 'edit contacts' : 'add contacts');
        showToast('Sign in to save contacts.', 'info');
        throw new Error('Authentication required to save contacts.');
      }

      const personData: PersonInput = {
        ...data,
        workspaceId: 'default',
        createdBy: data.createdBy || user.uid,
        lastUpdatedBy: user.uid,
        isLocalOnly: false,
      };

      const saved = await personService.save(personData);
      await refreshData();

      await syncQueueService.enqueue({
        entityType: 'person',
        entityId: saved.id,
        operationType: 'upsert',
        payload: saved as unknown as Record<string, unknown>,
        workspaceId: 'default',
      });
      await updatePendingCount();
      processOutboxQueue(user, true).then(() => updatePendingCount()).catch(() => {});

      return saved;
    },
    [user, openAuthPrompt, showToast, refreshData, updatePendingCount]
  );

  // Protected Person Delete
  const deletePerson = useCallback(
    async (id: string) => {
      if (!user) {
        openAuthPrompt('delete contacts');
        showToast('Sign in to delete contacts.', 'info');
        throw new Error('Authentication required to delete contacts.');
      }

      await personService.delete(id);
      if (selectedPersonId === id) {
        setSelectedPersonId(null);
      }
      await refreshData();
      await updatePendingCount();
    },
    [user, openAuthPrompt, showToast, selectedPersonId, refreshData, updatePendingCount]
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

  // Protected Visit Save
  const saveVisit = useCallback(
    async (data: VisitInput) => {
      if (!user) {
        openAuthPrompt(data.id ? 'edit visits' : 'record visits');
        showToast('Sign in to record visits.', 'info');
        throw new Error('Authentication required to record visits.');
      }

      const visitData: VisitInput = {
        ...data,
        workspaceId: 'default',
        createdBy: data.createdBy || user.uid,
        lastUpdatedBy: user.uid,
        isLocalOnly: false,
      };

      const saved = await visitService.save(visitData);
      await refreshData();

      await syncQueueService.enqueue({
        entityType: 'visit',
        entityId: saved.id,
        operationType: 'upsert',
        payload: saved as unknown as Record<string, unknown>,
        workspaceId: 'default',
      });
      await updatePendingCount();
      processOutboxQueue(user, true).then(() => updatePendingCount()).catch(() => {});

      return saved;
    },
    [user, openAuthPrompt, showToast, refreshData, updatePendingCount]
  );

  // Protected Visit Delete
  const deleteVisit = useCallback(
    async (id: string) => {
      if (!user) {
        openAuthPrompt('delete visits');
        showToast('Sign in to delete visits.', 'info');
        throw new Error('Authentication required to delete visits.');
      }

      await visitService.delete(id);
      await refreshData();

      await syncQueueService.enqueue({
        entityType: 'visit',
        entityId: id,
        operationType: 'delete',
        workspaceId: 'default',
      });
      await updatePendingCount();
      processOutboxQueue(user, true).then(() => updatePendingCount()).catch(() => {});
    },
    [user, openAuthPrompt, showToast, refreshData, updatePendingCount]
  );

  // Protected Territory Save
  const saveTerritory = useCallback(
    async (data: TerritoryInput) => {
      if (!user) {
        openAuthPrompt(data.id ? 'edit territories' : 'create territories');
        showToast('Sign in to create or edit territories.', 'info');
        throw new Error('Authentication required to manage territories.');
      }

      const terrData: TerritoryInput = {
        ...data,
        workspaceId: 'default',
        createdBy: data.createdBy || user.uid,
        lastUpdatedBy: user.uid,
        isLocalOnly: false,
      };

      const saved = await territoryService.save(terrData);
      await refreshData();

      await syncQueueService.enqueue({
        entityType: 'territory',
        entityId: saved.id,
        operationType: 'upsert',
        payload: saved as unknown as Record<string, unknown>,
        workspaceId: 'default',
      });
      await updatePendingCount();
      processOutboxQueue(user, true).then(() => updatePendingCount()).catch(() => {});

      return saved;
    },
    [user, openAuthPrompt, showToast, refreshData, updatePendingCount]
  );

  // Protected Territory Delete
  const deleteTerritory = useCallback(
    async (id: string) => {
      if (!user) {
        openAuthPrompt('delete territories');
        showToast('Sign in to delete territories.', 'info');
        throw new Error('Authentication required to delete territories.');
      }

      await territoryService.delete(id);
      await refreshData();
      await updatePendingCount();
    },
    [user, openAuthPrompt, showToast, refreshData, updatePendingCount]
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
        canMutate,
        requestAuthGate,
        openAuthPrompt,
        closeAuthPrompt,
        user,
        isAuthLoading,
        isSyncing,
        cloudSyncStatus,
        pendingSyncCount,
        lastPullResult,
        lastPushResult,
        signIn,
        resetPassword,
        signOut,
        syncAllToCloud,
        pullFromCloud,
        reconcileLocalRecords,
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
      {/* Universal Auth Prompt Modal */}
      <AuthPromptModal
        isOpen={isAuthPromptOpen}
        onClose={closeAuthPrompt}
        actionName={authPromptAction}
      />
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
