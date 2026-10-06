import { atom } from "jotai";

/** Whether the ⌘K document search palette is open. Opened by the shortcut or the sidebar's Search item. */
export const isSearchOpenAtom = atom(false);

/** The ⌘K palette's content-search mode. In memory only, so it lasts for the session and resets to lexical on reload. */
export const searchModeAtom = atom<"lexical" | "semantic">("lexical");
