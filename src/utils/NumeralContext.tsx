import React, { createContext, useContext, useState } from 'react';
import {
  loadNumeralMode,
  saveNumeralMode,
  type NumeralMode,
} from './numberFormat';

interface NumeralContextValue {
  numeralMode: NumeralMode;
  setNumeralMode: (mode: NumeralMode) => void;
}

const NumeralContext = createContext<NumeralContextValue>({
  numeralMode: 'en',
  setNumeralMode: () => {},
});

export function NumeralProvider({ children }: { children: React.ReactNode }) {
  const [numeralMode, setNumeralModeState] = useState<NumeralMode>(() => loadNumeralMode());

  const setNumeralMode = (mode: NumeralMode) => {
    const saved = saveNumeralMode(mode);
    setNumeralModeState(saved);
  };

  return (
    <NumeralContext.Provider value={{ numeralMode, setNumeralMode }}>
      {children}
    </NumeralContext.Provider>
  );
}

export function useNumeralMode() {
  return useContext(NumeralContext);
}
