import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { wsSuccess } from '../utils/ws-response.util';

// Handles all document-related WebSocket events.
@WebSocketGateway({ cors: { origin: '*' } })
export class DocumentGateway {
  // Echoes pingId back so the client can match the response and calculate latency.
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    const { pingId } = data;
    client.emit('pong', wsSuccess({ pingId }));
  }
}
