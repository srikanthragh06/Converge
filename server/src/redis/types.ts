// Internal types for the Redis pub/sub layer.

import * as Y from "yjs";

// Per-document subscription state held by PubSub.
export interface SubEntry {
    yDoc: Y.Doc;
    // false while Postgres is still loading; messages go into buffer instead.
    live: boolean;
    // Accumulates Redis messages that arrive during the Postgres cold load.
    buffer: Uint8Array[];
}
