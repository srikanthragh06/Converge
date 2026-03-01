// Handles all compaction concerns: persisting an update (with counter),
// detecting whether a compaction threshold has been crossed, and running the
// actual compaction job under a Redis distributed lock.
//
// saveAndMaybeCompact is the main entry point for socket handlers — they never
// call Persistence directly; all persistence + compaction logic lives here.

import * as Y from "yjs";
import { Kysely } from "kysely";
import { Redis } from "ioredis";
import { DatabaseSchema } from "./schema";
import { Persistence } from "./Persistence";
import { COMPACTION_THRESHOLD } from "../constants";

export class Compactor {
    private static readonly LOCK_KEY_PREFIX = "lock:compact:";
    // Lock TTL in seconds — generous upper bound on how long compaction can take.
    // If the process crashes mid-compaction the lock auto-expires so the next
    // trigger can proceed.
    private static readonly LOCK_TTL_S = 30;

    constructor(
        private readonly db: Kysely<DatabaseSchema>,
        private readonly redis: Redis, // pub client — can issue arbitrary commands
        private readonly persistence: Persistence,
    ) {}

    // Persists the update, increments the document counter, then schedules a
    // compaction job if the counter has crossed a new 1000-multiple threshold.
    // Errors are caught and logged so a DB failure never blocks in-memory sync.
    async saveAndMaybeCompact(documentId: number, update: Uint8Array): Promise<void> {
        try {
            const { count, lastCompactCount } = await this.persistence.saveUpdate(
                documentId,
                update,
            );

            // e.g. count=3603 → threshold=3000, count=4000 → threshold=4000
            const threshold = (count / COMPACTION_THRESHOLD) * COMPACTION_THRESHOLD;

            // Only trigger if this threshold hasn't been compacted yet.
            // setTimeout(0) defers the work off the hot sync path.
            if (threshold > lastCompactCount) {
                setTimeout(() => {
                    this.compact(documentId, threshold).catch((err) =>
                        console.error(`Compaction error for doc ${documentId}: ${String(err)}`),
                    );
                }, 0);
            }
        } catch (err) {
            console.error(`saveUpdate failed for doc ${documentId}: ${String(err)}`);
        }
    }

    // Acquires a Redis NX lock, merges all update rows up to the current MAX(id)
    // into a single Yjs update, then atomically replaces them with that one row
    // and records the compacted threshold in document_meta.
    private async compact(documentId: number, threshold: bigint): Promise<void> {
        const lockKey = this.lockKey(documentId);

        // NX = set only if not exists; EX = expire after LOCK_TTL_S seconds.
        const acquired = await this.redis.set(lockKey, "1", "EX", Compactor.LOCK_TTL_S, "NX");
        if (acquired !== "OK") {
            console.log(`Compaction skipped for doc ${documentId}: lock held by another server`);
            return;
        }

        try {
            // Snapshot the current MAX(id) so we have a stable upper bound.
            // Rows inserted after this point are not touched.
            const maxRow = await this.db
                .selectFrom("document_updates")
                .select((eb) => eb.fn.max("id").as("max_id"))
                .where("document_id", "=", documentId)
                .executeTakeFirst();

            if (maxRow?.max_id == null) {
                // Nothing in the table yet — nothing to compact.
                return;
            }

            const lastId = maxRow.max_id; // bigint

            // Load all updates up to and including lastId.
            // Order is not required — Y.mergeUpdates is commutative.
            const rows = await this.db
                .selectFrom("document_updates")
                .select("update")
                .where("document_id", "=", documentId)
                .where("id", "<=", lastId)
                .execute();

            if (rows.length <= 1) {
                // Only one row — merging would produce the same bytes; skip.
                return;
            }

            // Merge all updates into a single Yjs state update.
            const merged = Y.mergeUpdates(
                rows.map((r) => new Uint8Array(r.update as unknown as Buffer)),
            );

            // Atomically: insert the merged row, delete the originals, record threshold.
            await this.db.transaction().execute(async (trx) => {
                // Insert merged update first so the document is never empty mid-transaction.
                await trx
                    .insertInto("document_updates")
                    .values({
                        document_id: documentId,
                        update: Buffer.from(merged),
                    })
                    .execute();

                // Delete all rows that were included in the merge.
                await trx
                    .deleteFrom("document_updates")
                    .where("document_id", "=", documentId)
                    .where("id", "<=", lastId)
                    .execute();

                // Record the threshold so future triggers for the same threshold are skipped.
                // update_count is left untouched — concurrent writes keep incrementing it.
                await trx
                    .updateTable("document_meta")
                    .set({ last_compact_count: threshold })
                    .where("document_id", "=", documentId)
                    .execute();
            });

            console.log(
                `Compaction complete for doc ${documentId}: merged ${rows.length} rows (threshold=${threshold})`,
            );
        } catch (err) {
            console.error(`Compaction error for doc ${documentId}: ${String(err)}`);
        } finally {
            // Best-effort release — TTL is the safety net if this fails.
            await this.redis.del(lockKey).catch((err) =>
                console.error(`Failed to release compaction lock: ${String(err)}`),
            );
        }
    }

    private lockKey(documentId: number): string {
        return Compactor.LOCK_KEY_PREFIX + String(documentId);
    }
}
