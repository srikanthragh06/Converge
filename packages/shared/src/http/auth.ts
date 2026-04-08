import { z } from "zod";

export const GoogleAuthRequestSchema = z.object({
    code: z.string().min(1),
});

export type GoogleAuthRequestDto = z.infer<typeof GoogleAuthRequestSchema>;

export const GoogleAuthResponseSchema = z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    avatarUrl: z.string().nullable(),
    createdAt: z.coerce.date(),
});

export type GoogleAuthResponseDto = z.infer<typeof GoogleAuthResponseSchema>;
