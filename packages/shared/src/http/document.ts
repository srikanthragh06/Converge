import { z } from "zod";

export const CreateDocumentResponseSchema = z.object({
    documentId: z.number(),
});

export type CreateDocumentResponseDto = z.infer<
    typeof CreateDocumentResponseSchema
>;
