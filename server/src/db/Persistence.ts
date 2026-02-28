// Persistence helpers: writing updates to Postgres and loading them back.
// documentId is passed per-call rather than held as instance state,
// making each method independently usable across multiple documents.

import * as Y from "yjs";
import { Kysely } from "kysely";
import { DatabaseSchema } from "./schema";
import { REMOTE_ORIGIN } from "../constants";

export class Persistence {
    constructor(private readonly db: Kysely<DatabaseSchema>) {}

    // Inserts one raw Yjs binary update into the document_updates table.
    // snapshot_version is null for all v0.04 writes — will be set in v0.06.
    // Catches and logs errors internally so a DB failure never blocks in-memory sync.
    async saveUpdate(documentId: number, update: Uint8Array): Promise<void> {
        try {
            await this.db
                .insertInto("document_updates")
                .values({
                    document_id: documentId,
                    update: Buffer.from(update), // pg driver requires Buffer for BYTEA
                    snapshot_version: null,
                })
                .execute();
        } catch (err) {
            console.error(`saveUpdate failed: ${String(err)}`);
        }
    }

    // Loads all persisted updates for documentId, merges them into one combined
    // update via Y.mergeUpdates, then applies the single merged update to yDoc.
    // Merging first is more efficient than applying each row individually — Yjs
    // resolves one CRDT pass instead of N sequential applies.
    // Updates are tagged REMOTE_ORIGIN so no observer re-broadcasts during replay.
    async loadDocFromDb(documentId: number, yDoc: Y.Doc): Promise<void> {
        const rows = await this.db
            .selectFrom("document_updates")
            .select(["id", "update"])
            .where("document_id", "=", documentId)
            .orderBy("id", "asc")
            .execute();

        if (rows.length === 0) {
            console.log("loadDocFromDb: no updates found, starting with empty doc");
            return;
        }

        // Buffer extends Uint8Array so the cast creates a view without a copy.
        const allUpdates = rows.map(
            (row) => new Uint8Array(row.update as unknown as Buffer),
        );
        const merged = Y.mergeUpdates(allUpdates);
        Y.applyUpdate(yDoc, merged, REMOTE_ORIGIN);

        console.log(`loadDocFromDb: merged and applied ${rows.length} updates`);
    }
}
