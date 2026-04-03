import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UseFilters } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { DocumentService } from './document.service';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import {
  PingSchema,
  PongSchema,
  type SyncDocServerPayload,
  SyncDocServerSchema,
  type PingPayload,
  SyncDocClientSchema,
  RepairSyncDocServerSchema,
  type RepairSyncDocServerPayload,
  RepairSyncDocClientSchema,
  RepairSyncAckDocServerSchema,
  type RepairSyncAckDocServerPayload,
  RepairSyncAckDocClientSchema,
  RepairAckDocServerSchema,
  type RepairAckDocServerPayload,
  RepairAckDocClientSchema,
} from '@converge/shared';
import { GlobalExceptionFilter } from '../utils/global-exception.filter';
import { socketBroadcast, socketEmit } from '../utils/ws-emit.util';

// Handles all document-related WebSocket events.
// cors origin is a function so process.env.CLIENT_URL is read at connection time, not at startup.
// @UseFilters overrides NestJS's default WsExceptionsHandler so all exceptions are emitted
// on the "error" channel via GlobalExceptionFilter rather than the default "exception" channel.
@UseFilters(GlobalExceptionFilter)
@WebSocketGateway({
  cors: { origin: (_req, cb) => cb(null, process.env.CLIENT_URL) },
})
export class DocumentGateway {
  @WebSocketServer()
  socketServer!: Server; // the Socket.io server instance, injected by the NestJS WebSocket adapter

  constructor(private readonly documentService: DocumentService) {}

  /**
   * Responds to a client ping by echoing the pingId back so the client
   * can calculate round-trip latency.
   * @param client - the socket that sent the ping
   * @param data - contains the pingId to echo back
   */
  @SubscribeMessage('ping')
  handlePing(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ZodValidationPipe(PingSchema)) data: PingPayload,
  ) {
    const { pingId } = data;
    socketEmit(client, 'pong', PongSchema, { pingId });
  }

  /**
   * Applies a client's Yjs update to the shared doc, broadcasts it to all
   * other clients, and triggers a repair sync if the sending client's state
   * vector diverges from the server's after the update.
   * @param client - the socket that sent the update
   * @param data - contains the encoded update and the client's state vector
   */
  @SubscribeMessage('sync-doc-server')
  handleSyncDoc(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ZodValidationPipe(SyncDocServerSchema))
    { updateArray, clientSVArray }: SyncDocServerPayload,
  ) {
    const update = new Uint8Array(updateArray);
    const clientSV = new Uint8Array(clientSVArray);

    // apply the update to the shared doc and get the new server state vector
    const { serverSV } = this.documentService.applyYDocUpdate(update);

    const serverSVArray = Array.from(serverSV);
    socketBroadcast(client, 'sync-doc-client', SyncDocClientSchema, {
      updateArray,
      serverSVArray,
    });

    // if the client is behind, prompt it to start a repair sync
    if (!this.documentService.isClientAndServerDocSynced(clientSV)) {
      socketEmit(client, 'repair-sync-doc-client', RepairSyncDocClientSchema, {
        serverSVArray: Array.from(serverSV),
      });
    }
  }

  /**
   * Responds to a repair sync request by computing the updates the client
   * is missing and sending them back alongside the server's state vector.
   * @param client - the socket requesting repair
   * @param data - contains the client's encoded state vector
   */
  @SubscribeMessage('repair-sync-doc-server')
  handleRepairSyncDoc(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ZodValidationPipe(RepairSyncDocServerSchema))
    { clientSVArray }: RepairSyncDocServerPayload,
  ) {
    const clientSV = new Uint8Array(clientSVArray);

    // compute the diff the client is missing and the current server SV
    const { serverSV, diff } =
      this.documentService.getClientServerDocDiff(clientSV);

    // send the diff and server SV so the client can apply and respond with its own diff
    socketEmit(
      client,
      'repair-sync-ack-doc-client',
      RepairSyncAckDocClientSchema,
      {
        serverSVArray: Array.from(serverSV),
        diffArray: Array.from(diff),
      },
    );
  }

  /**
   * Applies the diff received from the client during a repair sync, then
   * computes and sends back the remaining updates the client is still missing.
   * @param client - the socket that sent the diff
   * @param data - contains the diff bytes and the client's state vector
   */
  @SubscribeMessage('repair-sync-ack-doc-server')
  handleRepairSyncAckDoc(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ZodValidationPipe(RepairSyncAckDocServerSchema))
    { diffArray, clientSVArray }: RepairSyncAckDocServerPayload,
  ) {
    const diff = new Uint8Array(diffArray);
    const clientSV = new Uint8Array(clientSVArray);

    // apply the diff
    this.documentService.applyYDocUpdate(diff);

    // calculate the remaining diff the client is still missing
    const { diff: diffForClient } =
      this.documentService.getClientServerDocDiff(clientSV);

    socketEmit(client, 'repair-ack-doc-client', RepairAckDocClientSchema, {
      diffArray: Array.from(diffForClient),
    });
  }

  /**
   * Applies the final diff from the client, completing the repair sync round.
   * @param data - contains the diff bytes to apply to the shared doc
   */
  @SubscribeMessage('repair-ack-doc-server')
  handleRepairAckDoc(
    @MessageBody(new ZodValidationPipe(RepairAckDocServerSchema))
    { diffArray, clientSVArray }: RepairAckDocServerPayload,
  ) {
    const diff = new Uint8Array(diffArray);
    // convert and apply the final diff to bring the server doc fully up to date
    this.documentService.applyYDocUpdate(diff);
  }
}
