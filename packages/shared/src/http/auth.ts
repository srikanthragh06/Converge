import { z } from "zod";

export const GoogleAuthRequestSchema = z.object({
    code: z.string().min(1),
});

export type GoogleAuthRequestDto = z.infer<typeof GoogleAuthRequestSchema>;
