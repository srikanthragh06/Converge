import { ZodType } from 'zod';
import { Socket, Server, BroadcastOperator } from 'socket.io';

/**
 * Validates payload against the provided schema then emits it on the socket or server.
 * Throws if the payload does not satisfy the schema, catching programming errors
 * at the emit site rather than silently sending a malformed payload to the client.
 * @param socket - the socket or server instance to emit on
 * @param event - the event name
 * @param schema - Zod schema the payload must satisfy
 * @param payload - the data to validate and emit
 */
export function socketEmit<T>(
  socket: Socket | Server,
  event: string,
  schema: ZodType<T>,
  payload: T,
): void {
  socket.emit(event, schema.parse(payload));
}

/**
 * Validates payload against the provided schema then broadcasts it to all
 * clients in every room the sender has joined, except the sender itself.
 * Since each socket joins exactly one document room, this effectively broadcasts
 * to all other clients in the same document.
 * Throws if the payload does not satisfy the schema, catching programming errors
 * at the emit site rather than silently sending a malformed payload.
 * @param client - the socket whose broadcast operator will be used
 * @param event - the event name
 * @param schema - Zod schema the payload must satisfy
 * @param payload - the data to validate and broadcast
 */
export function socketBroadcast<T>(
  client: Socket,
  event: string,
  schema: ZodType<T>,
  payload: T,
): void {
  (client.broadcast as BroadcastOperator<any, any>).emit(
    event,
    schema.parse(payload),
  );
}

/**
 * Validates payload against the provided schema then emits it to all clients
 * in the specified room. Unlike socketBroadcast, this includes the sender and
 * works with both a Socket (excludes sender via room targeting) and a Server
 * (targets the room directly, useful for Redis pub/sub callbacks).
 * Throws if the payload does not satisfy the schema, catching programming errors
 * at the emit site rather than silently sending a malformed payload.
 * @param client - the socket or server instance to emit from
 * @param room - the room to emit to
 * @param event - the event name
 * @param schema - Zod schema the payload must satisfy
 * @param payload - the data to validate and emit
 */
export function socketEmitRoom<T>(
  client: Socket | Server,
  room: string,
  event: string,
  schema: ZodType<T>,
  payload: T,
): void {
  client.to(room).emit(event, schema.parse(payload));
}
