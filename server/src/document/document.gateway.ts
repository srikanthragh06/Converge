import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { wsSuccess } from '../utils/ws-response.util';
import { DocumentService } from './document.service';

// Handles all document-related WebSocket events.
// cors origin is a function so process.env.CLIENT_URL is read at connection time, not at startup.
@WebSocketGateway({
  cors: { origin: (_req, cb) => cb(null, process.env.CLIENT_URL) },
})
export class DocumentGateway {
  @WebSocketServer()
  socketServer!: Server;

  constructor(private readonly documentService: DocumentService) {}

  // Echoes pingId back so the client can match the response and calculate latency.
  @SubscribeMessage('ping')
  handlePing(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pingId: string },
  ) {
    const { pingId } = data;
    client.emit('pong', wsSuccess({ pingId }));
  }

  @SubscribeMessage('sync-doc')
  handleSyncDoc(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      update: number[];
      clientSV: number[];
    },
  ) {
    const update = new Uint8Array(data.update);
    const clientSV = new Uint8Array(data.clientSV);

    const { serverSV } = this.documentService.applyYDocUpdate(update);

    // number[] is used instead of Uint8Array because Socket.io deserializes
    // binary as ArrayBuffer in the browser, which Yjs cannot read directly.
    client.broadcast.emit('sync-doc', {
      update: Array.from(update),
      serverSV: Array.from(serverSV),
    });

    if (!this.documentService.isClientAndServerDocSynced(clientSV)) {
      // if diff then initiate repair
      client.emit('repair-sync-doc', { serverSV: Array.from(serverSV) });
    }
  }

  @SubscribeMessage('repair-sync-doc')
  handleRepairSyncDoc(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { clientSV: number[] },
  ) {
    const clientSVBytes = new Uint8Array(data.clientSV);

    const { serverSV, diff } =
      this.documentService.getClientServerDocDiff(clientSVBytes);

    client.emit('repair-sync-ack-doc', {
      serverSV: Array.from(serverSV),
      diff: Array.from(diff),
    });
  }

  @SubscribeMessage('repair-sync-ack-doc')
  handleRepairSyncAckDoc(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { diff: number[]; clientSV: number[] },
  ) {
    const { diff, clientSV } = data;
    const diffBytes = new Uint8Array(diff);
    const clientSVBytes = new Uint8Array(clientSV);

    // apply the diff
    this.documentService.applyYDocUpdate(diffBytes);

    // calculate diff for the client
    const { diff: diffForClient } =
      this.documentService.getClientServerDocDiff(clientSVBytes);

    // send him the diff with ack event
    client.emit('repair-ack-doc', { diff: Array.from(diffForClient) });
  }

  @SubscribeMessage('repair-ack-doc')
  handleRepairAckDoc(@MessageBody() data: { diff: number[] }) {
    const { diff } = data;
    const diffBytes = new Uint8Array(diff);

    // apply the diff
    this.documentService.applyYDocUpdate(diffBytes);
  }
}
