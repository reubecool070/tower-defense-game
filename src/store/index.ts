import { create } from "zustand";
import * as THREE from "three";
import { GameStats } from "../types";

// Wave configuration - minions per wave
const WAVE_CONFIG = [
  5, // Wave 1: 5 minions
  10, // Wave 2: 10 minions
  15, // Wave 3: 15 minions
  20, // Wave 4: 20 minions
  25, // Wave 5: 25 minions
];

export interface GameStore {
  clickableObjs: Set<THREE.Object3D>;
  addClickableObjs: (obj: THREE.Object3D) => void;
  removeAllObjects: () => void;
  removeClickableObj: (obj: THREE.Object3D) => void;
  // Game stats
  gameStats: GameStats;
  increaseScore: () => void;
  decreaseLives: () => void;
  increaseTotalMinions: () => void;
  setGameOver: (isOver: boolean) => void;
  resetGameStats: () => void;
  // Wave management
  advanceToNextWave: () => void;
  checkWaveCompletion: () => boolean;
  // Pause functionality
  isPaused: boolean;
  togglePause: () => void;
  setPaused: (paused: boolean) => void;
}

// Default game stats
const DEFAULT_GAME_STATS: GameStats = {
  score: 0,
  lives: 3,
  waveNumber: 1,
  totalMinions: WAVE_CONFIG[0], // Start with Wave 1 minion count
  minionsSpawned: 0,
  minionsDefeated: 0,
  minionsLeaked: 0,
  gameOver: false,
  victory: false,
};

export const useGameStore = create<GameStore>((set, get) => ({
  // Clickable objects management
  clickableObjs: new Set<THREE.Object3D>(),
  addClickableObjs: (obj: THREE.Object3D) =>
    set((state: GameStore) => {
      const newSet = new Set(state.clickableObjs);
      newSet.add(obj);
      return { clickableObjs: newSet };
    }),
  removeAllObjects: () => set({ clickableObjs: new Set() }),
  removeClickableObj: (obj: THREE.Object3D) =>
    set((state: GameStore) => {
      const newSet = new Set(state.clickableObjs);
      newSet.forEach((item) => {
        if (item.uuid === obj.uuid) {
          newSet.delete(item);
        }
      });
      return { clickableObjs: newSet };
    }),

  // Game stats management
  gameStats: DEFAULT_GAME_STATS,

  increaseScore: () =>
    set((state: GameStore) => ({
      gameStats: {
        ...state.gameStats,
        score: state.gameStats.score + 1,
        minionsDefeated: state.gameStats.minionsDefeated + 1,
      },
    })),

  decreaseLives: () =>
    set((state: GameStore) => {
      const newLives = Math.max(0, state.gameStats.lives - 1);
      const gameOver = newLives <= 0;

      // Log messages
      if (gameOver && !state.gameStats.gameOver) {
        console.log("GAME OVER! Final Score:", state.gameStats.score);
      }

      return {
        gameStats: {
          ...state.gameStats,
          lives: newLives,
          minionsLeaked: state.gameStats.minionsLeaked + 1,
          gameOver,
        },
      };
    }),

  increaseTotalMinions: () =>
    set((state: GameStore) => {
      const nextMinionsSpawned = state.gameStats.minionsSpawned + 1;

      return {
        gameStats: {
          ...state.gameStats,
          minionsSpawned: nextMinionsSpawned,
        },
      };
    }),

  setGameOver: (isOver: boolean) =>
    set((state: GameStore) => ({
      gameStats: {
        ...state.gameStats,
        gameOver: isOver,
      },
    })),

  resetGameStats: () =>
    set({
      gameStats: DEFAULT_GAME_STATS,
    }),

  advanceToNextWave: () =>
    set((state: GameStore) => {
      const currentWave = state.gameStats.waveNumber;
      const nextWave = currentWave + 1;

      // Check if there are more waves
      if (nextWave <= WAVE_CONFIG.length) {
        console.log(`Advancing to Wave ${nextWave}!`);
        return {
          gameStats: {
            ...state.gameStats,
            waveNumber: nextWave,
            totalMinions: WAVE_CONFIG[nextWave - 1],
            minionsSpawned: 0,
          },
        };
      } else {
        // Player completed all waves - victory!
        console.log("VICTORY! You've completed all waves! Final Score:", state.gameStats.score);
        return {
          gameStats: {
            ...state.gameStats,
            victory: true,
          },
        };
      }
    }),

  checkWaveCompletion: () => {
    const state = get();
    const { minionsSpawned, totalMinions, minionsDefeated, minionsLeaked } = state.gameStats;

    // Wave is complete when all minions have been spawned and either defeated or leaked
    if (minionsSpawned >= totalMinions && minionsDefeated + minionsLeaked >= totalMinions) {
      return true;
    }
    return false;
  },

  // Pause functionality
  isPaused: false,
  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),
  setPaused: (paused: boolean) => set({ isPaused: paused }),
}));
