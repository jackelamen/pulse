"use client";

import { create } from "zustand";

interface UiState {
  quickAddOpen: boolean;
  quickAddDefaultListId: string | null;
  openQuickAdd: (defaultListId?: string | null) => void;
  closeQuickAdd: () => void;

  shortcutsOpen: boolean;
  setShortcutsOpen: (v: boolean) => void;

  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;

  selectedTaskId: string | null;
  openTask: (id: string | null) => void;
}

export const useUi = create<UiState>((set) => ({
  quickAddOpen: false,
  quickAddDefaultListId: null,
  openQuickAdd: (defaultListId = null) =>
    set({ quickAddOpen: true, quickAddDefaultListId: defaultListId }),
  closeQuickAdd: () => set({ quickAddOpen: false }),

  shortcutsOpen: false,
  setShortcutsOpen: (v) => set({ shortcutsOpen: v }),

  paletteOpen: false,
  setPaletteOpen: (v) => set({ paletteOpen: v }),

  selectedTaskId: null,
  openTask: (id) => set({ selectedTaskId: id }),
}));
