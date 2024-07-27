import { create } from "zustand";

export const useGameStore = create((set) => ({
  clickableObjs: [],
  addClickableObjs: (obj) =>
    set((state) => ({ bears: state.clickableObjs.push(obj) })),
  removeAllObjects: () => set({ clickableObjs: [] }),
  removeClickableObj: (obj) =>
    set((state) => ({
      clickableObjs: state.filter((object) => obj.uuid !== object.uuid),
    })),
}));
