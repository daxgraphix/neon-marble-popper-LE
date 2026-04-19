export interface GameSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  vibrationEnabled: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  textSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export interface OfflineProgress {
  maxLevel: number;
  highScore: number;
  achievements: string[];
  settings: GameSettings;
  lastPlayed: number;
  totalPlayTime: number;
  statistics: {
    totalGames: number;
    totalScore: number;
    totalMarblesCleared: number;
    bestCombo: number;
    longestStreak: number;
  };
}

const STORAGE_KEY = 'neon-pop-offline-data';

const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  musicEnabled: true,
  vibrationEnabled: true,
  reducedMotion: false,
  highContrast: false,
  textSize: 'md',
};

const DEFAULT_STATISTICS = {
  totalGames: 0,
  totalScore: 0,
  totalMarblesCleared: 0,
  bestCombo: 0,
  longestStreak: 0,
};

const DEFAULT_PROGRESS: OfflineProgress = {
  maxLevel: 1,
  highScore: 0,
  achievements: [],
  settings: DEFAULT_SETTINGS,
  lastPlayed: Date.now(),
  totalPlayTime: 0,
  statistics: DEFAULT_STATISTICS,
};

export function saveOfflineProgress(progress: OfflineProgress): boolean {
  try {
    const data = {
      ...progress,
      lastPlayed: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('Failed to save offline progress:', e);
    return false;
  }
}

export function loadOfflineProgress(): OfflineProgress | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data) as OfflineProgress;
    }
    return null;
  } catch (e) {
    console.error('Failed to load offline progress:', e);
    return null;
  }
}

export function getOfflineProgress(): OfflineProgress {
  const saved = loadOfflineProgress();
  if (saved) {
    return {
      ...DEFAULT_PROGRESS,
      ...saved,
      settings: { ...DEFAULT_SETTINGS, ...saved.settings },
      statistics: { ...DEFAULT_STATISTICS, ...saved.statistics },
    };
  }
  return { ...DEFAULT_PROGRESS };
}

export function clearOfflineProgress(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function updateHighScore(score: number): OfflineProgress {
  const progress = getOfflineProgress();
  if (score > progress.highScore) {
    progress.highScore = score;
    saveOfflineProgress(progress);
  }
  return progress;
}

export function updateLevelProgress(level: number): OfflineProgress {
  const progress = getOfflineProgress();
  if (level > progress.maxLevel) {
    progress.maxLevel = level;
    saveOfflineProgress(progress);
  }
  return progress;
}

export function unlockAchievement(achievementId: string): OfflineProgress {
  const progress = getOfflineProgress();
  if (!progress.achievements.includes(achievementId)) {
    progress.achievements.push(achievementId);
    saveOfflineProgress(progress);
  }
  return progress;
}

export function updateSettings(settings: Partial<GameSettings>): OfflineProgress {
  const progress = getOfflineProgress();
  progress.settings = { ...progress.settings, ...settings };
  saveOfflineProgress(progress);
  return progress;
}

export function addPlayTime(seconds: number): void {
  const progress = getOfflineProgress();
  progress.totalPlayTime += seconds;
  progress.lastPlayed = Date.now();
  saveOfflineProgress(progress);
}

export function recordGameEnd(score: number, marblesCleared: number, combo: number, streak: number): void {
  const progress = getOfflineProgress();
  progress.statistics.totalGames += 1;
  progress.statistics.totalScore += score;
  progress.statistics.totalMarblesCleared += marblesCleared;
  if (combo > progress.statistics.bestCombo) {
    progress.statistics.bestCombo = combo;
  }
  if (streak > progress.statistics.longestStreak) {
    progress.statistics.longestStreak = streak;
  }
  if (score > progress.highScore) {
    progress.highScore = score;
  }
  saveOfflineProgress(progress);
}