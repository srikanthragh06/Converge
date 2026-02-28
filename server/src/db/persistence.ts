// Persistence helpers: writing updates to Postgres and loading them back.
// Used by store/docStore.ts (loadDocFromDb on cache miss) and sockets/socket.ts (saveUpdate on every update).

import * as Y from "yjs";
import { db } from ".";
import { DOCUMENT_ID, REMOTE_ORIGIN } from "../constants";

// Inserts one raw Yjs binary update into the document_updates table.
// snapshot_version is null for all v0.04 writes — will be set in v0.06.
// Catches and logs errors internally so a DB failure never blocks in-memory sync.
export const saveUpdate = async (update: Uint8Array): Promise<void> => {
    try {
        await db
            .insertInto("document_updates")
            .values({
                document_id: DOCUMENT_ID,
                update: Buffer.from(update), // pg driver requires Buffer for BYTEA
                snapshot_version: null,
            })
            .execute();
    } catch (err) {
        console.error(`saveUpdate failed: ${String(err)}`);
    }
};

// Loads all persisted updates for DOCUMENT_ID, merges them into one combined
// update using Y.mergeUpdates, then applies the single merged update to yDoc.
// Merging first is more efficient than applying each row individually — Yjs
// resolves one CRDT pass instead of N sequential applies.
// Updates are tagged REMOTE_ORIGIN so no observer re-broadcasts during replay.
// For v0.06: will load the latest S3 snapshot first, then filter by snapshot_version.
export const loadDocFromDb = async (yDoc: Y.Doc): Promise<void> => {
    const rows = await db
        .selectFrom("document_updates")
        .select(["id", "update"])
        .where("document_id", "=", DOCUMENT_ID)
        .orderBy("id", "asc")
        .execute();

    if (rows.length === 0) {
        console.log("loadDocFromDb: no updates found, starting with empty doc");
        return;
    }

    // Merge all stored updates into a single update before applying.
    // Buffer extends Uint8Array so the cast creates a view without a copy.
    const allUpdates = rows.map(
        (row) => new Uint8Array(row.update as unknown as Buffer),
    );
    const merged = Y.mergeUpdates(allUpdates);
    Y.applyUpdate(yDoc, merged, REMOTE_ORIGIN);

    console.log(`loadDocFromDb: merged and applied ${rows.length} updates`);
};
