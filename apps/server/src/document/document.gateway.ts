import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UseFilters } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { DocumentService } from './document.service';
import { DocumentYjsService } from './document-yjs.service';
import { ZodSocketValidationPipe } from '../pipes/zod-socket-validation.pipe';
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
  SyncDocTitleServerSchema,
  type SyncDocTitleServerPayload,
  SyncDocTitleClientSchema,
  SyncDocTitleAckSchema,
  type ResolvedDocumentAccessLevel,
  hasAccess,
} from '@converge/shared';
import { GlobalExceptionFilter } from '../utils/global-exception.filter';
import { socketEmit, socketEmitRoom } from '../utils/ws-emit.util';
import { RedisService } from '../redis/redis.service';
import { REDIS_EVENTS } from '../redis/redis.events';
import { base64ToUint8Array } from '../utils/utils';
import { AuthService } from '../auth/auth.service';
import { parse as parseCookie } from 'cookie';

// Handles all document-related WebSocket events.
// cors origin is a function so process.env.CLIENT_URL is read at connection time, not at startup.
// @UseFilters overrides NestJS's default WsExceptionsHandler so all exceptions are emitted
// on the "error" channel via GlobalExceptionFilter rather than the default "exception" channel.
@UseFilters(GlobalExceptionFilter)
@WebSocketGateway({
  cors: {
    origin: (_req, cb) => cb(null, process.env.CLIENT_URL),
    credentials: true,
  },
})
export class DocumentGateway implements OnGatewayConnection {
  @WebSocketServer()
  socketServer!: Server; // the Socket.io server instance, injected by the NestJS WebSocket adapter

  private readonly subscribedDocs = new Set<number>(); // tracks which document IDs have an active Redis subscription, preventing duplicate handlers

  constructor(
    private readonly documentService: DocumentService,
    private readonly documentYjsService: DocumentYjsService,
    private readonly redisService: RedisService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Verifies the auth cookie and documentId, resolves the user's access level,
   * stamps documentId, userId, and access on the socket, joins the document room,
   * loads the Y.Doc into memory, sets up the Redis subscription for cross-server
   * updates, and emits DOC_READY when all async setup is complete.
   * Rejects invalid connections using disconnect(true) to force-close the underlying
   * transport — plain disconnect() only removes the socket from namespaces but leaves
   * the WebSocket open, so the client never receives the disconnect event.
   * @param client - the newly connected socket
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      // Parse the authToken cookie from the handshake and verify it.
      const cookieHeader = client.handshake.headers.cookie ?? '';
      const cookies = parseCookie(cookieHeader);
      const authToken = cookies['authToken'];

      if (!authToken) {
        console.log('Connection rejected: missing authToken cookie');
        client.disconnect(true);
        return;
      }

      // Verify the auth token and extract the userId.
      let userId: number;
      try {
        userId = await this.authService.verifyAuthToken(authToken);
      } catch {
        console.log('Connection rejected: invalid or expired authToken');
        client.disconnect(true);
        return;
      }

      // get documentId from client handshake query
      const { documentId: documentIdStr } = client.handshake.query;

      // reject if documentId is missing or an array (only a single string is valid)
      if (!documentIdStr || Array.isArray(documentIdStr)) {
        console.log('Connection rejected: missing or invalid documentId');
        client.disconnect(true);
        return;
      }

      // parse the string to a number — Number() returns NaN for non-numeric strings
      const documentId = Number(documentIdStr);

      if (isNaN(documentId)) {
        console.log('Connection rejected: documentId is not a valid number');
        client.disconnect(true);
        return;
      }

      // Verify the document exists and the user has at least viewer access.
      let resolvedAccess: ResolvedDocumentAccessLevel;
      try {
        ({ resolvedAccess } = await this.documentService.getDocumentOfUser(
          documentId,
          userId,
        ));
      } catch {
        console.log(
          `Connection rejected: document ${documentId} not found or forbidden for user ${userId}`,
        );
        client.disconnect(true);
        return;
      }

      // stamp the socket so all handlers can read documentId, userId, and access without trusting the client
      client.data.documentId = documentId;
      client.data.userId = userId;
      client.data.access = resolvedAccess; // resolved access level stamped at connection time; used for per-handler guards

      // join the document room — broadcasts are scoped to this room
      client.join(String(documentId));

      // load the Y.Doc into memory if not already loaded
      await this.documentYjsService.loadDoc(documentId);

      // Record that this user visited the document.
      await this.documentYjsService.recordLastVisited(documentId, userId);

      // subscribe once per document — the Set prevents duplicate handlers across client connections
      if (!this.subscribedDocs.has(documentId)) {
        // Subscribe to Yjs document updates published by other server instances.
        await this.redisService.subscribe(
          REDIS_EVENTS.documentUpdate(documentId),
          async (message) => {
            try {
              const update = base64ToUint8Array(message.updateBase64 as string);
              const serverSV =
                await this.documentYjsService.applyDocUpdateOnlyToLocalMemory(
                  documentId,
                  update,
                );
              socketEmitRoom(
                this.socketServer,
                String(documentId),
                SOCKET_EVENTS.SYNC_DOC_CLIENT,
                SyncDocClientSchema,
                {
                  updateArray: Array.from(update),
                  serverSVArray: Array.from(serverSV),
                },
              );
            } catch (err) {
              console.error('Failed to process Redis document update:', err);
            }
          },
        );

        // Broadcast title updates from other server instances to local clients.
        await this.redisService.subscribe(
          REDIS_EVENTS.documentTitleUpdate(documentId),
          (message) => {
            try {
              const { title } = message;
              socketEmitRoom(
                this.socketServer,
                String(documentId),
                SOCKET_EVENTS.SYNC_DOC_TITLE_CLIENT,
                SyncDocTitleClientSchema,
                { title: title as string },
              );
            } catch (err) {
              console.error('Failed to process Redis title update:', err);
            }
          },
        );

        // Mark this document as subscribed so subsequent connections reuse the existing handlers.
        this.subscribedDocs.add(documentId);
      }

      // Signals to the client that it can start all server doc operations.
      client.emit(SOCKET_EVENTS.DOC_READY);
    } catch (err) {
      console.error(err);
      client.disconnect();
    }
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
    @MessageBody(new ZodSocketValidationPipe(PingSchema)) data: PingPayload,
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
  async handleSyncDocServer(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ZodSocketValidationPipe(SyncDocServerSchema))
    { updateArray, clientSVArray }: SyncDocServerPayload,
  ) {
    const documentId = client.data.documentId as number;
    const userId = client.data.userId as number;

    // Reject writes from viewers — editor+ access required.
    if (!hasAccess(client.data.access as ResolvedDocumentAccessLevel, 'editor'))
      return;

    const update = new Uint8Array(updateArray);
    const clientSV = new Uint8Array(clientSVArray);

    // apply the update to the shared doc and get the new server state vector
    const { serverSV } = await this.documentYjsService.applyDocUpdate(
      documentId,
      update,
    );

    const serverSVArray = Array.from(serverSV);
    socketEmitRoom(
      client,
      String(documentId),
      SOCKET_EVENTS.SYNC_DOC_CLIENT,
      SyncDocClientSchema,
      {
        updateArray,
        serverSVArray,
      },
    );

    // record that this user edited the document
    await this.documentYjsService.recordLastEdited(documentId, userId);

    // if the client is behind, prompt it to start a repair sync
    const isSynced = await this.documentYjsService.isClientAndServerDocSynced(
      documentId,
      clientSV,
    );
    if (!isSynced) {
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
  async handleRepairSyncDoc(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ZodSocketValidationPipe(RepairSyncDocServerSchema))
    { clientSVArray }: RepairSyncDocServerPayload,
  ) {
    const documentId = client.data.documentId as number;

    const clientSV = new Uint8Array(clientSVArray);

    // compute the diff the client is missing and the current server SV
    const { serverSV, diff } =
      await this.documentYjsService.getClientServerDocDiff(
        documentId,
        clientSV,
      );

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
   * Receives the client's diff during a repair sync. For editors, applies the
   * diff and broadcasts it to other clients. For all access levels, computes and
   * sends back the remaining updates the client is still missing so the repair
   * sync can complete regardless of the requester's access level.
   * @param client - the socket that sent the diff
   * @param data - contains the diff bytes and the client's state vector
   */
  @SubscribeMessage(SOCKET_EVENTS.REPAIR_SYNC_ACK_DOC_SERVER)
  async handleRepairSyncAckDoc(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ZodSocketValidationPipe(RepairSyncAckDocServerSchema))
    { diffArray, clientSVArray }: RepairSyncAckDocServerPayload,
  ) {
    const documentId = client.data.documentId as number;

    const diff = new Uint8Array(diffArray);
    const clientSV = new Uint8Array(clientSVArray);

    // Apply and broadcast the diff only for editors — viewers cannot push content.
    if (
      hasAccess(client.data.access as ResolvedDocumentAccessLevel, 'editor')
    ) {
      const { serverSV } = await this.documentYjsService.applyDocUpdate(
        documentId,
        diff,
      );
      socketEmitRoom(
        client,
        String(documentId),
        SOCKET_EVENTS.SYNC_DOC_CLIENT,
        SyncDocClientSchema,
        {
          serverSVArray: Array.from(serverSV),
          updateArray: Array.from(diff),
        },
      );
    }

    // Calculate the remaining diff the client is still missing and send it back,
    // regardless of access level, so viewers complete the repair sync and stay current.
    const { diff: diffForClient } =
      await this.documentYjsService.getClientServerDocDiff(
        documentId,
        clientSV,
      );

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
   * Receives the final diff from the client, completing the repair sync round.
   * For editors, applies the diff to bring the server doc fully up to date.
   * Viewers are silently ignored since they cannot push content.
   * @param client - the socket that sent the diff
   * @param data - contains the diff bytes to apply to the shared doc
   */
  @SubscribeMessage(SOCKET_EVENTS.REPAIR_ACK_DOC_SERVER)
  async handleRepairAckDoc(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ZodSocketValidationPipe(RepairAckDocServerSchema))
    { diffArray }: RepairAckDocServerPayload,
  ) {
    const documentId = client.data.documentId as number;

    const diff = new Uint8Array(diffArray);

    // Apply the final diff only for editors — viewers cannot push content.
    if (hasAccess(client.data.access as ResolvedDocumentAccessLevel, 'editor'))
      await this.documentYjsService.applyDocUpdate(documentId, diff);
  }

  /**
   * Persists the new document title and broadcasts it to all other clients
   * connected to the same document room.
   * @param client - the socket that sent the title update
   * @param data - contains the new title string and a changeId for ack correlation
   */
  @SubscribeMessage(SOCKET_EVENTS.SYNC_DOC_TITLE_SERVER)
  async handleSyncDocTitleServer(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ZodSocketValidationPipe(SyncDocTitleServerSchema))
    { title, changeId }: SyncDocTitleServerPayload,
  ) {
    const documentId = client.data.documentId as number;
    const userId = client.data.userId as number;

    // Reject writes from viewers — editor+ access required.
    if (!hasAccess(client.data.access as ResolvedDocumentAccessLevel, 'editor'))
      return;

    // Persist the updated title to the database.
    await this.documentYjsService.applyDocTitleUpdate(documentId, title);

    // record that this user edited the document
    await this.documentYjsService.recordLastEdited(documentId, userId);

    // Acknowledge persistence to the sending client, echoing changeId so the
    // client can match the ack to the specific emit that triggered it.
    socketEmit(
      client,
      SOCKET_EVENTS.SYNC_DOC_TITLE_ACK,
      SyncDocTitleAckSchema,
      {
        changeId,
      },
    );

    // Broadcast to all other clients in the document room.
    socketEmitRoom(
      client,
      String(documentId),
      SOCKET_EVENTS.SYNC_DOC_TITLE_CLIENT,
      SyncDocTitleClientSchema,
      { title },
    );
  }
}
