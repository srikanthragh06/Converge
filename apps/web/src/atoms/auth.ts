import { type GoogleAuthResponseDto } from "@converge/shared";
import { atom } from "jotai";

export const isAuthAtom = atom<boolean>(false); // Whether the current user has completed authentication.

export const userDetailsAtom = atom<GoogleAuthResponseDto | null>(null); // Profile details of the authenticated user, or null if not logged in.
