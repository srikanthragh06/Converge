import { ZodType } from "zod";

/**
 * Parses an incoming socket payload against the provided schema.
 * Returns the validated data if successful, or null if validation fails.
 * Logs a console error on failure so invalid payloads are visible during development.
 * @param schema - Zod schema to validate the raw payload against
 * @param raw - the raw value received from the socket event
 * @returns the parsed data, or null if validation failed
 */
export function socketReceive<T>(schema: ZodType<T>, raw: unknown): T | null {
    const result = schema.safeParse(raw);
    if (!result.success) {
        console.error("Invalid socket payload:", result.error);
        return null;
    }
    return result.data;
}
