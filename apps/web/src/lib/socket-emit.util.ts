import { ZodType } from "zod";
import { Socket } from "socket.io-client";

/**
 * Validates payload against the provided schema then emits it on the socket.
 * Throws if the payload does not satisfy the schema, catching programming errors
 * at the emit site rather than silently sending a malformed payload to the server.
 * @param socket - the socket instance to emit on
 * @param event - the event name
 * @param schema - Zod schema the payload must satisfy
 * @param payload - the data to validate and emit
 */
export function socketEmit<T>(
    socket: Socket,
    event: string,
    schema: ZodType<T>,
    payload: T,
): void {
    socket.emit(event, schema.parse(payload));
}
