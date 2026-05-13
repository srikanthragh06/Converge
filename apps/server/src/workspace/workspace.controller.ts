import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { Request } from 'express';
import { WorkspaceService } from './workspace.service';
import { httpOK } from '../utils/http-response.util';
import { ZodHttpValidationPipe } from '../pipes/zod-http-validation.pipe';
import type {
  CreateWorkspaceRequestDto,
  CreateWorkspaceResponseDto,
  GetWorkspacesResponseDto,
  SearchWorkspacesRequestDto,
  SearchWorkspacesResponseDto,
  SetSelectedWorkspaceResponseDto,
  UpdateWorkspaceRequestDto,
  WorkspaceOverviewResponseDto,
  GetWorkspaceMembersRequestDto,
  GetWorkspaceMembersResponseDto,
  SearchWorkspaceMembersRequestDto,
  SearchWorkspaceMembersResponseDto,
  FindNewWorkspaceUserRequestDto,
  FindNewWorkspaceUserResponseDto,
  AddWorkspaceMemberRequestDto,
  AddWorkspaceMemberResponseDto,
} from '@converge/shared';
import {
  CreateWorkspaceRequestSchema,
  SearchWorkspacesRequestSchema,
  UpdateWorkspaceRequestSchema,
  GetWorkspaceMembersRequestSchema,
  SearchWorkspaceMembersRequestSchema,
  FindNewWorkspaceUserRequestSchema,
  AddWorkspaceMemberRequestSchema,
} from '@converge/shared';

@Controller('/workspaces')
@UseGuards(AuthGuard)
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  /**
   * Creates a new custom workspace with the authenticated user as owner.
   *
   * @param req - The Express request with userId stamped by AuthGuard.
   * @param body - The workspace name.
   * @returns The newly created workspace with the caller's role.
   */
  @Post('/')
  async handleCreateWorkspace(
    @Req() req: Request,
    @Body(new ZodHttpValidationPipe(CreateWorkspaceRequestSchema))
    body: CreateWorkspaceRequestDto,
  ): Promise<CreateWorkspaceResponseDto> {
    const userId = (req as any).userId as number;
    return httpOK(
      await this.workspaceService.createWorkspace(userId, body.name),
    );
  }

  /**
   * Returns all workspaces the authenticated user is a member of.
   *
   * @param req - The Express request with userId stamped by AuthGuard.
   * @returns The user's workspaces with their role in each.
   */
  @Get('/')
  async handleGetWorkspaces(
    @Req() req: Request,
  ): Promise<GetWorkspacesResponseDto> {
    const userId = (req as any).userId as number;
    const workspaces = await this.workspaceService.getWorkspaces(userId);
    return httpOK(workspaces);
  }

  /**
   * Searches the authenticated user's workspaces by name using trigram
   * similarity, ordered by relevance descending.
   *
   * @param req - The Express request with userId stamped by AuthGuard.
   * @param query - The search query.
   * @returns Matching workspaces ordered by similarity score descending.
   */
  @Get('/search')
  async handleSearchWorkspaces(
    @Req() req: Request,
    @Query(new ZodHttpValidationPipe(SearchWorkspacesRequestSchema))
    query: SearchWorkspacesRequestDto,
  ): Promise<SearchWorkspacesResponseDto> {
    const userId = (req as any).userId as number;
    return httpOK(
      await this.workspaceService.searchWorkspaces(userId, query.q),
    );
  }

  /**
   * Returns workspace overview details (member count, document count, owner
   * info, created date). Only accessible to workspace members.
   *
   * @param id - The workspace ID.
   * @param req - The Express request with userId stamped by AuthGuard.
   * @returns Workspace name, type, member/doc counts, owner name/email, created date.
   */
  @Get('/:id/overview')
  async handleGetWorkspaceOverview(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ): Promise<WorkspaceOverviewResponseDto> {
    const userId = (req as any).userId as number;
    return httpOK(await this.workspaceService.getOverview(id, userId));
  }

  /**
   * Updates the workspace name. Only workspace admins and owners can rename.
   *
   * @param id - The workspace ID.
   * @param body - The updated fields.
   * @param req - The Express request with userId stamped by AuthGuard.
   * @returns The updated workspace.
   */
  @Patch('/:id')
  async handleUpdateWorkspace(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodHttpValidationPipe(UpdateWorkspaceRequestSchema))
    body: UpdateWorkspaceRequestDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).userId as number;
    return httpOK(
      await this.workspaceService.updateWorkspace(id, userId, body),
    );
  }

  /**
   * Sets the authenticated user's selected workspace. No membership check
   * is required — guests can be switched to a foreign workspace when visiting
   * a document link so the sidebar stays in sync.
   *
   * @param id - The workspace ID to select.
   * @param req - The Express request with userId stamped by AuthGuard.
   * @returns The selected workspace's id and name.
   */
  @Put('/:id/select')
  async handleSetSelectedWorkspace(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ): Promise<SetSelectedWorkspaceResponseDto> {
    const userId = (req as any).userId as number;
    const workspace = await this.workspaceService.setSelectedWorkspace(
      id,
      userId,
    );
    return httpOK(workspace);
  }

  /**
   * Returns a paginated list of workspace members. Accessible to all members.
   *
   * @param id - The workspace ID.
   * @param query - Optional limit and cursorId for keyset pagination.
   * @param req - The Express request with userId stamped by AuthGuard.
   * @returns Members array and nextCursor.
   */
  @Get('/:id/members')
  async handleGetWorkspaceMembers(
    @Param('id', ParseIntPipe) id: number,
    @Query(new ZodHttpValidationPipe(GetWorkspaceMembersRequestSchema))
    query: GetWorkspaceMembersRequestDto,
    @Req() req: Request,
  ): Promise<GetWorkspaceMembersResponseDto> {
    const userId = (req as any).userId as number;
    const limit = query.limit ?? 20;
    return httpOK(
      await this.workspaceService.getMembers(id, userId, limit, query.cursorId),
    );
  }

  /**
   * Searches existing workspace members by email. Accessible to all members.
   *
   * @param id - The workspace ID.
   * @param query - The email query string.
   * @param req - The Express request with userId stamped by AuthGuard.
   * @returns Matching members ordered by similarity descending.
   */
  @Get('/:id/members/search')
  async handleSearchWorkspaceMembers(
    @Param('id', ParseIntPipe) id: number,
    @Query(new ZodHttpValidationPipe(SearchWorkspaceMembersRequestSchema))
    query: SearchWorkspaceMembersRequestDto,
    @Req() req: Request,
  ): Promise<SearchWorkspaceMembersResponseDto> {
    const userId = (req as any).userId as number;
    return httpOK(
      await this.workspaceService.searchMembers(id, userId, query.email),
    );
  }

  /**
   * Looks up a user by exact email who is not yet a member of this workspace.
   * Requires admin+ access.
   *
   * @param id - The workspace ID.
   * @param query - The exact email address to look up.
   * @param req - The Express request with userId stamped by AuthGuard.
   * @returns The matched user's id, name, email, and avatarUrl.
   */
  @Get('/:id/findNewUser')
  async handleFindNewWorkspaceUser(
    @Param('id', ParseIntPipe) id: number,
    @Query(new ZodHttpValidationPipe(FindNewWorkspaceUserRequestSchema))
    query: FindNewWorkspaceUserRequestDto,
    @Req() req: Request,
  ): Promise<FindNewWorkspaceUserResponseDto> {
    const userId = (req as any).userId as number;
    return httpOK(
      await this.workspaceService.findNewUser(id, query.email, userId),
    );
  }

  /**
   * Adds a member or updates an existing member's role. Requires admin+
   * access. Only the owner can assign admin or modify existing admins.
   *
   * @param id - The workspace ID.
   * @param body - The email and role for the target user.
   * @param req - The Express request with userId stamped by AuthGuard.
   * @returns The added or updated member.
   */
  @Post('/:id/members')
  async handleAddWorkspaceMember(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodHttpValidationPipe(AddWorkspaceMemberRequestSchema))
    body: AddWorkspaceMemberRequestDto,
    @Req() req: Request,
  ): Promise<AddWorkspaceMemberResponseDto> {
    const userId = (req as any).userId as number;
    return httpOK(await this.workspaceService.addMember(id, userId, body));
  }

  /**
   * Removes a member from the workspace. Requires admin+ access. Only the
   * owner can remove an admin.
   *
   * @param id - The workspace ID.
   * @param targetUserId - The user ID to remove.
   * @param req - The Express request with userId stamped by AuthGuard.
   */
  @Delete('/:id/members/:targetUserId')
  async handleRemoveWorkspaceMember(
    @Param('id', ParseIntPipe) id: number,
    @Param('targetUserId', ParseIntPipe) targetUserId: number,
    @Req() req: Request,
  ): Promise<void> {
    const userId = (req as any).userId as number;
    await this.workspaceService.removeMember(id, userId, targetUserId);
  }
}
