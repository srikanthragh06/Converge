import { Injectable } from '@nestjs/common';
import { WorkspaceService } from './workspace.service.js';
import type { ListWorkspacesToolResponseDto } from '@converge/shared';

// MCP tool handlers for the workspace feature. Thin wrapper around
// WorkspaceService — access control is enforced entirely by the underlying
// call (getWorkspaces only ever returns the caller's own memberships), same
// as its HTTP controller equivalent, so no separate authorization check is
// needed here.
@Injectable()
export class WorkspaceTools {
  constructor(private readonly workspaceService: WorkspaceService) {}

  /**
   * Lists every workspace the calling user is a member of. Mirrors
   * GET /workspaces exactly — no MCP-specific transformation needed since
   * the response has no Date fields to convert.
   * @param userId - the calling user's ID, resolved from their API key
   */
  async listWorkspaces(userId: number): Promise<ListWorkspacesToolResponseDto> {
    return this.workspaceService.getWorkspaces(userId);
  }
}
