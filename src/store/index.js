import create from "zustand";

export const useGameStore = create((set) => ({
  clickableObjs: new Set(),
  addClickableObjs: (obj) =>
    set((state) => {
      const newSet = new Set(state.clickableObjs);
      newSet.add(obj);
      return { clickableObjs: newSet };
    }),
  removeAllObjects: () => set({ clickableObjs: new Set() }),
  removeClickableObj: (obj) =>
    set((state) => {
      const newSet = new Set(state.clickableObjs);
      newSet.forEach((item) => {
        if (item.uuid === obj.uuid) {
          newSet.delete(item);
        }
      });
      return { clickableObjs: newSet };
    }),
}));
