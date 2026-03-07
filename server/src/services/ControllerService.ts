// ControllerService: registers all Express REST routes.
// Delegates business logic to the appropriate services via servicesStore.

import express, { Request, Response } from "express";
import { servicesStore } from "../store/servicesStore";

export class ControllerService {
    // Mounts all routes on the shared Express app. Called by App.start() before listen().
    registerRoutes(): void {
        const app = servicesStore.httpServerService.expressApp;

        // Parse JSON request bodies for all routes.
        app.use(express.json());

        // POST /auth/verify — verifies a Supabase access token sent by the frontend.
        // Body: { accessToken: string }
        // Returns the decoded user on success, 401 on invalid/missing token.
        app.post("/auth/verify", async (req: Request, res: Response) => {
            const { accessToken } = req.body as { accessToken?: string };

            if (!accessToken) {
                res.status(400).json({ error: "accessToken is required" });
                return;
            }

            const user = await servicesStore.authService.verifyToken(accessToken);

            if (!user) {
                res.status(401).json({ error: "Invalid or expired token" });
                return;
            }

            res.json({ user });
        });
    }
}
