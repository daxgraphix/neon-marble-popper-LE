import { useEffect, useState, useCallback } from 'react';

export interface DeviceCapabilities {
  isHighPerformance: boolean;
  maxCanvasSize: number;
  prefersReducedMotion: boolean;
  supportsHaptics: boolean;
  supportsWebGL: boolean;
  pixelRatio: number;
  memoryClass: 'low' | 'medium' | 'high';
  isMobile: boolean;
  isTablet: boolean;
  isLandscape: boolean;
  supportsFullScreen: boolean;
}

const DEFAULT_CAPABILITIES: DeviceCapabilities = {
  isHighPerformance: true,
  maxCanvasSize: 800,
  prefersReducedMotion: false,
  supportsHaptics: false,
  supportsWebGL: true,
  pixelRatio: 1,
  memoryClass: 'high',
  isMobile: false,
  isTablet: false,
  isLandscape: false,
  supportsFullScreen: false,
};

export function useDeviceCapabilities(): DeviceCapabilities {
  const [capabilities, setCapabilities] = useState<DeviceCapabilities>(DEFAULT_CAPABILITIES);

  const detectCapabilities = useCallback(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    const cores = navigator.hardwareConcurrency || 4;
    const memory = (navigator as any).deviceMemory || 4;
    const isHighPerf = cores >= 4 && memory >= 4;

    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isTablet = /ipad|android.*tablet|playbook|silk/i.test(userAgent);

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const supportsHaptics = 'vibrate' in navigator;

    const supportsFullScreen = !!(
      document.fullscreenEnabled ||
      (document as any).webkitFullscreenEnabled ||
      (document as any).mozFullScreenEnabled ||
      (document as any).msFullscreenEnabled
    );

    let memoryClass: 'low' | 'medium' | 'high' = 'high';
    if (memory < 2) memoryClass = 'low';
    else if (memory < 4) memoryClass = 'medium';

    const isLandscape = window.innerWidth > window.innerHeight;

    setCapabilities({
      isHighPerformance: isHighPerf,
      maxCanvasSize: isHighPerf ? 800 : 600,
      prefersReducedMotion,
      supportsHaptics,
      supportsWebGL: !!gl,
      pixelRatio: isHighPerf ? pixelRatio : Math.min(pixelRatio, 1.5),
      memoryClass,
      isMobile,
      isTablet: isTablet || (isMobile && window.innerWidth >= 768),
      isLandscape,
      supportsFullScreen,
    });
  }, []);

  useEffect(() => {
    detectCapabilities();

    const handleResize = () => detectCapabilities();
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    window.addEventListener('resize', handleResize);
    mediaQuery.addEventListener('change', detectCapabilities);

    return () => {
      window.removeEventListener('resize', handleResize);
      mediaQuery.removeEventListener('change', detectCapabilities);
    };
  }, [detectCapabilities]);

  return capabilities;
}

export function getAdaptiveSettings(capabilities: DeviceCapabilities) {
  if (capabilities.memoryClass === 'low') {
    return {
      particleCount: 15,
      trailLength: 10,
      shadowQuality: 'none' as const,
      animationFPS: 30,
      enableParticles: true,
      enableGlow: false,
    };
  }

  if (capabilities.memoryClass === 'medium') {
    return {
      particleCount: 20,
      trailLength: 15,
      shadowQuality: 'low' as const,
      animationFPS: 45,
      enableParticles: true,
      enableGlow: true,
    };
  }

  return {
    particleCount: 25,
    trailLength: 22,
    shadowQuality: 'high' as const,
    animationFPS: 60,
    enableParticles: true,
    enableGlow: true,
  };
}
