import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { initDatabase } from '@/database/database';

export const DB_STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
};

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [dbStatus, setDbStatus] = useState(DB_STATUS.IDLE);
  const [dbError, setDbError] = useState(null);
  const initGen = useRef(0);

  const initializeApp = useCallback(async () => {
    const gen = ++initGen.current;
    setDbStatus(DB_STATUS.LOADING);
    setDbError(null);
    try {
      await initDatabase();
      if (gen !== initGen.current) return;
      setDbStatus(DB_STATUS.READY);
    } catch (error) {
      if (gen !== initGen.current) return;
      console.error('[AppContext] Database initialization failed:', error);
      setDbStatus(DB_STATUS.ERROR);
      setDbError(error);
    }
  }, []);

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  const value = {
    dbStatus,
    dbError,
    isDbReady: dbStatus === DB_STATUS.READY,
    retryInit: initializeApp,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
