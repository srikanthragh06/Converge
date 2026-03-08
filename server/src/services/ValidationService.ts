// ValidationService: Zod schemas for request body validation across all routes.
// Import the relevant schema in the route handler and call schema.safeParse(req.body).

import { z } from "zod";

export class ValidationService {
    // PATCH /documents/:documentId/title — title must be a string of at most 32 characters.
    static readonly patchDocumentTitle = z.object({
        title: z.string().max(32, "Title cannot exceed 32 characters"),
    });
}
