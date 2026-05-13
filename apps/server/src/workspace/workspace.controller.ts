import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
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
  SetSelectedWorkspaceResponseDto,
} from '@converge/shared';
import { CreateWorkspaceRequestSchema } from '@converge/shared';

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
