import { z } from "zod";

export const CreateDocumentResponseSchema = z.object({
    documentId: z.number(),
});

export type CreateDocumentResponseDto = z.infer<
    typeof CreateDocumentResponseSchema
>;

export const GetDocumentResponseSchema = z.object({
    id: z.number(),
    title: z.string(),
    creatorId: z.number(),
    createdAt: z.coerce.date(),
});

export type GetDocumentResponseDto = z.infer<typeof GetDocumentResponseSchema>;
