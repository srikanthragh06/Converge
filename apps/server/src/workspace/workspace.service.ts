import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../db/database.service';
import type {
  CreateWorkspaceResponseDto,
  GetWorkspacesResponseDto,
  SetSelectedWorkspaceResponseDto,
} from '@converge/shared';

@Injectable()
export class WorkspaceService {
  constructor(private readonly dbService: DatabaseService) {}

  /**
   * Creates a personal workspace with an owner membership row for the user if
   * one does not already exist. Runs in a transaction so that a partial write
   * (workspace without membership row) is never committed.
   *
   * @param userId - The user to create the personal workspace for.
   * @param userName - The user's display name, used to form the workspace name.
   * @returns The workspace's id and name — either the newly created one or the
   *          existing personal workspace for this user.
   */
  async upsertUserPersonalWorkspace(
    userId: number,
    userName: string,
  ): Promise<{ id: number; name: string }> {
    const db = this.dbService.kysely;

    const workspace = await db.transaction().execute(async (tx) => {
      // Check whether a personal workspace already exists for this user.
      const existing = await tx
        .selectFrom('workspaces')
        .select(['id', 'name'])
        .where('owner_id', '=', userId)
        .where('type', '=', 'personal')
        .executeTakeFirst();

      if (existing) return existing; // already set up — nothing to do.

      // Create the workspace using the user's name.
      const name = `${userName}'s Workspace`;
      const ws = await tx
        .insertInto('workspaces')
        .values({
          name,
          owner_id: userId,
          type: 'personal',
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      // Insert the owner membership row so access resolution sees role='owner'.
      await tx
        .insertInto('workspace_members')
        .values({
          workspace_id: ws.id,
          user_id: userId,
          role: 'owner',
        })
        .execute();

      // Set this as the user's selected workspace so the client can read it
      // from /auth/me on every page load.
      await tx
        .updateTable('users')
        .set({ current_workspace_id: ws.id })
        .where('id', '=', userId)
        .execute();

      return { id: ws.id, name };
    });

    return workspace;
  }

  /**
   * Creates a new custom workspace with the caller as owner.
   * Runs in a transaction so a workspace without a membership row is never committed.
   *
   * @param userId - The authenticated user who will own the workspace.
   * @param name - The display name for the workspace.
   * @returns The created workspace with the caller's role (owner).
   */
  async createWorkspace(
    userId: number,
    name: string,
  ): Promise<CreateWorkspaceResponseDto> {
    const db = this.dbService.kysely;

    return await db.transaction().execute(async (tx) => {
      const ws = await tx
        .insertInto('workspaces')
        .values({ name, owner_id: userId, type: 'custom' })
        .returning(['id', 'name', 'type'])
        .executeTakeFirstOrThrow();

      await tx
        .insertInto('workspace_members')
        .values({ workspace_id: ws.id, user_id: userId, role: 'owner' })
        .execute();

      return {
        id: ws.id,
        name: ws.name,
        type: ws.type,
        role: 'owner' as const,
      };
    });
  }

  /**
   * Returns every workspace the user is a member of, joined with their role.
   *
   * @param userId - The authenticated user.
   * @returns Workspaces with the user's role in each.
   */
  async getWorkspaces(userId: number): Promise<GetWorkspacesResponseDto> {
    const db = this.dbService.kysely;

    const rows = await db
      .selectFrom('workspace_members as wm')
      .innerJoin('workspaces as w', 'w.id', 'wm.workspace_id')
      .select(['w.id', 'w.name', 'w.type', 'wm.role'])
      .where('wm.user_id', '=', userId)
      .execute();

    return { workspaces: rows };
  }

  /**
   * Sets the user's selected workspace. No membership check — guests can
   * be switched to a foreign workspace when visiting a document link.
   *
   * @param workspaceId - The workspace to switch to.
   * @param userId - The authenticated user.
   * @returns The selected workspace's id and name.
   */
  async setSelectedWorkspace(
    workspaceId: number,
    userId: number,
  ): Promise<SetSelectedWorkspaceResponseDto> {
    const db = this.dbService.kysely;

    // Verify the workspace exists — no membership check so guests can
    // be switched to a foreign workspace when visiting a document link.
    const ws = await db
      .selectFrom('workspaces')
      .select(['id', 'name'])
      .where('id', '=', workspaceId)
      .executeTakeFirst();

    if (!ws) throw new NotFoundException('Workspace not found.');

    // Persist the selection so it survives page reloads.
    await db
      .updateTable('users')
      .set({ current_workspace_id: workspaceId })
      .where('id', '=', userId)
      .execute();

    return { id: ws.id, name: ws.name };
  }
}
