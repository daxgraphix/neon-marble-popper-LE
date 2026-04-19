import { useCallback } from 'react';

export type HapticType = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';

const hapticPatterns: Record<HapticType, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  selection: 5,
  success: [10, 50, 10],
  warning: [20, 30, 20],
  error: [30, 50, 30, 50, 30],
};

export function useHapticFeedback() {
  const isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  const trigger = useCallback((type: HapticType) => {
    if (!isSupported) return;
    const pattern = hapticPatterns[type];
    navigator.vibrate(pattern);
  }, [isSupported]);

  const haptics = {
    shoot: () => trigger('light'),
    match: () => trigger('success'),
    powerUp: () => trigger('medium'),
    error: () => trigger('error'),
    combo: (combo: number) => {
      if (combo >= 10) trigger('heavy');
      else if (combo >= 5) trigger('medium');
      else trigger('light');
    },
    menu: () => trigger('selection'),
    levelComplete: () => trigger('success'),
    gameOver: () => trigger('warning'),
  };

  const vibrate = useCallback((ms: number) => {
    if (!isSupported) return;
    navigator.vibrate(ms);
  }, [isSupported]);

  const vibratePattern = useCallback((pattern: number | number[]) => {
    if (!isSupported) return;
    navigator.vibrate(pattern);
  }, [isSupported]);

  return {
    isSupported,
    trigger,
    haptics,
    vibrate,
    vibratePattern,
  };
}