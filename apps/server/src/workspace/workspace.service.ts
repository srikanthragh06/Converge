import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../db/database.service';
import { sql } from 'kysely';
import {
  hasWorkspaceRole,
  WORKSPACE_ROLE_RANK,
} from '@converge/shared';
import type {
  CreateWorkspaceResponseDto,
  GetWorkspacesResponseDto,
  SearchWorkspacesResponseDto,
  SetSelectedWorkspaceResponseDto,
  UpdateWorkspaceRequestDto,
  WorkspaceOverviewResponseDto,
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
        .values({
          workspace_id: ws.id,
          user_id: userId,
          role: 'owner',
          last_visited_at: new Date(),
        })
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
      .innerJoin('users as owner', 'owner.id', 'w.owner_id')
      .leftJoin('users as me', 'me.id', 'wm.user_id')
      .select([
        'w.id',
        'w.name',
        'w.type',
        'wm.role',
        'w.owner_id',
        'owner.name as ownerName',
        'me.current_workspace_id',
      ])
      .where('wm.user_id', '=', userId)
      .orderBy(sql`wm.last_visited_at DESC NULLS LAST`)
      .execute();

    return {
      workspaces: rows.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        role: r.role,
        ownerId: r.owner_id,
        ownerName: r.ownerName,
        isSelected: r.id === r.current_workspace_id,
      })),
    };
  }

  /**
   * Searches the user's workspaces by name using trigram similarity,
   * ordered by relevance descending.
   *
   * @param userId - The authenticated user.
   * @param query - The search string.
   * @returns Matching workspaces ordered by similarity score descending.
   */
  async searchWorkspaces(
    userId: number,
    query: string,
  ): Promise<SearchWorkspacesResponseDto> {
    const db = this.dbService.kysely;

    const rows = await db
      .selectFrom('workspace_members as wm')
      .innerJoin('workspaces as w', 'w.id', 'wm.workspace_id')
      .innerJoin('users as owner', 'owner.id', 'w.owner_id')
      .leftJoin('users as me', 'me.id', 'wm.user_id')
      .select([
        'w.id',
        'w.name',
        'w.type',
        'wm.role',
        'w.owner_id',
        'owner.name as ownerName',
        'me.current_workspace_id',
        sql<number>`similarity(w.name, ${query})`.as('score'),
      ])
      .where('wm.user_id', '=', userId)
      .orderBy('score', 'desc')
      .limit(5)
      .execute();

    return {
      workspaces: rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        role: r.role,
        ownerId: r.owner_id,
        ownerName: r.ownerName,
        isSelected: r.id === r.current_workspace_id,
      })),
    };
  }

  /**
   * Returns workspace overview details including member count, document count,
   * and owner info. Only accessible to workspace members — a non-member gets 403.
   *
   * @param workspaceId - The workspace to get overview for.
   * @param userId - The authenticated user whose membership is verified.
   * @returns Workspace name, type, member/doc counts, owner name/email, created date.
   */
  async getOverview(
    workspaceId: number,
    userId: number,
  ): Promise<WorkspaceOverviewResponseDto> {
    const db = this.dbService.kysely;

    // Verify the workspace exists.
    const ws = await db
      .selectFrom('workspaces')
      .select('id')
      .where('id', '=', workspaceId)
      .executeTakeFirst();

    if (!ws) throw new NotFoundException('Workspace not found.');

    // Verify the caller is a member.
    const membership = await db
      .selectFrom('workspace_members')
      .select('user_id')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!membership) {
      throw new ForbiddenException('You do not have access to this workspace.');
    }

    // Fetch workspace + owner info.
    const workspace = await db
      .selectFrom('workspaces as w')
      .innerJoin('users as owner', 'owner.id', 'w.owner_id')
      .select([
        'w.name',
        'w.type',
        'w.created_at',
        'owner.name as ownerName',
        'owner.email as ownerEmail',
      ])
      .where('w.id', '=', workspaceId)
      .executeTakeFirstOrThrow();

    const membersCount = await db
      .selectFrom('workspace_members')
      .select(db.fn.countAll<number>().as('count'))
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirstOrThrow();

    const documentsCount = await db
      .selectFrom('documents')
      .select(db.fn.countAll<number>().as('count'))
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirstOrThrow();

    return {
      name: workspace.name,
      type: workspace.type,
      membersCount: Number(membersCount.count),
      documentsCount: Number(documentsCount.count),
      ownerName: workspace.ownerName,
      ownerEmail: workspace.ownerEmail,
      createdAt: (workspace.created_at as Date).toISOString(),
    };
  }

  /**
   * Updates workspace fields. Only workspace admins and owners can perform
   * this action.
   *
   * @param workspaceId - The workspace to update.
   * @param userId - The authenticated user.
   * @param body - The fields to update.
   * @returns The updated workspace id and name.
   */
  async updateWorkspace(
    workspaceId: number,
    userId: number,
    body: UpdateWorkspaceRequestDto,
  ): Promise<{ id: number; name: string }> {
    const db = this.dbService.kysely;

    // Verify the workspace exists.
    const ws = await db
      .selectFrom('workspaces')
      .select('id')
      .where('id', '=', workspaceId)
      .executeTakeFirst();

    if (!ws) throw new NotFoundException('Workspace not found.');

    // Verify the caller is an admin or owner.
    const membership = await db
      .selectFrom('workspace_members')
      .select(['user_id', 'role'])
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!membership || !hasWorkspaceRole(membership.role, 'admin')) {
      throw new ForbiddenException(
        'You do not have access to this workspace.',
      );
    }

    const updated = await db
      .updateTable('workspaces')
      .set({ name: body.name })
      .where('id', '=', workspaceId)
      .returning(['id', 'name'])
      .executeTakeFirstOrThrow();

    return { id: updated.id, name: updated.name };
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

    // Persist the selection and bump recency in a single transaction.
    await db.transaction().execute(async (tx) => {
      await tx
        .updateTable('users')
        .set({ current_workspace_id: workspaceId })
        .where('id', '=', userId)
        .execute();

      await tx
        .updateTable('workspace_members')
        .set({ last_visited_at: new Date() })
        .where('workspace_id', '=', workspaceId)
        .where('user_id', '=', userId)
        .execute();
    });

    return { id: ws.id, name: ws.name };
  }
}
