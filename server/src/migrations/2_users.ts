// Users table migration.
// up: creates the users table with auto-increment integer PK and a unique email index.
// down: drops the index then the table.

import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    // Auto-increment integer PK — id is the internal user identifier.
    // Email is the natural unique key used to look up users from Supabase auth data.
    await db.schema
        .createTable("users")
        .ifNotExists()
        .addColumn("id", "serial", (c) => c.primaryKey())
        .addColumn("email", "text", (c) => c.notNull().unique())
        .addColumn("display_name", "text")
        .addColumn("avatar_url", "text")
        .addColumn("created_at", "timestamptz", (c) =>
            c.notNull().defaultTo(sql`now()`),
        )
        .addColumn("updated_at", "timestamptz", (c) =>
            c.notNull().defaultTo(sql`now()`),
        )
        .execute();

    // Explicit index on email for fast lookups on every login.
    await db.schema
        .createIndex("users_email_idx")
        .ifNotExists()
        .on("users")
        .column("email")
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    // Drop index before table — index depends on the table.
    await db.schema.dropIndex("users_email_idx").ifExists().execute();
    await db.schema.dropTable("users").ifExists().execute();
}
