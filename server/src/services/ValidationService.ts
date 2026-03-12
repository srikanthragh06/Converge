// ValidationService: Zod schemas for request body validation across all routes.
// Import the relevant schema in the route handler and call schema.safeParse(req.body).

import { z } from "zod";

export class ValidationService {
    // PATCH /documents/:documentId/title — title must be a string of at most 32 characters.
    static readonly patchDocumentTitle = z.object({
        title: z.string().max(32, "Title cannot exceed 32 characters"),
    });

    // PUT /documents/:documentId/access — grant or update a user's access level on a document.
    // userId is the integer PK from the users table; accessLevel must be a valid role.
    static readonly upsertDocumentAccess = z.object({
        userId: z.number().int("userId must be an integer"),
        accessLevel: z.enum(["owner", "admin", "editor", "viewer"], {
            message: "accessLevel must be owner, admin, editor, or viewer",
        }),
    });
}
