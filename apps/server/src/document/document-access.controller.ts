import { Controller, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';

/** Placeholder controller for the /document-access route prefix. Routes have been removed; access logic lives in DocumentAccessService and is consumed directly by other services. */
@Controller('/document-access')
@UseGuards(AuthGuard)
export class DocumentAccessController {}
