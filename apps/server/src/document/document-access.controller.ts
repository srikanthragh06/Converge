import { Controller, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { type Request } from 'express';
import { DocumentAccessService } from './document-access.service';

@Controller('/document-access')
@UseGuards(AuthGuard)
export class DocumentAccessController {
  constructor(private readonly documentAccessService: DocumentAccessService) {} // Handles document access and ownership — all routes require authentication via AuthGuard.

  // /**
  //  * Returns a paginated list of users with explicit access to the given document,
  //  * ordered by user_id ASC. Requires viewer+ access.
  //  * Throws 404 if the document does not exist, 403 if the user has less than viewer access.
  //  * @param req - the Express request, with userId stamped by AuthGuard
  //  * @param documentId - the document ID parsed from the URL path
  //  * @param query - optional limit and cursorId for keyset pagination
  //  * @returns users for this page and nextCursor (null on the last page)
  //  */
  // @Get('/:documentId')
  // async handleGetDocumentAccess(
  //   @Req() req: Request,
  //   @Param('documentId', ParseIntPipe) documentId: number,
  //   @Query(new ZodHttpValidationPipe(GetDocumentAccessRequestSchema))
  //   query: { limit?: number; cursorId?: number },
  // ): Promise<GetDocumentAccessResponseDto> {
  //   const userId = (req as any).userId as number;
  //   const limit = query.limit ?? 20;
  //   return httpOK(
  //     await this.documentAccessService.getDocumentAccessUsers(
  //       documentId,
  //       userId,
  //       limit,
  //       query.cursorId,
  //     ),
  //   );
  // }

  // /**
  //  * Looks up a user by exact email who does not yet have access to the document.
  //  * Returns 404 if the document or user is not found, 403 if not the owner,
  //  * and 409 if the user is the document owner or already has an access row.
  //  * @param req - the Express request, with userId stamped by AuthGuard
  //  * @param documentId - the document ID parsed from the URL path
  //  * @param query - exact email address to look up
  //  * @returns the matched user's id, name, email, and avatarUrl
  //  */
  // @Get('/:documentId/find-new')
  // async handleFindNewDocumentAccessUser(
  //   @Req() req: Request,
  //   @Param('documentId', ParseIntPipe) documentId: number,
  //   @Query(new ZodHttpValidationPipe(FindNewDocumentAccessUserRequestSchema))
  //   query: { email: string },
  // ): Promise<FindNewDocumentAccessUserResponseDto> {
  //   const userId = (req as any).userId as number;
  //   return httpOK(
  //     await this.documentAccessService.findNewDocumentAccessUser(
  //       documentId,
  //       query.email,
  //       userId,
  //     ),
  //   );
  // }

  // /**
  //  * Searches users who already have access to the given document by email using
  //  * trigram similarity. Requires viewer+ access.
  //  * Throws 404 if the document does not exist, 403 if the user has less than viewer access.
  //  * @param req - the Express request, with userId stamped by AuthGuard
  //  * @param documentId - the document ID parsed from the URL path
  //  * @param query - email query string and optional limit
  //  * @returns matching users with their name, email, and access level
  //  */
  // @Get('/:documentId/search')
  // async handleSearchDocumentAccessUsers(
  //   @Req() req: Request,
  //   @Param('documentId', ParseIntPipe) documentId: number,
  //   @Query(new ZodHttpValidationPipe(SearchDocumentAccessUsersRequestSchema))
  //   query: { email: string; limit?: number },
  // ): Promise<SearchDocumentAccessUsersResponseDto> {
  //   const userId = (req as any).userId as number;
  //   const limit = query.limit ?? 20;
  //   return httpOK(
  //     await this.documentAccessService.searchDocumentAccessUsers(
  //       documentId,
  //       query.email,
  //       limit,
  //       userId,
  //     ),
  //   );
  // }

  // /**
  //  * Returns the default access level for the given document. Requires viewer+ access.
  //  * Throws 404 if the document does not exist, 403 if the user has less than viewer access.
  //  * @param req - the Express request, with userId stamped by AuthGuard
  //  * @param documentId - the document ID parsed from the URL path
  //  * @returns the document's current default access level
  //  */
  // @Get('/default/:documentId')
  // async handleGetDocumentDefaultAccess(
  //   @Req() req: Request,
  //   @Param('documentId', ParseIntPipe) documentId: number,
  // ): Promise<GetDocumentDefaultAccessResponseDto> {
  //   const userId = (req as any).userId as number;
  //   return httpOK(
  //     await this.documentAccessService.getDocumentDefaultAccess(
  //       documentId,
  //       userId,
  //     ),
  //   );
  // }

  // /**
  //  * Updates the default access level for the given document. Requires admin+ access.
  //  * Throws 404 if the document does not exist, 403 if the user has less than admin access.
  //  * @param req - the Express request, with userId stamped by AuthGuard
  //  * @param documentId - the document ID parsed from the URL path
  //  * @param body - the new default access level to assign
  //  * @returns the updated default access level
  //  */
  // @Put('/default/:documentId')
  // async handleSetDocumentDefaultAccess(
  //   @Req() req: Request,
  //   @Param('documentId', ParseIntPipe) documentId: number,
  //   @Body(new ZodHttpValidationPipe(SetDocumentDefaultAccessRequestSchema))
  //   body: SetDocumentDefaultAccessRequestDto,
  // ): Promise<SetDocumentDefaultAccessResponseDto> {
  //   const userId = (req as any).userId as number;
  //   return httpOK(
  //     await this.documentAccessService.setDocumentDefaultAccess(
  //       documentId,
  //       body.defaultAccess,
  //       userId,
  //     ),
  //   );
  // }

  // /**
  //  * Sets or updates the access level for a user on the given document. Assigning
  //  * admin requires owner access; assigning editor or below requires admin+.
  //  * Throws 404 if the document or target user is not found, 403 if the requester
  //  * lacks the required level, and 409 if the target is the document owner.
  //  * @param req - the Express request, with userId stamped by AuthGuard
  //  * @param documentId - the document ID parsed from the URL path
  //  * @param targetUserId - the user ID parsed from the URL path
  //  * @param body - the new access level to assign
  //  */
  // @Put('/:documentId/:targetUserId')
  // async handleSetDocumentAccess(
  //   @Req() req: Request,
  //   @Param('documentId', ParseIntPipe) documentId: number,
  //   @Param('targetUserId', ParseIntPipe) targetUserId: number,
  //   @Body(new ZodHttpValidationPipe(SetDocumentAccessRequestSchema))
  //   body: SetDocumentAccessRequestDto,
  // ): Promise<void> {
  //   const userId = (req as any).userId as number;
  //   await this.documentAccessService.setDocumentAccess(
  //     documentId,
  //     targetUserId,
  //     body.access,
  //     userId,
  //   );
  // }

  // /**
  //  * Deletes the access row for a user on the given document. Removing an admin
  //  * requires owner access; removing editor or below requires admin+.
  //  * Throws 404 if the document or access row is not found, 403 if the requester
  //  * lacks the required level, and 409 if the target is the document owner.
  //  * @param req - the Express request, with userId stamped by AuthGuard
  //  * @param documentId - the document ID parsed from the URL path
  //  * @param targetUserId - the user ID parsed from the URL path
  //  */
  // @Delete('/:documentId/:targetUserId')
  // async handleDeleteDocumentAccess(
  //   @Req() req: Request,
  //   @Param('documentId', ParseIntPipe) documentId: number,
  //   @Param('targetUserId', ParseIntPipe) targetUserId: number,
  // ): Promise<void> {
  //   const userId = (req as any).userId as number;
  //   await this.documentAccessService.deleteDocumentAccess(
  //     documentId,
  //     targetUserId,
  //     userId,
  //   );
  // }

  // /**
  //  * Returns the owner's basic profile (id, name, email, avatarUrl) for the
  //  * given document. Requires viewer+ access.
  //  * Throws 404 if the document does not exist, 403 if the user has less than viewer access.
  //  * @param req - the Express request, with userId stamped by AuthGuard
  //  * @param documentId - the document ID parsed from the URL path
  //  * @returns the owner's id, name, email, and avatarUrl
  //  */
  // @Get('/:documentId/owner')
  // async handleGetDocumentOwner(
  //   @Req() req: Request,
  //   @Param('documentId', ParseIntPipe) documentId: number,
  // ): Promise<GetDocumentOwnerResponseDto> {
  //   const userId = (req as any).userId as number;
  //   return httpOK(
  //     await this.documentAccessService.getDocumentOwner(documentId, userId),
  //   );
  // }

  // /**
  //  * Looks up a user by exact email who can be assigned as the new document owner.
  //  * Throws 404 if the document or user is not found, 403 if the requester is not
  //  * the owner, and 409 if the matched user is already the document owner.
  //  * @param req - the Express request, with userId stamped by AuthGuard
  //  * @param documentId - the document ID parsed from the URL path
  //  * @param query - exact email address to look up
  //  * @returns the matched user's id, name, email, and avatarUrl
  //  */
  // @Get('/:documentId/owner/find')
  // async handleFindNewDocumentOwner(
  //   @Req() req: Request,
  //   @Param('documentId', ParseIntPipe) documentId: number,
  //   @Query(new ZodHttpValidationPipe(FindNewDocumentOwnerRequestSchema))
  //   query: FindNewDocumentOwnerRequestDto,
  // ): Promise<FindNewDocumentOwnerResponseDto> {
  //   const userId = (req as any).userId as number;
  //   return httpOK(
  //     await this.documentAccessService.findNewDocumentOwner(
  //       documentId,
  //       query.email,
  //       userId,
  //     ),
  //   );
  // }

  // /**
  //  * Transfers ownership of the given document to another user. The new owner's
  //  * existing access row is deleted and the old owner is upserted into
  //  * document_access with admin access. Throws 404 if the document or new owner
  //  * does not exist, 403 if the requester is not the owner, and 409 if the new
  //  * owner is already the current owner.
  //  * @param req - the Express request, with userId stamped by AuthGuard
  //  * @param documentId - the document ID parsed from the URL path
  //  * @param body - the user ID of the incoming owner
  //  * @returns the new owner's id, name, email, and avatarUrl
  //  */
  // @Put('/:documentId/owner')
  // async handleTransferDocumentOwner(
  //   @Req() req: Request,
  //   @Param('documentId', ParseIntPipe) documentId: number,
  //   @Body(new ZodHttpValidationPipe(TransferDocumentOwnerRequestSchema))
  //   body: TransferDocumentOwnerRequestDto,
  // ): Promise<TransferDocumentOwnerResponseDto> {
  //   const userId = (req as any).userId as number;
  //   return httpOK(
  //     await this.documentAccessService.transferDocumentOwner(
  //       documentId,
  //       body.newOwnerId,
  //       userId,
  //     ),
  //   );
  // }
}
