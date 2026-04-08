import { atom } from "jotai";

export const isSocketConnectedAtom = atom<boolean>(false); // tracks whether the Socket.io connection to the server is currently active
