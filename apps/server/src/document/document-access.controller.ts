import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { type Request } from 'express';
import { DocumentAccessService } from './document-access.service';
import { httpOK } from '../utils/http-response.util';
import {
  GetDocumentAccessUsersRequestSchema,
  SearchDocumentAccessUsersRequestSchema,
  FindNewDocumentAccessUserRequestSchema,
  UpdateDocumentRoleOverridesRequestSchema,
  SetDocumentUserAccessRequestSchema,
  type GetDocumentRoleOverridesResponseDto,
  type UpdateDocumentRoleOverridesResponseDto,
  type UpdateDocumentRoleOverridesRequestDto,
  type GetDocumentAccessResponseDto,
  type SearchDocumentAccessUsersResponseDto,
  type FindNewDocumentAccessUserResponseDto,
  type SetDocumentUserAccessRequestDto,
  type SetDocumentUserAccessResponseDto,
} from '@converge/shared';
import { ZodHttpValidationPipe } from '../pipes/zod-http-validation.pipe';

/** Handles document access management routes. All routes require authentication via AuthGuard. */
@Controller('/document-access')
@UseGuards(AuthGuard)
export class DocumentAccessController {
  constructor(private readonly documentAccessService: DocumentAccessService) {} // documentAccessService — handles all access CRUD and resolution logic

  /**
   * Returns the document's per-role access overrides alongside workspace
   * defaults and the workspace name. Requires resolved document viewer+.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param documentId - the document ID parsed from the URL path
   * @returns per-role doc overrides, workspace defaults, and workspace name
   */
  @Get(':id/role-overrides')
  async handleGetRoleOverrides(
    @Req() req: Request,
    @Param('id', ParseIntPipe) documentId: number,
  ): Promise<GetDocumentRoleOverridesResponseDto> {
    const userId = (req as any).userId as number;
    return httpOK(
      await this.documentAccessService.getRoleOverrides(documentId, userId),
    );
  }

  /**
   * Updates the document's per-role access overrides. A null value resets
   * that role to the workspace default. Requires resolved document admin+.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param documentId - the document ID parsed from the URL path
   * @param body - at least one of adminDocAccess, memberDocAccess, nonMemberDocAccess
   * @returns the three per-role overrides after update
   */
  @Put(':id/role-overrides')
  async handleUpdateRoleOverrides(
    @Req() req: Request,
    @Param('id', ParseIntPipe) documentId: number,
    @Body(new ZodHttpValidationPipe(UpdateDocumentRoleOverridesRequestSchema))
    body: UpdateDocumentRoleOverridesRequestDto,
  ): Promise<UpdateDocumentRoleOverridesResponseDto> {
    const userId = (req as any).userId as number;
    return httpOK(
      await this.documentAccessService.updateRoleOverrides(
        documentId,
        userId,
        body,
      ),
    );
  }

  /**
   * Searches per-user access entries by email using trigram similarity.
   * Requires resolved document viewer+.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param documentId - the document ID parsed from the URL path
   * @param query - email query string (non-empty)
   * @returns matching users ordered by similarity score descending
   */
  @Get(':id/search')
  async handleSearchAccessUsers(
    @Req() req: Request,
    @Param('id', ParseIntPipe) documentId: number,
    @Query(new ZodHttpValidationPipe(SearchDocumentAccessUsersRequestSchema))
    query: { email: string },
  ): Promise<SearchDocumentAccessUsersResponseDto> {
    const userId = (req as any).userId as number;
    return httpOK(
      await this.documentAccessService.searchAccessUsers(
        documentId,
        userId,
        query.email,
      ),
    );
  }

  /**
   * Looks up a user by exact email who has no access row and is not the
   * workspace owner, to populate the "add user" card. Requires resolved
   * document admin+.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param documentId - the document ID parsed from the URL path
   * @param query - exact email address to look up
   * @returns the matched user's profile
   */
  @Get(':id/find-new')
  async handleFindNewAccessUser(
    @Req() req: Request,
    @Param('id', ParseIntPipe) documentId: number,
    @Query(new ZodHttpValidationPipe(FindNewDocumentAccessUserRequestSchema))
    query: { email: string },
  ): Promise<FindNewDocumentAccessUserResponseDto> {
    const userId = (req as any).userId as number;
    return httpOK(
      await this.documentAccessService.findNewAccessUser(
        documentId,
        userId,
        query.email,
      ),
    );
  }

  /**
   * Returns a keyset-paginated list of per-user access entries for the
   * document, ordered by user_id ASC. Requires resolved document viewer+.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param documentId - the document ID parsed from the URL path
   * @param query - optional limit (default 20) and cursorId for pagination
   * @returns users for this page and nextCursor (null on the last page)
   */
  @Get(':id')
  async handleGetAccessUsers(
    @Req() req: Request,
    @Param('id', ParseIntPipe) documentId: number,
    @Query(new ZodHttpValidationPipe(GetDocumentAccessUsersRequestSchema))
    query: { limit?: number; cursorId?: number },
  ): Promise<GetDocumentAccessResponseDto> {
    const userId = (req as any).userId as number;
    const limit = query.limit ?? 20;
    return httpOK(
      await this.documentAccessService.getAccessUsers(
        documentId,
        userId,
        limit,
        query.cursorId,
      ),
    );
  }

  /**
   * Grants or updates a per-user access level for the document (upsert).
   * Requires resolved document admin+.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param documentId - the document ID parsed from the URL path
   * @param targetUserId - the user ID to grant access to
   * @param body - the access level to grant
   * @returns the target user's profile with their new access level
   */
  @Put(':id/user/:userId')
  async handleSetUserAccess(
    @Req() req: Request,
    @Param('id', ParseIntPipe) documentId: number,
    @Param('userId', ParseIntPipe) targetUserId: number,
    @Body(new ZodHttpValidationPipe(SetDocumentUserAccessRequestSchema))
    body: SetDocumentUserAccessRequestDto,
  ): Promise<SetDocumentUserAccessResponseDto> {
    const userId = (req as any).userId as number;
    return httpOK(
      await this.documentAccessService.setUserAccess(
        documentId,
        userId,
        targetUserId,
        body.access,
      ),
    );
  }

  /**
   * Removes the per-user access row for a specific user on the document.
   * Requires resolved document admin+.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param documentId - the document ID parsed from the URL path
   * @param targetUserId - the user whose access row to remove
   */
  @Delete(':id/user/:userId')
  async handleRemoveUserAccess(
    @Req() req: Request,
    @Param('id', ParseIntPipe) documentId: number,
    @Param('userId', ParseIntPipe) targetUserId: number,
  ): Promise<void> {
    const userId = (req as any).userId as number;
    await this.documentAccessService.removeUserAccess(
      documentId,
      userId,
      targetUserId,
    );
  }
}
