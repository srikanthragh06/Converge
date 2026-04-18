import { z } from "zod";

// Validates Yjs binary data sent over the wire as a number[] of byte values.
const WireBytes = z.array(z.number().int().min(0).max(255));

// ── Sync Doc ──────────────────────────────────────────────────────────────────

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

// ── Sync Doc Title ──────────────────────────────────────────────────────────────────

export const SyncDocTitleSchema = z.object({
    title: z.string(),
});

export type SyncDocTitlePayload = z.infer<typeof SyncDocTitleSchema>;

// ── Repair Sync Doc ───────────────────────────────────────────────────────────

export const RepairSyncDocServerSchema = z.object({
    clientSVArray: WireBytes,
});

export type RepairSyncDocServerPayload = z.infer<
    typeof RepairSyncDocServerSchema
>;

export const RepairSyncDocClientSchema = z.object({
    serverSVArray: WireBytes,
});

export type RepairSyncDocClientPayload = z.infer<
    typeof RepairSyncDocClientSchema
>;

// ── Repair Sync Ack Doc ───────────────────────────────────────────────────────

export const RepairSyncAckDocServerSchema = z.object({
    diffArray: WireBytes,
    clientSVArray: WireBytes,
});

export type RepairSyncAckDocServerPayload = z.infer<
    typeof RepairSyncAckDocServerSchema
>;

export const RepairSyncAckDocClientSchema = z.object({
    serverSVArray: WireBytes,
    diffArray: WireBytes,
});

export type RepairSyncAckDocClientPayload = z.infer<
    typeof RepairSyncAckDocClientSchema
>;

// ── Repair Ack Doc ────────────────────────────────────────────────────────────

export const RepairAckDocServerSchema = z.object({
    diffArray: WireBytes,
    clientSVArray: WireBytes,
});

export type RepairAckDocServerPayload = z.infer<
    typeof RepairAckDocServerSchema
>;

export const RepairAckDocClientSchema = z.object({
    diffArray: WireBytes,
});

export type RepairAckDocClientPayload = z.infer<
    typeof RepairAckDocClientSchema
>;

// ── Ping / Pong ───────────────────────────────────────────────────────────────

export const PingSchema = z.object({ pingId: z.string() });

export type PingPayload = z.infer<typeof PingSchema>;

export const PongSchema = z.object({ pingId: z.string() });

export type PongPayload = z.infer<typeof PongSchema>;
