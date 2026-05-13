import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
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
} from '@converge/shared';
import {
  CreateWorkspaceRequestSchema,
  SearchWorkspacesRequestSchema,
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
}
