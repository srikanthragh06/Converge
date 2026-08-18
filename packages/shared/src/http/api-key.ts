import { z } from "zod";

export const CreateApiKeyRequestSchema = z.object({
    label: z.string().min(1).max(64),
});

export type CreateApiKeyRequestDto = z.infer<typeof CreateApiKeyRequestSchema>;

/** Returned once, immediately after creation — the raw key is never retrievable again. */
export const CreateApiKeyResponseSchema = z.object({
    id: z.number(),
    label: z.string(),
    keyPrefix: z.string(),
    rawKey: z.string(),
    createdAt: z.coerce.date(),
});

export type CreateApiKeyResponseDto = z.infer<typeof CreateApiKeyResponseSchema>;

/** Listing shape — never includes the raw key or its hash. */
export const ApiKeySchema = z.object({
    id: z.number(),
    label: z.string(),
    keyPrefix: z.string(),
    lastUsedAt: z.coerce.date().nullable(),
    revokedAt: z.coerce.date().nullable(),
    createdAt: z.coerce.date(),
});

export type ApiKeyDto = z.infer<typeof ApiKeySchema>;

export const GetApiKeysResponseSchema = z.array(ApiKeySchema);

export type GetApiKeysResponseDto = z.infer<typeof GetApiKeysResponseSchema>;
