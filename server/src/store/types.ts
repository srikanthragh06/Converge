// Internal types for the doc store layer.

import * as Y from "yjs";

// Registry entry for an in-memory document.
export interface DocEntry {
    yDoc: Y.Doc;
    lastAccess: number; // Date.now() timestamp — updated on every client interaction
}
