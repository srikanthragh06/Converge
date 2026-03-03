// Handles compaction only — saving is done separately by PersistenceService.
// checkAndCompactDocumentUpdates() checks whether a new threshold has been crossed
// and, if so, fires the actual DB compaction job under a Redis distributed lock.
//
// Socket handlers call persistenceService.saveUpdate() first, then pass the
// resulting counts to compactorService.checkAndCompactDocumentUpdates() — keeping
// the two concerns fully independent.

import * as Y from "yjs";
import { servicesStore } from "../store/servicesStore";
import { REDIS_OK } from "../constants/constants";

export class CompactorService {
    private static readonly DOCUMENT_UPDATES_COMPACTION_LOCK_PREFIX =
        "document_updates_compaction_lock:";
    // Lock TTL in seconds — generous upper bound on how long compaction can take.
    // If the process crashes mid-compaction the lock auto-expires so the next
    // trigger can proceed.
    private static readonly DOCUMENT_UPDATES_COMPACTION_LOCK_TTL_S =
        24 * 60 * 60; // 24 hours
    // Compaction fires when update_count crosses a new multiple of this value.
    // BigInt because document_meta.update_count is BIGINT (mapped to JS BigInt).
    private static readonly COMPACTION_THRESHOLD = BigInt(500);

    // Checks whether currentCompactCount has crossed a new 500-multiple threshold
    // that hasn't been compacted yet. If so, fires runCompaction() immediately
    // (fire-and-forget) so it runs off the hot sync path.
    // currentCompactCount and lastDocumentUpdatesCompactCount come directly from
    // persistenceService.saveUpdate().
    checkAndCompactDocumentUpdates(
        documentId: number,
        currentCompactCount: bigint,
        lastDocumentUpdatesCompactCount: bigint,
    ): void {
        // e.g. currentCompactCount=523, lastDocumentUpdatesCompactCount=500, threshold=500 => no compaction
        // e.g. currentCompactCount=1001, lastDocumentUpdatesCompactCount=500, threshold=1000 => compaction
        const currentThreshold = BigInt(
            Math.floor(
                Number(currentCompactCount) /
                    Number(CompactorService.COMPACTION_THRESHOLD),
            ) * Number(CompactorService.COMPACTION_THRESHOLD),
        );

        // Only trigger if this threshold hasn't been compacted yet.
        if (currentThreshold > lastDocumentUpdatesCompactCount) {
            void this.runCompaction(documentId, currentThreshold).catch(
                (err) => {
                    console.error(
                        `Compaction error for doc ${documentId}: ${String(err)}`,
                    );
                },
            );
        }
    }

    // Acquires a Redis NX lock keyed to documentId, merges all update rows up to
    // the current MAX(id) into a single Yjs update, then atomically replaces them
    // with that one row and records newThreshold in document_meta.last_compact_count.
    private async runCompaction(
        documentId: number,
        newThreshold: bigint,
    ): Promise<void> {
        const lockKey =
            this.generateDocumentUpdatesCompactionLockKey(documentId);
        const redisPubClient = servicesStore.redisService.pub;
        const db = servicesStore.databaseService.kysely;

        // NX = set only if not exists; EX = expire after LOCK_TTL_S seconds.
        const acquired = await redisPubClient.set(
            lockKey, // Unique lock key for this document
            "1", // Arbitrary lock value (not used here)
            "EX", // Expiration mode
            CompactorService.DOCUMENT_UPDATES_COMPACTION_LOCK_TTL_S, // TTL in seconds
            "NX", // Only set if key does not exist
        );
        if (acquired !== REDIS_OK) {
            console.log(
                `Compaction skipped for doc ${documentId}: lock held by another server`,
            );
            return;
        }

        try {
            // Snapshot the current MAX(id) so we have a stable upper bound.
            // Rows inserted after this point are not touched.
            const maxIDRow = await db
                .selectFrom("document_updates")
                .select((eb) => eb.fn.max("id").as("max_id"))
                .where("document_id", "=", documentId)
                .executeTakeFirst();

            if (maxIDRow?.max_id == null) {
                // Nothing in the table yet — nothing to compact.
                return;
            }

            const lastId = maxIDRow.max_id; // bigint

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
            const mergedDocUpdates = Y.mergeUpdates(
                rows.map((r) => new Uint8Array(r.update as unknown as Buffer)),
            );

            // Atomically: insert the merged row, delete the originals, record threshold.
            await db.transaction().execute(async (trx) => {
                // Insert merged update first so the document is never empty mid-transaction.
                await trx
                    .insertInto("document_updates")
                    .values({
                        document_id: documentId,
                        update: Buffer.from(mergedDocUpdates),
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
                    .set({ last_compact_count: newThreshold })
                    .where("document_id", "=", documentId)
                    .execute();
            });

            console.log(
                `Compaction complete for doc ${documentId}: merged ${rows.length} rows (threshold=${newThreshold})`,
            );
        } catch (err) {
            console.error(
                `Compaction error for doc ${documentId}: ${String(err)}`,
            );
        } finally {
            // Best-effort release — TTL is the safety net if this fails.
            await redisPubClient
                .del(lockKey)
                .catch((err) =>
                    console.error(
                        `Failed to release compaction lock: ${String(err)}`,
                    ),
                );
        }
    }

    private generateDocumentUpdatesCompactionLockKey(
        documentId: number,
    ): string {
        return (
            CompactorService.DOCUMENT_UPDATES_COMPACTION_LOCK_PREFIX +
            String(documentId)
        );
    }
}
