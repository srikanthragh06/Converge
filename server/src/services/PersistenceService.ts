// Persistence helpers: writing updates to Postgres and loading them back.
// documentId is passed per-call rather than held as instance state,
// making each method independently usable across multiple documents.
// Accesses the database via the global container (servicesStore.databaseService.kysely).

import * as Y from "yjs";
import { SaveUpdateResult } from "../types/types";
import { servicesStore } from "../store/servicesStore";
import { REMOTE_ORIGIN } from "../constants/constants";

export class PersistenceService {
    // Atomically inserts the Yjs update and increments the document's update counter.
    // Both writes happen inside a single transaction so the counter always reflects
    // the true number of persisted updates.
    // Returns the new count and the last compaction threshold so the compactor
    // can decide whether to schedule a compaction job.
    // Throws on failure — the caller (saveAndMaybeCompact) catches and logs.
    async saveYDocUpdate(
        documentId: number,
        update: Uint8Array,
    ): Promise<SaveUpdateResult> {
        const db = servicesStore.databaseService.kysely;
        return db.transaction().execute(async (trx) => {
            // 1. Persist the raw Yjs binary.
            await trx
                .insertInto("document_updates")
                .values({
                    document_id: documentId,
                    update: Buffer.from(update), // pg driver requires Buffer for BYTEA
                })
                .execute();

            // 2. Upsert the counter: create on first insert, increment on subsequent ones.
            // RETURNING both columns so the caller has everything it needs in one round-trip.
            const result = await trx
                .insertInto("document_meta")
                .values({
                    document_id: documentId,
                    update_count: BigInt(1),
                    last_compact_count: BigInt(0),
                })
                .onConflict((oc) =>
                    oc.column("document_id").doUpdateSet((eb) => ({
                        // Increment update_count; leave last_compact_count untouched.
                        update_count: eb(
                            eb.ref("document_meta.update_count"),
                            "+",
                            eb.val(BigInt(1)),
                        ),
                    })),
                )
                .returning(["update_count", "last_compact_count"])
                .executeTakeFirstOrThrow();

            return {
                count: result.update_count,
                lastCompactCount: result.last_compact_count,
            };
        });
    }

    // Loads all persisted updates for documentId, merges them into one combined
    // update via Y.mergeUpdates, then applies the single merged update to yDoc.
    // Merging first is more efficient than applying each row individually — Yjs
    // resolves one CRDT pass instead of N sequential applies.
    // Updates are tagged REMOTE_ORIGIN so no observer re-broadcasts during replay.
    async loadYDocFromDb(documentId: number, yDoc: Y.Doc): Promise<void> {
        const db = servicesStore.databaseService.kysely;
        const rows = await db
            .selectFrom("document_updates")
            .select(["id", "update"])
            .where("document_id", "=", documentId)
            .orderBy("id", "asc")
            .execute();

        if (rows.length === 0) {
            console.log(
                "loadDocFromDb: no updates found, starting with empty doc",
            );
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
