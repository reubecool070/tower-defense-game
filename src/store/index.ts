import { create } from "zustand";
import * as THREE from "three";
import { GameStore } from "../types";

export const useGameStore = create<GameStore>((set) => ({
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
}));
