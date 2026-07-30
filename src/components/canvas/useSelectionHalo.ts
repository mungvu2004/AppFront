import { useState, useCallback, useEffect } from 'react';

export function useSelectionHalo() {
  const [isSelected, setIsSelected] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const [pulseCount, setPulseCount] = useState(0);

  const selectObject = useCallback((violation: boolean = false) => {
    setIsSelected(true);
    if (violation) {
      setIsPulsing(true);
      setPulseCount(0);
    } else {
      setIsPulsing(false);
    }
  }, []);

  const deselectObject = useCallback(() => {
    setIsSelected(false);
    setIsPulsing(false);
    setPulseCount(0);
  }, []);

  // Handle pulse cycles
  useEffect(() => {
    if (isPulsing && pulseCount < 3) {
      const timer = setTimeout(() => {
        setPulseCount((c) => c + 1);
      }, 1800);
      return () => clearTimeout(timer);
    } else if (pulseCount >= 3) {
      setIsPulsing(false);
    }
  }, [isPulsing, pulseCount]);

  return {
    isSelected,
    isPulsing,
    selectObject,
    deselectObject,
  };
}
