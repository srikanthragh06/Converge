import { Injectable } from '@nestjs/common';
import * as Y from 'yjs';
import { mapsAreEqual } from '../utils/utils';

@Injectable()
export class DocumentService {
  // Single in-memory Y.Doc shared across all clients. Temporary until
  // per-document persistence is introduced.
  private readonly yDoc = new Y.Doc();

  applyYDocUpdate(update: Uint8Array): {
    update: Uint8Array;
    serverSV: Uint8Array;
  } {
    Y.applyUpdate(this.yDoc, update);
    return { update, serverSV: Y.encodeStateVector(this.yDoc) };
  }

  isClientAndServerDocSynced(clientSV: Uint8Array): boolean {
    return mapsAreEqual(
      Y.decodeStateVector(Y.encodeStateVector(this.yDoc)),
      Y.decodeStateVector(clientSV),
    );
  }

  getClientServerDocDiff(clientSV: Uint8Array): {
    diff: Uint8Array;
    serverSV: Uint8Array;
  } {
    const diff = Y.encodeStateAsUpdate(this.yDoc, clientSV);
    const serverSV = Y.encodeStateVector(this.yDoc);
    return { diff, serverSV };
  }
}
