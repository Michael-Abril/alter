'use client';

import { createContext, useContext, useRef, useEffect, type ReactNode, type RefObject } from 'react';

interface ScrollState {
  offset: number;
}

const defaultState: ScrollState = { offset: 0 };
const ScrollCtx = createContext<RefObject<ScrollState>>({ current: defaultState });

export function useScrollOffset() {
  return useContext(ScrollCtx);
}

export function ScrollProvider({ children }: { children: ReactNode }) {
  const state = useRef<ScrollState>({ offset: 0 });

  useEffect(() => {
    function onScroll() {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      state.current.offset = maxScroll > 0 ? window.scrollY / maxScroll : 0;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <ScrollCtx.Provider value={state}>
      {children}
    </ScrollCtx.Provider>
  );
}
