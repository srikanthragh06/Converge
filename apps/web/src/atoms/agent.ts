import { atom } from "jotai";

/** Whether the Ask Converge side panel is open. Opened by ⌘J, the sidebar's Ask Converge item, or a visit to /agent. */
export const isAgentPanelOpenAtom = atom(false);
