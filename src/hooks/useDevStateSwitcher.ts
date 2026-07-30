/// <reference types="vite/client" />
import { useState } from 'react';

export function useDevStateSwitcher() {
  const [expanded, setExpanded] = useState(false);
  const [isDev] = useState(import.meta.env.DEV);

  const toggle = () => setExpanded(prev => !prev);

  return {
    isDev,
    expanded,
    toggle
  };
}
