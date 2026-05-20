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
    documentId: z.number().int().positive(),
    updateArray: WireBytes,
    serverSVArray: WireBytes,
});

export type SyncDocClientPayload = z.infer<typeof SyncDocClientSchema>;

// ── Sync Doc Title ──────────────────────────────────────────────────────────────────

export const SyncDocTitleServerSchema = z.object({
    title: z.string().trim().max(32),
    changeId: z.string(),
});

export type SyncDocTitleServerPayload = z.infer<
    typeof SyncDocTitleServerSchema
>;

export const SyncDocTitleClientSchema = z.object({
    title: z.string(),
});

export type SyncDocTitleClientPayload = z.infer<
    typeof SyncDocTitleClientSchema
>;

export const SyncDocTitleAckSchema = z.object({
    changeId: z.string(),
});

export type SyncDocTitleAckPayload = z.infer<typeof SyncDocTitleAckSchema>;

// ── Repair Sync Doc ───────────────────────────────────────────────────────────

export const RepairSyncDocServerSchema = z.object({
    clientSVArray: WireBytes,
});

export type RepairSyncDocServerPayload = z.infer<
    typeof RepairSyncDocServerSchema
>;

export const RepairSyncDocClientSchema = z.object({
    documentId: z.number().int().positive(),
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
    documentId: z.number().int().positive(),
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
    documentId: z.number().int().positive(),
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

// ── Awareness ─────────────────────────────────────────────────────────────────

// One entry in the awareness user list — all fields the server sends per present user.
export const AwarenessUserSchema = z.object({
    userId: z.number().int().positive(),
    name: z.string(),
    avatarUrl: z.string().nullable(),
    color: z.string(),
    focusedBlockId: z.string().nullable(),
});

export type AwarenessUser = z.infer<typeof AwarenessUserSchema>;

// Client → Server: reports which block the user's cursor is currently in.
// focusedBlockId is null when the editor loses focus.
export const AwarenessUpdateServerSchema = z.object({
    focusedBlockId: z.string().nullable(),
});

export type AwarenessUpdateServerPayload = z.infer<
    typeof AwarenessUpdateServerSchema
>;

// Server → Client: full snapshot of all users currently present in the document.
// Clients replace their local awareness state entirely on each receive.
export const AwarenessUpdateClientSchema = z.object({
    users: z.array(AwarenessUserSchema),
});

export type AwarenessUpdateClientPayload = z.infer<
    typeof AwarenessUpdateClientSchema
>;
