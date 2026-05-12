import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../db/database.service';
import type {
  GetWorkspacesResponseDto,
  SetSelectedWorkspaceResponseDto,
} from '@converge/shared';

@Injectable()
export class WorkspaceService {
  constructor(private readonly dbService: DatabaseService) {}

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
