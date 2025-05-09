import { create } from "zustand";
import * as THREE from "three";
import { GameStore, GameStats } from "../types";

// Default game stats
const DEFAULT_GAME_STATS: GameStats = {
  score: 0,
  lives: 20,
  waveNumber: 1,
  totalMinions: 5,
  gameOver: false,
};

export const useGameStore = create<GameStore>((set) => ({
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
          gameOver,
        },
      };
    }),

  increaseTotalMinions: () =>
    set((state: GameStore) => ({
      gameStats: {
        ...state.gameStats,
        totalMinions: state.gameStats.totalMinions + 1,
      },
    })),

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
}));
