# Mobile App Improvement Specification

## Neon Marble Popper - Mobile Enhancement Document

---

## Small Screen Device Optimization Guide

### Recommended Settings for Small Screens (< 380px)

| Element | Current | Recommended |
|---------|---------|--------------|
| HUD Font Size | 14-16px | 12-14px |
| Button Size | 44px min | 48px min |
| Padding | 8px | 4-6px |
| Gap between elements | 8px | 4px |
| Canvas Margin | 16px | 8px |

### Touch Target Guidelines (Apple HIG)
- Minimum: 44x44 points
- Recommended: 48x48 points for frequently used
- Icons: 24x24 in content, 44x44 in navigation

### Safe Area Implementation
```css
/* iOS Safe Areas */
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
padding-left: env(safe-area-inset-left);
padding-right: env(safe-area-inset-right);
```

### Small Screen Best Practices
1. Use `dvh` (dynamic viewport height) for full screen
2. Avoid fixed heights - use `min-height` instead
3. Use `clamp()` for fluid typography
4. Implement gesture-based navigation (swipe)
5. Reduce animation complexity on low-end devices

### Performance Considerations
- Use `will-change` sparingly
- Implement frame rate monitoring
- Use `IntersectionObserver` for off-screen elements
- Lazy load non-critical resources

---

## 1. Mobile Responsiveness & Fluid Layouts

### 1.1 Viewport Configuration
```html
<!-- Add to index.html head -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#050505">
```

### 1.2 Responsive Breakpoints
| Breakpoint | Device Type | Canvas Scale | UI Adjustments |
|------------|-------------|--------------|----------------|
| < 375px | Small phones | Scale to fit | Compact HUD, larger buttons |
| 375-767px | Standard phones | Scale to fit | Standard HUD |
| 768-1023px | Large phones/Tablets | 85% scale | Expanded HUD, side panels |
| 1024-1279px | Tablets | 75% scale | Full HUD, achievement sidebar |
| ≥ 1280px | Desktop | Fixed 800x600 | Max-width container |

### 1.3 Orientation Handling
```css
/* CSS Media Queries */
@media (orientation: portrait) {
  .game-container { flex-direction: column; }
  .hud-controls { bottom: env(safe-area-inset-bottom); }
}

@media (orientation: landscape) {
  .game-container { flex-direction: row; }
  .hud-controls { right: env(safe-area-inset-right); }
}

/* Landscape warning for tall phones */
@media (orientation: portrait) and (max-height: 400px) {
  .landscape-warning { display: flex; }
  .game-container { display: none; }
}
```

### 1.4 Aspect Ratio Support
- Support 16:9 to 21:9 aspect ratios
- Dynamic canvas scaling maintaining 4:3 ratio
- Letterboxing with themed borders for extreme ratios
- Safe area insets for notched devices:
  ```css
  padding: env(safe-area-inset-top) env(safe-area-inset-right) 
           env(safe-area-inset-bottom) env(safe-area-inset-left);
  ```

---

## 2. Touch Controls & Gesture Interactions

### 2.1 Touch Target Standards
| Element | Minimum Size | Current Size | Required Change |
|---------|-------------|--------------|-----------------|
| Buttons | 44x44px | ~36x36px | Increase to 48x48px |
| Power-up icons | 44x44px | 32x32px | Increase to 48x48px |
| Menu items | 44x44px | Variable | Increase all to 48x48px |
| Settings toggles | 44x44px | 40x40px | Increase to 52x28px |

### 2.2 Touch Event Handlers
```typescript
// src/hooks/useTouchControls.ts
import { useCallback, useRef } from 'react';

interface TouchState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isDragging: boolean;
}

export function useTouchControls(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const touchState = useRef<TouchState>({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    isDragging: false,
  });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    touchState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      isDragging: true,
    };
    
    // Trigger haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (!touchState.current.isDragging) return;
    
    const touch = e.touches[0];
    touchState.current.currentX = touch.clientX;
    touchState.current.currentY = touch.clientY;
    
    // Calculate angle from center for aiming
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const centerX = CANVAS_WIDTH / 2;
      const centerY = CANVAS_HEIGHT / 2;
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      
      const x = (touch.clientX - rect.left) * scaleX;
      const y = (touch.clientY - rect.top) * scaleY;
      setTargetAngle(Math.atan2(y - centerY, x - centerX));
    }
  }, [canvasRef]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const state = touchState.current;
    
    // Detect tap vs swipe
    const deltaX = state.currentX - state.startX;
    const deltaY = state.currentY - state.startY;
    const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2);
    
    if (distance < 10) {
      // It's a tap - shoot!
      handleClick();
      if (navigator.vibrate) {
        navigator.vibrate(20);
      }
    }
    
    state.isDragging = false;
  }, []);

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    touchState,
  };
}
```

### 2.3 Swipe Mechanics
```typescript
// Swipe detection thresholds
const SWIPE_THRESHOLD = 50; // pixels
const SWIPE_VELOCITY_THRESHOLD = 0.3;

interface SwipeDirection {
  direction: 'up' | 'down' | 'left' | 'right' | 'none';
  velocity: number;
}

// Add to TouchControls
const detectSwipe = (startX: number, startY: number, endX: number, endY: number, timestamp: number): SwipeDirection => {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  
  if (Math.max(absX, absY) < SWIPE_THRESHOLD) {
    return { direction: 'none', velocity: 0 };
  }
  
  const direction = absX > absY 
    ? (deltaX > 0 ? 'right' : 'left')
    : (deltaY > 0 ? 'down' : 'up');
  
  return {
    direction,
    velocity: Math.max(absX, absY) / timestamp,
  };
};
```

### 2.4 Drag-and-Drop Functionality
```typescript
// For power-up selection
interface DraggableItem {
  id: string;
  type: PowerUpType;
  onDragStart: () => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (target: HTMLElement | null) => void;
}

const useDragAndDrop = () => {
  const dragItem = useRef<DraggableItem | null>(null);
  const dragPosition = useRef({ x: 0, y: 0 });

  const handleDragStart = useCallback((item: DraggableItem, e: React.TouchEvent | MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    dragItem.current = item;
    dragPosition.current = { x: clientX, y: clientY };
    item.onDragStart();
    
    if (navigator.vibrate) {
      navigator.vibrate(15);
    }
  }, []);

  const handleDragMove = useCallback((e: React.TouchEvent | MouseEvent) => {
    if (!dragItem.current) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    dragPosition.current = { x: clientX, y: clientY };
    dragItem.current.onDragMove(clientX, clientY);
  }, []);

  const handleDragEnd = useCallback((e: React.TouchEvent | MouseEvent) => {
    if (!dragItem.current) return;
    
    // Detect drop target
    const clientX = 'changedTouches' in e 
      ? e.changedTouches[0].clientX 
      : (e as MouseEvent).clientX;
    const clientY = 'changedTouches' in e 
      ? e.changedTouches[0].clientY 
      : (e as MouseEvent).clientY;
    
    // Find element at drop position
    const elementAtPoint = document.elementFromPoint(clientX, clientY);
    dragItem.current.onDragEnd(elementAtPoint as HTMLElement | null);
    
    if (navigator.vibrate) {
      navigator.vibrate(25);
    }
    
    dragItem.current = null;
  }, []);

  return { handleDragStart, handleDragMove, handleDragEnd, dragPosition };
};
```

---

## 3. Mobile-First Design System

### 3.1 Design Tokens
```typescript
// src/styles/design-tokens.css
:root {
  /* Colors - Neon Theme */
  --color-primary: #ec4899;
  --color-primary-glow: rgba(236, 72, 153, 0.5);
  --color-secondary: #8b5cf6;
  --color-accent: #00e5ff;
  
  /* Typography */
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-size-xs: 0.75rem;    /* 12px */
  --font-size-sm: 0.875rem;   /* 14px */
  --font-size-base: 1rem;     /* 16px */
  --font-size-lg: 1.125rem;   /* 18px */
  --font-size-xl: 1.25rem;    /* 20px */
  --font-size-2xl: 1.5rem;    /* 24px */
  --font-size-3xl: 1.875rem;  /* 30px */
  --font-size-4xl: 2.25rem;   /* 36px */
  
  /* Spacing */
  --spacing-1: 0.25rem;   /* 4px */
  --spacing-2: 0.5rem;    /* 8px */
  --spacing-3: 0.75rem;   /* 12px */
  --spacing-4: 1rem;      /* 16px */
  --spacing-5: 1.25rem;   /* 20px */
  --spacing-6: 1.5rem;    /* 24px */
  --spacing-8: 2rem;      /* 32px */
  
  /* Touch Targets - MINIMUM 44px */
  --touch-target-min: 2.75rem;   /* 44px */
  --touch-target-comfortable: 3rem; /* 48px */
  --touch-target-large: 3.5rem;  /* 56px */
  
  /* Border Radius */
  --radius-sm: 0.375rem;   /* 6px */
  --radius-md: 0.5rem;     /* 8px */
  --radius-lg: 0.75rem;     /* 12px */
  --radius-xl: 1rem;        /* 16px */
  --radius-2xl: 1.5rem;     /* 24px */
  --radius-full: 9999px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
  --shadow-glow: 0 0 20px var(--color-primary-glow);
  
  /* Safe Area */
  --safe-area-top: env(safe-area-inset-top, 0px);
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-left: env(safe-area-inset-left, 0px);
  --safe-area-right: env(safe-area-inset-right, 0px);
}
```

### 3.2 Thumb-Friendly Navigation Zones
```
┌─────────────────────────────────────────────┐
│           TOP SAFE AREA (Status Bar)        │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │                                     │   │
│  │         GAME CANVAS                 │   │
│  │                                     │   │
│  │  ◄──── SWIPE TO AIM ────►          │   │
│  │         TAP TO SHOOT                │   │
│  │                                     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌───────┐              ┌───────────────┐  │
│  │ Score │              │ Power-ups     │  │
│  └───────┘              └───────────────┘  │
│           THUMB ZONE (Bottom 200px)         │
│  ┌─────────────────────────────────────────┐│
│  │   ⚙️ Home    Pause    Settings    🏆   ││
│  └─────────────────────────────────────────┘│
│           BOTTOM SAFE AREA (Home Indicator) │
└─────────────────────────────────────────────┘

ZONE LEGEND:
- Red: Primary interaction zone (tap, swipe)
- Blue: Quick access zone (thumb rest position)
- Green: Navigation zone (bottom navigation bar)
```

### 3.3 Mobile Component Library
```typescript
// src/components/MobileButton.tsx
interface MobileButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export function MobileButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  icon,
  fullWidth = false,
}: MobileButtonProps) {
  const sizeClasses = {
    sm: 'min-h-[40px] px-3 py-2 text-sm',
    md: 'min-h-[48px] px-5 py-3 text-base',
    lg: 'min-h-[56px] px-7 py-4 text-lg',
  };

  const variantClasses = {
    primary: 'bg-primary text-white shadow-glow active:scale-95',
    secondary: 'bg-secondary text-white active:scale-95',
    ghost: 'bg-transparent text-primary active:bg-primary/10',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${fullWidth ? 'w-full' : ''}
        rounded-xl font-semibold
        transition-all duration-150
        touch-manipulation
        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${!disabled ? 'active:scale-95' : ''}
      `}
      style={{ minHeight: '48px' }} // Enforce 44px minimum
    >
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
}
```

---

## 4. Full-Screen Immersive Experience

### 4.1 Viewport Configuration
```typescript
// src/hooks/useFullScreen.ts
import { useEffect, useCallback, useState } from 'react';

export function useFullScreen() {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(
      document.fullscreenEnabled ||
      (document as any).webkitFullscreenEnabled ||
      (document as any).mozFullScreenEnabled ||
      (document as any).msFullscreenEnabled
    );
  }, []);

  const enterFullScreen = useCallback(async () => {
    if (!isSupported) return;
    
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        await (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).msRequestFullscreen) {
        await (elem as any).msRequestFullscreen();
      }
      setIsFullScreen(true);
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, [isSupported]);

  const exitFullScreen = useCallback(async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }
      setIsFullScreen(false);
    } catch (err) {
      console.error('Exit fullscreen error:', err);
    }
  }, []);

  useEffect(() => {
    const handleChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  return { isFullScreen, isSupported, enterFullScreen, exitFullScreen };
}
```

### 4.2 Notch & Dynamic Island Handling
```css
/* Dynamic Island and Notch safe areas */
.notch-safe {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

/* For game canvas - avoid notch area */
.canvas-wrapper {
  padding-top: max(12px, env(safe-area-inset-top));
  padding-bottom: max(12px, env(safe-area-inset-bottom));
}

/* Dynamic Island specific */
@media (min-width: 390px) and (max-width: 844px) {
  .dynamic-island-space {
    height: max(20px, env(safe-area-inset-top));
  }
}
```

### 4.3 System Bar Hiding
```typescript
// Hide on game start
useEffect(() => {
  if (gameState === 'playing') {
    // Hide navigation bar on Android
    if (navigator as any & { standalone?: boolean }) {
      document.body.style.overflow = 'hidden';
    }
    
    // For Android, use CSS
    document.documentElement.style.setProperty(
      '--viewport-fit', 
      'cover'
    );
  }
}, [gameState]);
```

---

## 5. Performance Optimization

### 5.1 Device Capability Detection
```typescript
// src/hooks/useDeviceCapabilities.ts
interface DeviceCapabilities {
  isHighPerformance: boolean;
  maxCanvasSize: number;
  prefersReducedMotion: boolean;
  supportsHaptics: boolean;
  supportsWebGL: boolean;
  pixelRatio: number;
  memoryClass: 'low' | 'medium' | 'high';
}

export function useDeviceCapabilities(): DeviceCapabilities {
  const [capabilities, setCapabilities] = useState<DeviceCapabilities>({
    isHighPerformance: true,
    maxCanvasSize: 800,
    prefersReducedMotion: false,
    supportsHaptics: false,
    supportsWebGL: true,
    pixelRatio: 1,
    memoryClass: 'high',
  });

  useEffect(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    const isHighPerf = (() => {
      const cores = navigator.hardwareConcurrency || 4;
      const memory = (navigator as any).deviceMemory || 4;
      return cores >= 4 && memory >= 4;
    })();

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    
    setCapabilities({
      isHighPerformance: isHighPerf,
      maxCanvasSize: isHighPerf ? 800 : 600,
      prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      supportsHaptics: 'vibrate' in navigator,
      supportsWebGL: !!gl,
      pixelRatio: isHighPerf ? pixelRatio : Math.min(pixelRatio, 1.5),
      memoryClass: isHighPerf ? 'high' : 'medium',
    });
  }, []);

  return capabilities;
}
```

### 5.2 Adaptive Quality Settings
```typescript
// Adaptive rendering based on device
const getAdaptiveSettings = (capabilities: DeviceCapabilities) => {
  if (capabilities.memoryClass === 'low') {
    return {
      particleCount: 15,
      trailLength: 10,
      shadowQuality: 'none',
      animationFPS: 30,
      enableParticles: true,
    };
  }
  
  if (capabilities.memoryClass === 'medium') {
    return {
      particleCount: 20,
      trailLength: 15,
      shadowQuality: 'low',
      animationFPS: 45,
      enableParticles: true,
    };
  }
  
  // High performance
  return {
    particleCount: 25,
    trailLength: 22,
    shadowQuality: 'high',
    animationFPS: 60,
    enableParticles: true,
  };
};
```

### 5.3 Battery-Conscious Rendering
```typescript
// Use visibility API to pause when backgrounded
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Pause game, reduce memory
      setIsPaused(true);
      cancelAnimationFrame(requestRef.current);
    } else if (!document.hidden && gameState === 'playing') {
      // Resume
      setIsPaused(false);
      requestRef.current = requestAnimationFrame(update);
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, [gameState]);

// RequestAnimationFrame with battery awareness
const useBatteryOptimizedAnimation = (callback: (time: number) => void) => {
  const rafRef = useRef<number>();
  const capabilities = useDeviceCapabilities();
  
  const start = useCallback(() => {
    const animate = (time: number) => {
      callback(time);
      
      // Reduce frame rate on low battery if available
      if ((navigator as any).getBattery) {
        (navigator as any).getBattery().then((battery: any) => {
          if (battery.level < 0.2 && !battery.charging) {
            // Skip frames when low battery
            setTimeout(() => {
              rafRef.current = requestAnimationFrame(animate);
            }, 1000 / 30);
            return;
          }
          rafRef.current = requestAnimationFrame(animate);
        });
      } else {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
  }, [callback]);

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
  }, []);

  return { start, stop };
};
```

---

## 6. Smooth Animations (Mobile-Optimized)

### 6.1 Animation Library Configuration
```typescript
// src/lib/animations.ts
import { motion, Variants } from 'motion/react';

// Optimized spring animations for mobile
export const springConfig = {
  responsive: {
    type: 'spring',
    stiffness: 400,
    damping: 30,
    mass: 0.8,
  },
  snappy: {
    type: 'spring',
    stiffness: 500,
    damping: 40,
    mass: 0.5,
  },
  gentle: {
    type: 'spring',
    stiffness: 200,
    damping: 25,
    mass: 1,
  },
};

// Reduced motion support
export const prefersReducedMotion = () => 
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Mobile-optimized variants
export const mobileVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 25,
    }
  },
  exit: { 
    opacity: 0, 
    y: -20,
    transition: { duration: 0.15 }
  },
};

// Stagger children for lists
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

export const listItem: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: springConfig.responsive,
  },
};
```

---

## 7. Accessibility Considerations

### 7.1 Screen Reader Support
```typescript
// src/hooks/useScreenReader.ts
import { useCallback, useRef } from 'react';

interface Announcement {
  message: string;
  priority: 'polite' | 'assertive';
}

export function useScreenReader() {
  const announcerRef = useRef<HTMLDivElement>(null);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!announcerRef.current) return;
    
    // Clear previous announcement
    announcerRef.current.innerText = '';
    
    // Set new announcement with slight delay for screen readers
    setTimeout(() => {
      if (announcerRef.current) {
        announcerRef.current.innerText = message;
        announcerRef.current.setAttribute('aria-live', priority);
      }
    }, 100);
  }, []);

  const announceGameEvent = useCallback((event: string, detail?: string) => {
    const messages: Record<string, string> = {
      'shoot': 'Marble shot',
      'match': `${detail} marbles matched and cleared!`,
      'powerup': `Power-up activated: ${detail}`,
      'level-complete': `Level ${detail} complete! Congratulations!`,
      'game-over': 'Game over. Final score: ' + detail,
      'combo': `${detail}x combo achieved!`,
      'achievement': `Achievement unlocked: ${detail}`,
    };
    
    if (messages[event]) {
      announce(messages[event], event === 'game-over' ? 'assertive' : 'polite');
    }
  }, [announce]);

  return { announce, announceGameEvent, announcerRef };
}

// Add to App component:
/*
<div 
  ref={announcerRef}
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"
  style={{
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
  }}
/>
*/
```

### 7.2 Adjustable Text Sizes
```css
/* Base accessibility - respect system font size */
html {
  font-size: 100%; /* Respect user preference */
}

/* Text size classes */
.text-size-xs { font-size: 0.75rem; }
.text-size-sm { font-size: 0.875rem; }
.text-size-base { font-size: 1rem; }
.text-size-lg { font-size: 1.125rem; }
.text-size-xl { font-size: 1.25rem; }

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 7.3 High Contrast Modes
```css
/* High contrast support */
@media (prefers-contrast: high) {
  :root {
    --color-primary: #ff1493;
    --color-background: #000000;
    --color-text: #ffffff;
    --color-border: #ffffff;
  }
  
  .game-button {
    border-width: 3px;
    border-color: currentColor;
  }
  
  .hud-text {
    font-weight: bold;
    text-shadow: none;
  }
}

/* Custom high contrast toggle */
[data-contrast="high"] {
  --color-primary: #ff1493;
  --color-background: #000000;
  --color-text: #ffffff;
  --color-border: #ffffff;
  
  .glow-effect {
    filter: none;
  }
  
  .particle {
    mix-blend-mode: difference;
  }
}
```

### 7.4 Haptic Feedback System
```typescript
// src/hooks/useHapticFeedback.ts
type HapticType = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';

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
  const isSupported = 'vibrate' in navigator;

  const trigger = useCallback((type: HapticType) => {
    if (!isSupported) return;
    
    const pattern = hapticPatterns[type];
    navigator.vibrate(pattern);
  }, [isSupported]);

  // Game-specific haptics
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
  };

  return { isSupported, trigger, haptics };
}
```

---

## 8. Offline Functionality

### 8.1 Service Worker Setup
```typescript
// public/sw.js - Service Worker for offline support
const CACHE_NAME = 'neon-marble-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Cache-first strategy for game assets
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((fetchResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, fetchResponse.clone());
          return fetchResponse;
        });
      });
    })
  );
});
```

### 8.2 Local Storage for Offline Progress
```typescript
// src/lib/offlineStorage.ts
interface OfflineProgress {
  maxLevel: number;
  highScore: number;
  achievements: string[];
  settings: GameSettings;
  lastSyncTime: number;
}

const STORAGE_KEY = 'neon-pop-offline-data';

export const saveOfflineProgress = (progress: OfflineProgress): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (e) {
    console.error('Failed to save offline progress:', e);
  }
};

export const loadOfflineProgress = (): OfflineProgress | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Failed to load offline progress:', e);
    return null;
  }
};

export const clearOfflineProgress = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};
```

### 8.3 Web App Manifest
```json
// public/manifest.json
{
  "name": "Neon Marble Popper",
  "short_name": "Neon Marble",
  "description": "A neon-themed marble popping puzzle game",
  "start_url": "/",
  "display": "fullscreen",
  "orientation": "any",
  "background_color": "#050505",
  "theme_color": "#ec4899",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "categories": ["games", "entertainment"],
  "lang": "en"
}
```

---

## 9. Implementation Priority Matrix

| Feature | Priority | Effort | Impact |
|---------|----------|--------|--------|
| Touch controls & gestures | P0 | Medium | High |
| Viewport/safe area config | P0 | Low | High |
| Responsive breakpoints | P0 | Medium | High |
| 44px touch targets | P0 | Low | High |
| Haptic feedback | P1 | Low | Medium |
| Screen reader support | P1 | Medium | Medium |
| Full-screen mode | P1 | Low | Medium |
| Offline support | P2 | Medium | Medium |
| Adaptive quality | P2 | Medium | Medium |
| High contrast mode | P2 | Low | Low |
| Text size adjustment | P2 | Low | Low |

---

## 10. Testing Checklist

### Device Testing Matrix
- [ ] iPhone SE (2020) - iOS 15
- [ ] iPhone 12 Mini - iOS 17 (notch)
- [ ] iPhone 14 Pro - iOS 17 (Dynamic Island)
- [ ] iPhone 15 Pro Max - iOS 18
- [ ] Samsung Galaxy S21 - Android 12
- [ ] Samsung Galaxy S23 Ultra - Android 14
- [ ] Google Pixel 7 - Android 14
- [ ] OnePlus 9 - Android 13
- [ ] iPad Mini (6th gen) - iPadOS 17
- [ ] iPad Pro 11" - iPadOS 17

### Orientation Testing
- [ ] Portrait - Phone
- [ ] Landscape - Phone
- [ ] Portrait - Tablet
- [ ] Landscape - Tablet
- [ ] Split view - iPad

### Accessibility Testing
- [ ] VoiceOver (iOS)
- [ ] TalkBack (Android)
- [ ] Reduced motion enabled
- [ ] High contrast mode
- [ ] Large text scaling (200%)

---

*Document Version: 1.0*
*Last Updated: 2026-04-19*
*Project: Neon Marble Popper*
