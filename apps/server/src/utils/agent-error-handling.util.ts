import { HttpException } from '@nestjs/common';
import { INTERNAL_SERVER_ERROR_MESSAGE } from '@converge/shared';

/**
 * Runs an AgentTools execute() body and turns a thrown error into a normal
 * returned value instead of letting it propagate — unlike
 * withMcpErrorHandling (which rethrows, since the MCP SDK itself converts a
 * thrown error into a proper isError tool result), the Vercel AI SDK only
 * records a tool call in streamText's result.toolResults when execute()
 * resolves rather than throws; an uncaught throw instead becomes a
 * tool-error step part that this app's own persistAssistantStep never
 * persists (it only reads result.toolResults), silently dropping all record
 * that the call was ever made from the conversation's DB history. Returning
 * a curated error value keeps every attempted call — successful or not — a
 * real, persisted tool result. Our own HttpExceptions (NotFoundException,
 * ForbiddenException, applyBlockOperations's BadRequestException, etc.)
 * carry deliberately-written, safe messages, so those are surfaced as-is.
 * Anything else — a raw DB error, a library's internal error, anything not
 * specifically authored for this boundary — is logged server-side and
 * replaced with a generic message, so an unexpected internal error can
 * never leak implementation details to the model.
 * @param fn - the tool logic to run
 * @returns fn's result, or `{ error: message }` if it throws
 */
export async function withAgentErrorHandling<T>(
  fn: () => Promise<T>,
): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpException) {
      return { error: err.message };
    }
    console.error('Unhandled exception in agent tool handler:', err);
    return { error: INTERNAL_SERVER_ERROR_MESSAGE };
  }
}
