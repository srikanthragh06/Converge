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
                    title: "",
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

    // Creates a document_meta row for documentId if one does not already exist.
    // Called on join_doc so the row is ready before the first saveYDocUpdate arrives.
    // ON CONFLICT DO NOTHING makes this a true no-op for existing documents.
    async createDocIfDoesntExist(documentId: number): Promise<void> {
        const db = servicesStore.databaseService.kysely;
        await db
            .insertInto("document_meta")
            .values({
                document_id: documentId,
                update_count: BigInt(0),
                last_compact_count: BigInt(0),
                title: "",
            })
            .onConflict((oc) => oc.column("document_id").doNothing())
            .execute();
        console.log(`createDocIfDoesntExist: ensured document_meta row for doc ${documentId}`);
    }

    // Inserts a new user row or updates display_name/avatar_url if email already exists.
    // Returns the upserted row including the auto-generated integer id.
    async upsertUser(user: {
        email: string;
        displayName?: string;
        avatarUrl?: string;
    }): Promise<{ id: number; email: string; displayName?: string; avatarUrl?: string }> {
        const db = servicesStore.databaseService.kysely;
        const row = await db
            .insertInto("users")
            .values({
                email: user.email,
                display_name: user.displayName ?? null,
                avatar_url: user.avatarUrl ?? null,
            })
            .onConflict((oc) =>
                oc.column("email").doUpdateSet({
                    display_name: user.displayName ?? null,
                    avatar_url: user.avatarUrl ?? null,
                }),
            )
            .returning(["id", "email", "display_name", "avatar_url"])
            .executeTakeFirstOrThrow();

        return {
            id: row.id,
            email: row.email,
            displayName: row.display_name ?? undefined,
            avatarUrl: row.avatar_url ?? undefined,
        };
    }

    // Looks up a user by email. Returns null if no matching row exists.
    // Used by /auth/me to confirm the user still exists in the DB after JWT verification.
    async getUserByEmail(email: string): Promise<{ id: number; email: string; displayName?: string; avatarUrl?: string } | null> {
        const db = servicesStore.databaseService.kysely;
        const row = await db
            .selectFrom("users")
            .select(["id", "email", "display_name", "avatar_url"])
            .where("email", "=", email)
            .executeTakeFirst();
        if (!row) return null;
        return {
            id: row.id,
            email: row.email,
            displayName: row.display_name ?? undefined,
            avatarUrl: row.avatar_url ?? undefined,
        };
    }

    // Returns public metadata (id + title) for a document.
    // Used by GET /documents/:documentId.
    async getDocumentMeta(documentId: number): Promise<{ id: number; title: string }> {
        const db = servicesStore.databaseService.kysely;
        const row = await db
            .selectFrom("document_meta")
            .select(["document_id", "title"])
            .where("document_id", "=", documentId)
            .executeTakeFirstOrThrow();
        return { id: row.document_id, title: row.title };
    }

    // Overwrites the title for a document — last writer wins, no CRDT.
    // Called from PATCH /documents/:documentId/title in ControllerService.
    async updateDocumentTitle(documentId: number, title: string): Promise<void> {
        const db = servicesStore.databaseService.kysely;
        await db
            .updateTable("document_meta")
            .set({ title })
            .where("document_id", "=", documentId)
            .execute();
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
