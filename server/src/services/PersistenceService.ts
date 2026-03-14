// Persistence helpers: writing updates to Postgres and loading them back.
// documentId is passed per-call rather than held as instance state,
// making each method independently usable across multiple documents.
// Accesses the database via the global container (servicesStore.databaseService.kysely).

import * as Y from "yjs";
import { sql } from "kysely";
import { SaveUpdateResult, AccessLevel, DocumentMember, UserSearchResult } from "../types/types";
import { DocumentLibraryData, DocumentSearchData, DocumentMembersData, DocumentUserSearchData } from "../types/api";
import { servicesStore } from "../store/servicesStore";
import { REMOTE_ORIGIN, TITLE_SEARCH_SIMILARITY_THRESHOLD, USER_SEARCH_SIMILARITY_THRESHOLD } from "../constants/constants";

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
            // document_id must be specified explicitly so the ON CONFLICT fires on the right row —
            // without it the sequence generates a new ID and the conflict never triggers.
            // created_by_id is set on the INSERT path in case createDoc was never called;
            // ON CONFLICT only increments update_count and leaves everything else untouched.
            const result = await trx
                .insertInto("document_meta")
                .values({
                    document_id: documentId,
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

    // Creates a new document row and a corresponding owner access row in a single transaction.
    // The sequence default added in migration 4 provides the document_id automatically.
    // createdById is granted 'owner' access immediately so they can join the doc.
    async createDoc(createdById: number): Promise<number> {
        const db = servicesStore.databaseService.kysely;
        return db.transaction().execute(async (trx) => {
            // 1. Insert the document_meta row and get the auto-generated document_id.
            const row = await trx
                .insertInto("document_meta")
                .values({
                    update_count: BigInt(0),
                    last_compact_count: BigInt(0),
                    title: "",
                    created_by_id: createdById,
                })
                .returning("document_id")
                .executeTakeFirstOrThrow();

            // 2. Create the owner access row for the creator.
            // last_viewed_at and last_edited_at are set to now() so the doc appears in the library immediately.
            await trx
                .insertInto("document_user_meta")
                .values({
                    document_id: row.document_id,
                    user_id: createdById,
                    access_level: "owner",
                    last_viewed_at: sql`now()`,
                    last_edited_at: sql`now()`,
                })
                .execute();

            console.log(`createDoc: created document ${row.document_id} for user ${createdById}`);
            return row.document_id;
        });
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

    // Returns the user's access level for a document, or null if they have no access row.
    // Used by socket handlers and REST endpoints to enforce per-document authorization.
    async getDocumentAccess(documentId: number, userId: number): Promise<AccessLevel | null> {
        const db = servicesStore.databaseService.kysely;
        const row = await db
            .selectFrom("document_user_meta")
            .select("access_level")
            .where("document_id", "=", documentId)
            .where("user_id", "=", userId)
            .executeTakeFirst();
        return row ? (row.access_level as AccessLevel) : null;
    }

    // Updates last_viewed_at to now() for an existing (documentId, userId) access row.
    // Pure UPDATE (no INSERT) — access must be granted explicitly via upsertDocumentAccess.
    // Called fire-and-forget from handleJoinDoc — a failed write must not block the join.
    async upsertLastViewedAt(documentId: number, userId: number): Promise<void> {
        const db = servicesStore.databaseService.kysely;
        await db
            .updateTable("document_user_meta")
            .set({ last_viewed_at: sql`now()` })
            .where("document_id", "=", documentId)
            .where("user_id", "=", userId)
            .execute();
    }

    // Updates last_edited_at to now() for an existing (documentId, userId) access row.
    // Pure UPDATE (no INSERT) — access must be granted explicitly via upsertDocumentAccess.
    // Called fire-and-forget from handleSyncDoc — a failed write must not block the relay.
    async upsertLastEditedAt(documentId: number, userId: number): Promise<void> {
        const db = servicesStore.databaseService.kysely;
        await db
            .updateTable("document_user_meta")
            .set({ last_edited_at: sql`now()` })
            .where("document_id", "=", documentId)
            .where("user_id", "=", userId)
            .execute();
    }

    // Returns a page of documents the user has access to, sorted by last_viewed_at DESC, document_id DESC.
    // Uses a compound cursor (lastViewedAt, lastId) for stable keyset pagination.
    // Only includes docs where a document_user_meta row exists (i.e. the user has been granted access).
    async getUserViewedDocs(
        userId: number,
        limit: number,
        cursor?: { lastViewedAt: string; lastId: number },
    ): Promise<DocumentLibraryData> {
        const db = servicesStore.databaseService.kysely;
        const rows = await sql<{
            document_id: number;
            title: string;
            created_by_name: string | null;
            last_viewed_at: Date;
            last_edited_at: Date | null;
            access_level: string;
        }>`
            SELECT dm.document_id, dm.title, u.display_name AS created_by_name,
                   dum.last_viewed_at, dum.last_edited_at, dum.access_level
            FROM document_user_meta dum
            JOIN document_meta dm ON dm.document_id = dum.document_id
            LEFT JOIN users u ON u.id = dm.created_by_id
            WHERE dum.user_id = ${userId}
              ${cursor !== undefined
                  ? sql`AND (dum.last_viewed_at, dm.document_id) < (${cursor.lastViewedAt}::timestamptz, ${cursor.lastId})`
                  : sql``}
            ORDER BY dum.last_viewed_at DESC, dm.document_id DESC
            LIMIT ${limit}
        `.execute(db);

        const documents = rows.rows.map((row) => ({
            id: row.document_id,
            title: row.title,
            createdByName: row.created_by_name,
            lastViewedAt: row.last_viewed_at.toISOString(),
            lastEditedAt: row.last_edited_at ? row.last_edited_at.toISOString() : null,
            accessLevel: row.access_level as AccessLevel,
        }));
        const last = documents[documents.length - 1];
        const nextCursor = documents.length === limit && last
            ? { lastId: last.id, lastViewedAt: last.lastViewedAt }
            : null;
        return { documents, nextCursor };
    }

    // Trigram similarity search on titles scoped to docs the user has access to.
    // Results below TITLE_SEARCH_SIMILARITY_THRESHOLD are filtered out, ordered by similarity DESC.
    // Not paginated — search results are expected to be small enough to return in full.
    async searchUserViewedDocsByTitle(userId: number, query: string): Promise<DocumentSearchData> {
        const db = servicesStore.databaseService.kysely;
        const rows = await sql<{
            document_id: number;
            title: string;
            created_by_name: string | null;
            last_viewed_at: Date;
            last_edited_at: Date | null;
            access_level: string;
        }>`
            SELECT dm.document_id, dm.title, u.display_name AS created_by_name,
                   dum.last_viewed_at, dum.last_edited_at, dum.access_level
            FROM document_user_meta dum
            JOIN document_meta dm ON dm.document_id = dum.document_id
            LEFT JOIN users u ON u.id = dm.created_by_id
            WHERE dum.user_id = ${userId}
              AND similarity(dm.title, ${query}) > ${TITLE_SEARCH_SIMILARITY_THRESHOLD}
            ORDER BY similarity(dm.title, ${query}) DESC
        `.execute(db);

        const documents = rows.rows.map((row) => ({
            id: row.document_id,
            title: row.title,
            createdByName: row.created_by_name,
            lastViewedAt: row.last_viewed_at.toISOString(),
            lastEditedAt: row.last_edited_at ? row.last_edited_at.toISOString() : null,
            accessLevel: row.access_level as AccessLevel,
        }));
        return { documents };
    }

    // Returns a paginated list of users who have access to a document.
    // Sorted by user_id ASC with a simple integer cursor for stable pagination.
    async getDocumentMembers(
        documentId: number,
        limit: number,
        cursor?: number,
    ): Promise<DocumentMembersData> {
        const db = servicesStore.databaseService.kysely;
        const rows = await sql<{
            user_id: number;
            display_name: string | null;
            avatar_url: string | null;
            access_level: string;
        }>`
            SELECT dum.user_id, u.display_name, u.avatar_url, dum.access_level
            FROM document_user_meta dum
            JOIN users u ON u.id = dum.user_id
            WHERE dum.document_id = ${documentId}
              ${cursor !== undefined ? sql`AND dum.user_id > ${cursor}` : sql``}
            ORDER BY dum.user_id ASC
            LIMIT ${limit}
        `.execute(db);

        const members: DocumentMember[] = rows.rows.map((row) => ({
            userId: row.user_id,
            displayName: row.display_name,
            avatarUrl: row.avatar_url,
            accessLevel: row.access_level as AccessLevel,
        }));
        const nextCursor = members.length === limit && members[members.length - 1]
            ? members[members.length - 1]!.userId
            : null;
        return { members, nextCursor };
    }

    // Grants or updates access for a user on a document.
    // Inserts a new row if none exists; updates access_level if the row already exists.
    // last_viewed_at defaults to now() on INSERT; not touched on UPDATE.
    async upsertDocumentAccess(
        documentId: number,
        userId: number,
        accessLevel: AccessLevel,
    ): Promise<void> {
        const db = servicesStore.databaseService.kysely;
        await db
            .insertInto("document_user_meta")
            .values({
                document_id: documentId,
                user_id: userId,
                access_level: accessLevel,
                last_viewed_at: sql`now()`,
                last_edited_at: null,
            })
            .onConflict((oc) =>
                oc.columns(["document_id", "user_id"]).doUpdateSet({
                    access_level: accessLevel,
                }),
            )
            .execute();
    }

    // Revokes a user's access to a document by deleting their document_user_meta row.
    // Callers must ensure the target user is not the owner before calling this.
    async removeDocumentAccess(documentId: number, userId: number): Promise<void> {
        const db = servicesStore.databaseService.kysely;
        await db
            .deleteFrom("document_user_meta")
            .where("document_id", "=", documentId)
            .where("user_id", "=", userId)
            .execute();
    }

    // Searches the users table by display_name or email (case-insensitive ILIKE).
    // Returns up to `limit` results, each decorated with the user's current access level
    // on `documentId` (null if they have no row in document_user_meta for that doc).
    // Uses similarity() on display_name backed by the GIN trigram index (migration 6).
    // GIN indexes don't store NULLs so the IS NOT NULL guard is for clarity only — not a
    // separate filtering step. Results ordered by score so best matches appear first.
    async searchUsersForDoc(
        documentId: number,
        query: string,
        limit: number,
    ): Promise<DocumentUserSearchData> {
        const db = servicesStore.databaseService.kysely;
        const rows = await sql<{
            id: number;
            display_name: string | null;
            avatar_url: string | null;
            email: string;
            access_level: string | null;
        }>`
            SELECT u.id, u.display_name, u.avatar_url, u.email, dum.access_level
            FROM users u
            LEFT JOIN document_user_meta dum
              ON dum.user_id = u.id AND dum.document_id = ${documentId}
            WHERE u.display_name IS NOT NULL
              AND similarity(u.display_name, ${query}) > ${USER_SEARCH_SIMILARITY_THRESHOLD}
            ORDER BY similarity(u.display_name, ${query}) DESC
            LIMIT ${limit}
        `.execute(db);

        const users: UserSearchResult[] = rows.rows.map((row) => ({
            id: row.id,
            displayName: row.display_name,
            avatarUrl: row.avatar_url,
            email: row.email,
            accessLevel: row.access_level ? (row.access_level as AccessLevel) : null,
        }));
        return { users };
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
