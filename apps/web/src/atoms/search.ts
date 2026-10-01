import { atom } from "jotai";

/** Whether the ⌘K document search palette is open. Opened by the shortcut or the sidebar's Search item. */
export const isSearchOpenAtom = atom(false);
