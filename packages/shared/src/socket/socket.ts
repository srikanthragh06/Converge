import { z } from "zod";

// const WireBytes = z
//     .array(z.number().int().min(0).max(255))
//     .transform((arr) => new Uint8Array(arr));

export const PingSchema = z.object({ pingId: z.string() });

export type PingPayload = z.infer<typeof PingSchema>;

export const PongSchema = z.object({ pingId: z.string() });

export type PongPayload = z.infer<typeof PongSchema>;
