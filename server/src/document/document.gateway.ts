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
    }
  }
}
