import { type AuthResponseDto } from "@converge/shared";
import { atom } from "jotai";

/** Single source of truth for client-side auth state. Starts loading until /auth/me resolves. */
export const authAtom = atom<{
    status: "loading" | "authenticated" | "unauthenticated"; // Current stage of the auth lifecycle.
    user: AuthResponseDto | null; // Authenticated user's profile, or null if not logged in.
}>({ status: "loading", user: null });
