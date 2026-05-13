import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../db/database.service';
import { sql } from 'kysely';
import { hasWorkspaceRole, WORKSPACE_ROLE_RANK } from '@converge/shared';
import type {
  CreateWorkspaceResponseDto,
  GetWorkspacesResponseDto,
  SearchWorkspacesResponseDto,
  SetSelectedWorkspaceResponseDto,
  UpdateWorkspaceRequestDto,
  WorkspaceOverviewResponseDto,
  GetWorkspaceMembersResponseDto,
  SearchWorkspaceMembersResponseDto,
  FindNewWorkspaceUserResponseDto,
  AddWorkspaceMemberRequestDto,
  AddWorkspaceMemberResponseDto,
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
      throw new ForbiddenException('You do not have access to this workspace.');
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
   * Returns a paginated list of workspace members ordered by user_id ASC.
   * Accessible to all workspace members.
   *
   * @param workspaceId - The workspace to list members for.
   * @param userId - The authenticated user (must be a member).
   * @param limit - Maximum results per page (default 20).
   * @param cursorId - Last user_id from the previous page; omit for the first page.
   * @returns Members array and nextCursor (null on the last page).
   */
  async getMembers(
    workspaceId: number,
    userId: number,
    limit: number,
    cursorId?: number,
  ): Promise<GetWorkspaceMembersResponseDto> {
    const db = this.dbService.kysely;

    // Verify the workspace exists and the caller is a member.
    const memberWs = await db
      .selectFrom('workspaces')
      .select('id')
      .where('id', '=', workspaceId)
      .executeTakeFirst();

    if (!memberWs) throw new NotFoundException('Workspace not found.');

    const memberShip = await db
      .selectFrom('workspace_members')
      .select('user_id')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!memberShip) {
      throw new ForbiddenException('You do not have access to this workspace.');
    }

    let query = db
      .selectFrom('workspace_members as wm')
      .innerJoin('users as u', 'u.id', 'wm.user_id')
      .select(['u.id', 'u.name', 'u.email', 'u.avatar_url', 'wm.role'])
      .where('wm.workspace_id', '=', workspaceId)
      .orderBy('wm.user_id', 'asc')
      .limit(limit);

    if (cursorId !== undefined) {
      query = query.where('wm.user_id', '>', cursorId);
    }

    const rows = await query.execute();

    const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;

    return {
      members: rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        avatarUrl: r.avatar_url,
        role: r.role,
      })),
      nextCursor,
    };
  }

  /**
   * Searches existing workspace members by email using trigram similarity.
   * Accessible to all workspace members.
   *
   * @param workspaceId - The workspace to search within.
   * @param userId - The authenticated user (must be a member).
   * @param email - The email query to match against.
   * @returns Matching members ordered by similarity descending.
   */
  async searchMembers(
    workspaceId: number,
    userId: number,
    email: string,
  ): Promise<SearchWorkspaceMembersResponseDto> {
    const db = this.dbService.kysely;

    // Verify the workspace exists and the caller is a member.
    const smWs = await db
      .selectFrom('workspaces')
      .select('id')
      .where('id', '=', workspaceId)
      .executeTakeFirst();

    if (!smWs) throw new NotFoundException('Workspace not found.');

    const smMember = await db
      .selectFrom('workspace_members')
      .select('user_id')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!smMember) {
      throw new ForbiddenException('You do not have access to this workspace.');
    }

    const rows = await db
      .selectFrom('workspace_members as wm')
      .innerJoin('users as u', 'u.id', 'wm.user_id')
      .select([
        'u.id',
        'u.name',
        'u.email',
        'u.avatar_url',
        'wm.role',
        sql<number>`similarity(u.email, ${email})`.as('score'),
      ])
      .where('wm.workspace_id', '=', workspaceId)
      .orderBy('score', 'desc')
      .limit(5)
      .execute();

    return {
      members: rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        avatarUrl: r.avatar_url,
        role: r.role,
      })),
    };
  }

  /**
   * Looks up a user by exact email who is not yet a member of the workspace.
   * Requires admin+ access.
   *
   * @param workspaceId - The workspace to check against.
   * @param email - The exact email address to look up.
   * @param userId - The authenticated user (must be admin+).
   * @returns The matched user's id, name, email, and avatarUrl.
   * @throws 404 if the workspace or user is not found.
   * @throws 403 if the requester lacks admin+ access.
   * @throws 409 if the user is already a member.
   */
  async findNewUser(
    workspaceId: number,
    email: string,
    userId: number,
  ): Promise<FindNewWorkspaceUserResponseDto> {
    const db = this.dbService.kysely;

    // Verify the workspace exists and the caller is admin+.
    const fnuWs = await db
      .selectFrom('workspaces')
      .select('id')
      .where('id', '=', workspaceId)
      .executeTakeFirst();

    if (!fnuWs) throw new NotFoundException('Workspace not found.');

    const fnuMember = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!fnuMember || !hasWorkspaceRole(fnuMember.role, 'admin')) {
      throw new ForbiddenException('You do not have access to this workspace.');
    }

    // Look up the user by exact email.
    const userRow = await db
      .selectFrom('users')
      .select(['id', 'name', 'email', 'avatar_url'])
      .where('email', '=', email)
      .executeTakeFirst();

    if (!userRow) throw new NotFoundException('User not found.');

    // Reject if the user is already a member (owner is also a member).
    const existingMember = await db
      .selectFrom('workspace_members')
      .select('user_id')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userRow.id)
      .executeTakeFirst();

    if (existingMember) {
      throw new ConflictException('User is already a member.');
    }

    return {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      avatarUrl: userRow.avatar_url,
    };
  }

  /**
   * Adds a new member or updates an existing member's role. Only the owner
   * can assign the admin role or modify another admin's role. Admins may add
   * or modify members with role=member only.
   *
   * @param workspaceId - The workspace to add the member to.
   * @param userId - The authenticated user (must be admin+).
   * @param body - The email and role for the target user.
   * @returns The added or updated member.
   * @throws 404 if the workspace or target user is not found.
   * @throws 403 if the requester lacks the required role.
   * @throws 409 if the target is the workspace owner.
   */
  async addMember(
    workspaceId: number,
    userId: number,
    body: AddWorkspaceMemberRequestDto,
  ): Promise<AddWorkspaceMemberResponseDto> {
    const db = this.dbService.kysely;

    // Verify the workspace exists.
    const ws = await db
      .selectFrom('workspaces')
      .select(['id', 'owner_id'])
      .where('id', '=', workspaceId)
      .executeTakeFirst();

    if (!ws) throw new NotFoundException('Workspace not found.');

    // Verify the caller is admin+.
    const membership = await db
      .selectFrom('workspace_members')
      .select(['user_id', 'role'])
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!membership || !hasWorkspaceRole(membership.role, 'admin')) {
      throw new ForbiddenException('You do not have access to this workspace.');
    }

    const isOwner = membership.role === 'owner';

    // Look up the target user by email.
    const targetUser = await db
      .selectFrom('users')
      .select(['id', 'name', 'email', 'avatar_url'])
      .where('email', '=', body.email)
      .executeTakeFirst();

    if (!targetUser) throw new NotFoundException('User not found.');

    // Reject if the target is the workspace owner.
    if (targetUser.id === ws.owner_id) {
      throw new ConflictException('Cannot modify the workspace owner.');
    }

    // Check existing membership to determine if this is an add or role change.
    const existingMember = await db
      .selectFrom('workspace_members')
      .select(['user_id', 'role'])
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', targetUser.id)
      .executeTakeFirst();

    // Only the owner can assign or change to admin, or modify an existing admin.
    if (!isOwner) {
      if (body.role === 'admin') {
        throw new ForbiddenException(
          'Only the owner can assign the admin role.',
        );
      }
      if (existingMember && existingMember.role === 'admin') {
        throw new ForbiddenException('Only the owner can modify an admin.');
      }
    }

    // Upsert the membership row.
    const upserted = await db
      .insertInto('workspace_members')
      .values({
        workspace_id: workspaceId,
        user_id: targetUser.id,
        role: body.role,
      })
      .onConflict((oc) =>
        oc.columns(['workspace_id', 'user_id']).doUpdateSet({
          role: body.role,
        }),
      )
      .returning(['role'])
      .executeTakeFirstOrThrow();

    return {
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      avatarUrl: targetUser.avatar_url,
      role: upserted.role,
    };
  }

  /**
   * Removes a member from the workspace. Only the owner can remove an admin.
   *
   * @param workspaceId - The workspace to remove the member from.
   * @param userId - The authenticated user (must be admin+).
   * @param targetUserId - The user to remove.
   * @throws 404 if the workspace or member row is not found.
   * @throws 403 if the requester lacks the required role.
   * @throws 409 if the target is the workspace owner.
   */
  async removeMember(
    workspaceId: number,
    userId: number,
    targetUserId: number,
  ): Promise<void> {
    const db = this.dbService.kysely;

    // Verify the workspace exists.
    const ws = await db
      .selectFrom('workspaces')
      .select(['id', 'owner_id'])
      .where('id', '=', workspaceId)
      .executeTakeFirst();

    if (!ws) throw new NotFoundException('Workspace not found.');

    // Verify the caller is admin+.
    const membership = await db
      .selectFrom('workspace_members')
      .select(['user_id', 'role'])
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!membership || !hasWorkspaceRole(membership.role, 'admin')) {
      throw new ForbiddenException('You do not have access to this workspace.');
    }

    // Reject if the target is the workspace owner.
    if (targetUserId === ws.owner_id) {
      throw new ConflictException('Cannot remove the workspace owner.');
    }

    const isOwner = membership.role === 'owner';

    // Only the owner can remove an admin.
    if (!isOwner) {
      const targetMember = await db
        .selectFrom('workspace_members')
        .select('role')
        .where('workspace_id', '=', workspaceId)
        .where('user_id', '=', targetUserId)
        .executeTakeFirst();

      if (targetMember && targetMember.role === 'admin') {
        throw new ForbiddenException('Only the owner can remove an admin.');
      }
    }

    // Delete the membership row.
    const result = await db
      .deleteFrom('workspace_members')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', targetUserId)
      .executeTakeFirst();

    if (!result.numDeletedRows) {
      throw new NotFoundException('Member not found.');
    }
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
