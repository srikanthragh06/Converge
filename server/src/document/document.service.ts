import { Injectable } from '@nestjs/common';
import * as Y from 'yjs';

@Injectable()
export class DocumentService {
  // Single in-memory Y.Doc shared across all clients. Temporary until
  // per-document persistence is introduced.
  readonly yDoc = new Y.Doc();
}
