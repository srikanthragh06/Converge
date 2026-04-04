import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { OnApplicationBootstrap, UseFilters } from '@nestjs/common';
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
  SOCKET_EVENTS,
} from '@converge/shared';
import { GlobalExceptionFilter } from '../utils/global-exception.filter';
import { socketBroadcast, socketEmit } from '../utils/ws-emit.util';
import { RedisService } from '../redis/redis.service';
import { REDIS_EVENTS } from '../redis/redis.events';
import { base64ToUint8Array } from '../utils/utils';

// Handles all document-related WebSocket events.
// cors origin is a function so process.env.CLIENT_URL is read at connection time, not at startup.
// @UseFilters overrides NestJS's default WsExceptionsHandler so all exceptions are emitted
// on the "error" channel via GlobalExceptionFilter rather than the default "exception" channel.
@UseFilters(GlobalExceptionFilter)
@WebSocketGateway({
  cors: { origin: (_req, cb) => cb(null, process.env.CLIENT_URL) },
})
export class DocumentGateway implements OnApplicationBootstrap {
  @WebSocketServer()
  socketServer!: Server; // the Socket.io server instance, injected by the NestJS WebSocket adapter

  constructor(
    private readonly documentService: DocumentService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Subscribes to the Redis document update channel once the app is fully
   * initialised. Applies incoming updates to the in-memory doc and broadcasts
   * them to all locally connected clients so they stay in sync with edits
   * made on other server instances.
   */
  async onApplicationBootstrap(): Promise<void> {
    await this.redisService.subscribe(
      REDIS_EVENTS.documentUpdate,
      (message) => {
        const update = base64ToUint8Array(message.updateBase64 as string);
        const serverSV = this.documentService.applyUpdateToMemory(update);
        socketEmit(
          this.socketServer,
          SOCKET_EVENTS.SYNC_DOC_CLIENT,
          SyncDocClientSchema,
          {
            updateArray: Array.from(update),
            serverSVArray: Array.from(serverSV),
          },
        );
      },
    );
  }

  /**
   * Responds to a client ping by echoing the pingId back so the client
   * can calculate round-trip latency.
   * @param client - the socket that sent the ping
   * @param data - contains the pingId to echo back
   */
  @SubscribeMessage(SOCKET_EVENTS.PING)
  handlePing(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ZodValidationPipe(PingSchema)) data: PingPayload,
  ) {
    const { pingId } = data;
    socketEmit(client, SOCKET_EVENTS.PONG, PongSchema, { pingId });
  }

  /**
   * Applies a client's Yjs update to the shared doc, broadcasts it to all
   * other clients, and triggers a repair sync if the sending client's state
   * vector diverges from the server's after the update.
   * @param client - the socket that sent the update
   * @param data - contains the encoded update and the client's state vector
   */
  @SubscribeMessage(SOCKET_EVENTS.SYNC_DOC_SERVER)
  async handleSyncDoc(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ZodValidationPipe(SyncDocServerSchema))
    { updateArray, clientSVArray }: SyncDocServerPayload,
  ) {
    const update = new Uint8Array(updateArray);
    const clientSV = new Uint8Array(clientSVArray);

    // apply the update to the shared doc and get the new server state vector
    const { serverSV } = await this.documentService.applyYDocUpdate(update);

    const serverSVArray = Array.from(serverSV);
    socketBroadcast(
      client,
      SOCKET_EVENTS.SYNC_DOC_CLIENT,
      SyncDocClientSchema,
      {
        updateArray,
        serverSVArray,
      },
    );

    // if the client is behind, prompt it to start a repair sync
    if (!this.documentService.isClientAndServerDocSynced(clientSV)) {
      socketEmit(
        client,
        SOCKET_EVENTS.REPAIR_SYNC_DOC_CLIENT,
        RepairSyncDocClientSchema,
        {
          serverSVArray: Array.from(serverSV),
        },
      );
    }
  }

  /**
   * Responds to a repair sync request by computing the updates the client
   * is missing and sending them back alongside the server's state vector.
   * @param client - the socket requesting repair
   * @param data - contains the client's encoded state vector
   */
  @SubscribeMessage(SOCKET_EVENTS.REPAIR_SYNC_DOC_SERVER)
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
      SOCKET_EVENTS.REPAIR_SYNC_ACK_DOC_CLIENT,
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
  @SubscribeMessage(SOCKET_EVENTS.REPAIR_SYNC_ACK_DOC_SERVER)
  async handleRepairSyncAckDoc(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ZodValidationPipe(RepairSyncAckDocServerSchema))
    { diffArray, clientSVArray }: RepairSyncAckDocServerPayload,
  ) {
    const diff = new Uint8Array(diffArray);
    const clientSV = new Uint8Array(clientSVArray);

    // apply the diff
    await this.documentService.applyYDocUpdate(diff);

    // calculate the remaining diff the client is still missing
    const { diff: diffForClient } =
      this.documentService.getClientServerDocDiff(clientSV);

    socketEmit(
      client,
      SOCKET_EVENTS.REPAIR_ACK_DOC_CLIENT,
      RepairAckDocClientSchema,
      {
        diffArray: Array.from(diffForClient),
      },
    );
  }

  /**
   * Applies the final diff from the client, completing the repair sync round.
   * @param data - contains the diff bytes to apply to the shared doc
   */
  @SubscribeMessage(SOCKET_EVENTS.REPAIR_ACK_DOC_SERVER)
  async handleRepairAckDoc(
    @MessageBody(new ZodValidationPipe(RepairAckDocServerSchema))
    { diffArray }: RepairAckDocServerPayload,
  ) {
    const diff = new Uint8Array(diffArray);
    // convert and apply the final diff to bring the server doc fully up to date
    await this.documentService.applyYDocUpdate(diff);
  }
}
