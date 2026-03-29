import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { wsSuccess } from '../utils/ws-response.util';
import { DocumentService } from './document.service';

// Handles all document-related WebSocket events.
// cors origin is a function so process.env.CLIENT_URL is read at connection time, not at startup.
@WebSocketGateway({
  cors: { origin: (_req, cb) => cb(null, process.env.CLIENT_URL) },
})
export class DocumentGateway {
  // Echoes pingId back so the client can match the response and calculate latency.
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    const { pingId } = data;
    client.emit('pong', wsSuccess({ pingId }));
  }
}
