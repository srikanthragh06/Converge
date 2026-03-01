// Handles compaction only — saving is done separately by PersistenceService.
// compact() checks whether a new threshold has been crossed and, if so,
// fires the actual DB compaction job under a Redis distributed lock.
//
// Socket handlers call persistenceService.saveUpdate() first, then pass the
// resulting counts to compactorService.compact() — keeping the two concerns
// fully independent.

import * as Y from "yjs";
import { servicesStore } from "../store/servicesStore";

export class CompactorService {
    private static readonly LOCK_KEY_PREFIX = "lock:compact:";
    // Lock TTL in seconds — generous upper bound on how long compaction can take.
    // If the process crashes mid-compaction the lock auto-expires so the next
    // trigger can proceed.
    private static readonly LOCK_TTL_S = 30;
    // Compaction fires when update_count crosses a new multiple of this value.
    // BigInt because document_meta.update_count is BIGINT (mapped to JS BigInt).
    private static readonly COMPACTION_THRESHOLD = BigInt(500);

    // Checks whether the current update count has crossed a new 500-multiple
    // threshold and, if so, schedules a compaction job via setTimeout(0) so it
    // runs off the hot sync path.
    // count and lastCompactCount come directly from persistenceService.saveUpdate().
    compact(documentId: number, count: bigint, lastCompactCount: bigint): void {
        // e.g. count=3603 → threshold=3000, count=4000 → threshold=4000
        const threshold =
            (count / CompactorService.COMPACTION_THRESHOLD) *
            CompactorService.COMPACTION_THRESHOLD;

        // Only trigger if this threshold hasn't been compacted yet.
        if (threshold > lastCompactCount) {
            setTimeout(() => {
                this.runCompaction(documentId, threshold).catch((err) =>
                    console.error(
                        `Compaction error for doc ${documentId}: ${String(err)}`,
                    ),
                );
            }, 0);
        }
    }

    // Acquires a Redis NX lock, merges all update rows up to the current MAX(id)
    // into a single Yjs update, then atomically replaces them with that one row
    // and records the compacted threshold in document_meta.
    private async runCompaction(
        documentId: number,
        threshold: bigint,
    ): Promise<void> {
        const lockKey = this.lockKey(documentId);
        const redis = servicesStore.redisService.pub;
        const db = servicesStore.databaseService.kysely;

        // NX = set only if not exists; EX = expire after LOCK_TTL_S seconds.
        const acquired = await redis.set(
            lockKey,
            "1",
            "EX",
            CompactorService.LOCK_TTL_S,
            "NX",
        );
        if (acquired !== "OK") {
            console.log(
                `Compaction skipped for doc ${documentId}: lock held by another server`,
            );
            return;
        }

        try {
            // Snapshot the current MAX(id) so we have a stable upper bound.
            // Rows inserted after this point are not touched.
            const maxRow = await db
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
            const rows = await db
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
            await db.transaction().execute(async (trx) => {
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
            console.error(
                `Compaction error for doc ${documentId}: ${String(err)}`,
            );
        } finally {
            // Best-effort release — TTL is the safety net if this fails.
            await redis
                .del(lockKey)
                .catch((err) =>
                    console.error(
                        `Failed to release compaction lock: ${String(err)}`,
                    ),
                );
        }
    }

    private lockKey(documentId: number): string {
        return CompactorService.LOCK_KEY_PREFIX + String(documentId);
    }
}
