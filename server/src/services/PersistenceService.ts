// Persistence helpers: writing updates to Postgres and loading them back.
// documentId is passed per-call rather than held as instance state,
// making each method independently usable across multiple documents.
// Accesses the database via the global container (servicesStore.databaseService.kysely).

import * as Y from "yjs";
import { sql } from "kysely";
import { SaveUpdateResult } from "../types/types";
import { DocumentLibraryItem } from "../types/api";
import { servicesStore } from "../store/servicesStore";
import { REMOTE_ORIGIN, TITLE_SEARCH_SIMILARITY_THRESHOLD } from "../constants/constants";

export class PersistenceService {
    // Atomically inserts the Yjs update and increments the document's update counter.
    // userId is included in the INSERT fallback values so created_by_id is never null
    // if the row somehow does not exist yet (documents are normally pre-created via createDoc).
    // The ON CONFLICT path never touches created_by_id, so the original creator is preserved.
    // Returns the new count and the last compaction threshold so the compactor
    // can decide whether to schedule a compaction job.
    // Throws on failure — the caller catches and logs.
    async saveYDocUpdate(
        documentId: number,
        update: Uint8Array,
        userId: number,
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
            // created_by_id is set on the INSERT path in case createDoc was never called;
            // ON CONFLICT only increments update_count and leaves everything else untouched.
            const result = await trx
                .insertInto("document_meta")
                .values({
                    update_count: BigInt(1),
                    last_compact_count: BigInt(0),
                    title: "",
                    created_by_id: userId,
                })
                .onConflict((oc) =>
                    oc.column("document_id").doUpdateSet((eb) => ({
                        // Increment update_count; leave last_compact_count and created_by_id untouched.
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

    // Creates a new document row and returns its auto-generated document_id.
    // The sequence default added in migration 4 provides the ID — no manual specification needed.
    // createdById is the user who initiated the creation via POST /documents.
    async createDoc(createdById: number): Promise<number> {
        const db = servicesStore.databaseService.kysely;
        const row = await db
            .insertInto("document_meta")
            .values({
                update_count: BigInt(0),
                last_compact_count: BigInt(0),
                title: "",
                created_by_id: createdById,
            })
            .returning("document_id")
            .executeTakeFirstOrThrow();
        console.log(`createDoc: created document ${row.document_id} for user ${createdById}`);
        return row.document_id;
    }

    // Checks whether a document_meta row exists for the given documentId.
    // Used by handleJoinDoc to reject joins for documents that do not exist.
    async documentExists(documentId: number): Promise<boolean> {
        const db = servicesStore.databaseService.kysely;
        const row = await db
            .selectFrom("document_meta")
            .select("document_id")
            .where("document_id", "=", documentId)
            .executeTakeFirst();
        return row !== undefined;
    }

    // Upserts last_viewed_at for (documentId, userId) to now().
    // Called fire-and-forget from handleJoinDoc — a failed write must not block the join.
    async upsertLastViewedAt(documentId: number, userId: number): Promise<void> {
        const db = servicesStore.databaseService.kysely;
        await db
            .insertInto("document_user_meta")
            .values({
                document_id: documentId,
                user_id: userId,
                last_viewed_at: sql`now()`,
                last_edited_at: null,
            })
            .onConflict((oc) =>
                oc.columns(["document_id", "user_id"]).doUpdateSet({
                    last_viewed_at: sql`now()`,
                }),
            )
            .execute();
    }

    // Upserts last_edited_at (and last_viewed_at on first insert) for (documentId, userId) to now().
    // Called fire-and-forget from handleSyncDoc — a failed write must not block the relay.
    async upsertLastEditedAt(documentId: number, userId: number): Promise<void> {
        const db = servicesStore.databaseService.kysely;
        await db
            .insertInto("document_user_meta")
            .values({
                document_id: documentId,
                user_id: userId,
                last_viewed_at: sql`now()`,
                last_edited_at: sql`now()`,
            })
            .onConflict((oc) =>
                oc.columns(["document_id", "user_id"]).doUpdateSet({
                    last_edited_at: sql`now()`,
                }),
            )
            .execute();
    }

    // Returns all documents the user has viewed, ordered by last_viewed_at DESC.
    // Used by GET /documents for the library page recency list.
    async getUserViewedDocs(userId: number): Promise<DocumentLibraryItem[]> {
        const db = servicesStore.databaseService.kysely;
        const rows = await sql<{
            document_id: number;
            title: string;
            created_by_name: string | null;
            last_viewed_at: Date;
            last_edited_at: Date | null;
        }>`
            SELECT dm.document_id, dm.title, u.display_name AS created_by_name,
                   dum.last_viewed_at, dum.last_edited_at
            FROM document_user_meta dum
            JOIN document_meta dm ON dm.document_id = dum.document_id
            LEFT JOIN users u ON u.id = dm.created_by_id
            WHERE dum.user_id = ${userId}
            ORDER BY dum.last_viewed_at DESC
        `.execute(db);

        return rows.rows.map((row) => ({
            id: row.document_id,
            title: row.title,
            createdByName: row.created_by_name,
            lastViewedAt: row.last_viewed_at.toISOString(),
            lastEditedAt: row.last_edited_at ? row.last_edited_at.toISOString() : null,
        }));
    }

    // Trigram similarity search on titles scoped to docs the user has viewed.
    // Results below TITLE_SEARCH_SIMILARITY_THRESHOLD are filtered out.
    // Used by GET /documents/search?q=... for the library search bar and Ctrl+P overlay.
    async searchUserViewedDocsByTitle(userId: number, query: string): Promise<DocumentLibraryItem[]> {
        const db = servicesStore.databaseService.kysely;
        const rows = await sql<{
            document_id: number;
            title: string;
            created_by_name: string | null;
            last_viewed_at: Date;
            last_edited_at: Date | null;
        }>`
            SELECT dm.document_id, dm.title, u.display_name AS created_by_name,
                   dum.last_viewed_at, dum.last_edited_at
            FROM document_user_meta dum
            JOIN document_meta dm ON dm.document_id = dum.document_id
            LEFT JOIN users u ON u.id = dm.created_by_id
            WHERE dum.user_id = ${userId}
              AND similarity(dm.title, ${query}) > ${TITLE_SEARCH_SIMILARITY_THRESHOLD}
            ORDER BY similarity(dm.title, ${query}) DESC
        `.execute(db);

        return rows.rows.map((row) => ({
            id: row.document_id,
            title: row.title,
            createdByName: row.created_by_name,
            lastViewedAt: row.last_viewed_at.toISOString(),
            lastEditedAt: row.last_edited_at ? row.last_edited_at.toISOString() : null,
        }));
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
