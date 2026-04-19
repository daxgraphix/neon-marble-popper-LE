import { useCallback, useRef, useEffect } from 'react';

interface Announcement {
  message: string;
  priority: 'polite' | 'assertive';
  timestamp: number;
}

export function useScreenReader() {
  const announcerRef = useRef<HTMLDivElement | null>(null);
  const queueRef = useRef<Announcement[]>([]);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (announcerRef.current) {
        announcerRef.current.remove();
      }
    };
  }, []);

  const createAnnouncer = useCallback(() => {
    if (announcerRef.current) return announcerRef.current;

    const announcer = document.createElement('div');
    announcer.setAttribute('role', 'status');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    `;
    document.body.appendChild(announcer);
    announcerRef.current = announcer;
    return announcer;
  }, []);

  const processQueue = useCallback(() => {
    if (isProcessingRef.current || queueRef.current.length === 0) return;
    isProcessingRef.current = true;

    const announcer = createAnnouncer();
    const next = queueRef.current.shift();
    if (next) {
      announcer.setAttribute('aria-live', next.priority);
      announcer.textContent = '';
      setTimeout(() => {
        if (announcerRef.current) {
          announcerRef.current.textContent = next.message;
        }
        isProcessingRef.current = false;
        if (queueRef.current.length > 0) {
          processQueue();
        }
      }, 100);
    }
  }, [createAnnouncer]);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    queueRef.current.push({
      message,
      priority,
      timestamp: Date.now(),
    });
    processQueue();
  }, [processQueue]);

  const announceGameEvent = useCallback((event: string, detail?: string | number) => {
    const messages: Record<string, string> = {
      shoot: 'Marble shot',
      match: detail ? `${detail} marbles matched and cleared` : 'Marbles matched and cleared',
      powerUp: detail ? `${detail} power-up activated` : 'Power-up activated',
      levelComplete: detail ? `Level ${detail} complete! Congratulations!` : 'Level complete!',
      gameOver: `Game over. Final score: ${detail || 0}`,
      combo: detail ? `${detail}x combo achieved!` : 'Combo achieved',
      achievement: detail ? `Achievement unlocked: ${detail}` : 'Achievement unlocked',
      pause: 'Game paused',
      resume: 'Game resumed',
      levelStart: detail ? `Level ${detail} starting` : 'Level starting',
      newHighScore: detail ? `New high score: ${detail} points` : 'New high score!',
    };

    if (messages[event]) {
      announce(messages[event], event === 'gameOver' ? 'assertive' : 'polite');
    }
  }, [announce]);

  return {
    announce,
    announceGameEvent,
    announcerRef: createAnnouncer(),
  };
}