import React, { useCallback, useRef, useEffect, useState } from 'react';

export interface TouchState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isDragging: boolean;
  startTime: number;
}

export interface UseTouchControlsOptions {
  onTap?: () => void;
  onDrag?: (deltaX: number, deltaY: number) => void;
  onDragEnd?: (velocityX: number, velocityY: number) => void;
  swipeThreshold?: number;
  enabled?: boolean;
}

const DEFAULT_SWIPE_THRESHOLD = 30;

export function useTouchControls(options: UseTouchControlsOptions = {}) {
  const {
    onTap,
    onDrag,
    onDragEnd,
    swipeThreshold = DEFAULT_SWIPE_THRESHOLD,
    enabled = true,
  } = options;

  const touchState = useRef<TouchState>({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    isDragging: false,
    startTime: 0,
  });

  const [isTouching, setIsTouching] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent | TouchEvent) => {
    if (!enabled) return;
    e.preventDefault();
    
    const touch = 'touches' in e ? e.touches[0] : (e as TouchEvent).targetTouches[0];
    if (!touch) return;

    touchState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      isDragging: true,
      startTime: Date.now(),
    };
    setIsTouching(true);
  }, [enabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent | TouchEvent) => {
    if (!enabled || !touchState.current.isDragging) return;
    e.preventDefault();
    
    const touch = 'touches' in e ? e.touches[0] : (e as TouchEvent).targetTouches[0];
    if (!touch) return;

    touchState.current.currentX = touch.clientX;
    touchState.current.currentY = touch.clientY;

    const deltaX = touch.clientX - touchState.current.startX;
    const deltaY = touch.clientY - touchState.current.startY;

    if (onDrag) {
      onDrag(deltaX, deltaY);
    }
  }, [enabled, onDrag]);

  const handleTouchEnd = useCallback((e: React.TouchEvent | TouchEvent) => {
    if (!enabled) return;
    e.preventDefault();

    const state = touchState.current;
    const endTime = Date.now();
    const duration = endTime - state.startTime;

    const deltaX = state.currentX - state.startX;
    const deltaY = state.currentY - state.startY;
    const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2);

    if (distance < swipeThreshold) {
      if (onTap) {
        onTap();
      }
    } else {
      const velocityX = duration > 0 ? deltaX / duration : 0;
      const velocityY = duration > 0 ? deltaY / duration : 0;

      if (onDragEnd) {
        onDragEnd(velocityX, velocityY);
      }
    }

    state.isDragging = false;
    setIsTouching(false);
  }, [enabled, onTap, onDragEnd, swipeThreshold]);

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    isTouching,
    touchState,
  };
}

export function usePinchZoom(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const [scale, setScale] = useState(1);
  const lastDistance = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastDistance.current = Math.sqrt(dx * dx + dy * dy);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (lastDistance.current > 0) {
        const newScale = Math.max(0.5, Math.min(2, scale * (distance / lastDistance.current)));
        setScale(newScale);
      }
      lastDistance.current = distance;
    }
  }, [scale]);

  const handleTouchEnd = useCallback(() => {
    lastDistance.current = 0;
  }, []);

  return {
    scale,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}
