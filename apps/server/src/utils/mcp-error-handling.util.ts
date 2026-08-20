import { HttpException } from '@nestjs/common';
import { INTERNAL_SERVER_ERROR_MESSAGE } from '@converge/shared';

/**
 * Runs a tool handler and curates what a thrown error is allowed to say to
 * the calling agent — mirrors GlobalExceptionFilter's HTTP branch, which the
 * MCP endpoint bypasses (it hands raw req/res straight to the MCP SDK's
 * transport instead of going through Nest's normal response handling). Our
 * own HttpExceptions (NotFoundException, ForbiddenException,
 * applyBlockOperations's BadRequestException, etc.) carry
 * deliberately-written, safe messages, so they're re-thrown as-is. Anything
 * else — a raw DB error, a library's internal error, anything we didn't
 * specifically author for this boundary — is logged server-side and
 * replaced with a generic message, so an unexpected internal error can
 * never leak implementation details to an agent.
 * @param fn - the tool logic to run
 * @returns fn's result, once it resolves
 */
export async function withMcpErrorHandling<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpException) throw err;
    console.error('Unhandled exception in MCP tool handler:', err);
    throw new Error(INTERNAL_SERVER_ERROR_MESSAGE);
  }
}
