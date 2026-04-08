import { z } from "zod";

export const GoogleAuthSchema = z.object({
    code: z.string().min(1),
});

export type GoogleAuthDto = z.infer<typeof GoogleAuthSchema>;
