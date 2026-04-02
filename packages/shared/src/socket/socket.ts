import { z } from "zod";

// Validates Yjs binary data sent over the wire as a number[] of byte values.
const WireBytes = z.array(z.number().int().min(0).max(255));

export const SyncDocServerSchema = z.object({
    updateArray: WireBytes,
    clientSVArray: WireBytes,
});

export type SyncDocServerPayload = z.infer<typeof SyncDocServerSchema>;

export const SyncDocClientSchema = z.object({
    updateArray: WireBytes,
    serverSVArray: WireBytes,
});

export type SyncDocClientPayload = z.infer<typeof SyncDocClientSchema>;

export const PingSchema = z.object({ pingId: z.string() });

export type PingPayload = z.infer<typeof PingSchema>;

export const PongSchema = z.object({ pingId: z.string() });

export type PongPayload = z.infer<typeof PongSchema>;
