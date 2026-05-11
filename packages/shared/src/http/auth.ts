import { z } from "zod";

export const GoogleAuthRequestSchema = z.object({
    code: z.string().min(1),
});

export type GoogleAuthRequestDto = z.infer<typeof GoogleAuthRequestSchema>;

/** Shared user profile shape returned by both /auth/google and /auth/me. */
export const AuthResponseSchema = z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    avatarUrl: z.string().nullable(),
    createdAt: z.coerce.date(),
    selectedWorkspace: z
        .object({
            id: z.number(),
            name: z.string(),
        })
        .nullable(),
});

export type AuthResponseDto = z.infer<typeof AuthResponseSchema>;
