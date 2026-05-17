import { useCallback } from "react";
import { type GetUploadAuthResponseDto } from "@converge/shared";
import apiClient from "../lib/http";

const IMAGEKIT_PUBLIC_KEY = import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY as string;
const IMAGEKIT_UPLOAD_URL = import.meta.env.VITE_IMAGEKIT_UPLOAD_URL as string;

/**
 * Returns an async uploadFile function suitable for BlockNote's uploadFile config.
 * Handles size validation, server-side auth token fetching, and direct upload to
 * ImageKit so the private key never passes through the client.
 * @param workspaceId - scopes the upload folder to the current workspace
 * @param documentId - scopes the upload folder to the current document
 */
const useUploadFile = (workspaceId: number, documentId: string) => {
    /**
     * Validates the file, fetches a one-time auth token from the server, uploads
     * the file directly to ImageKit, and returns the public CDN URL.
     * Throws on size violations, auth failures, or upload errors so BlockNote
     * can surface an error state in the block.
     * @param file - the file to upload
     * @returns the public CDN URL of the uploaded file
     */
    const uploadFile = useCallback(
        async (file: File): Promise<string> => {
            // Fail fast if required env vars are missing — avoids a confusing ImageKit rejection downstream.
            if (!IMAGEKIT_PUBLIC_KEY)
                throw new Error("VITE_IMAGEKIT_PUBLIC_KEY is not configured.");
            if (!IMAGEKIT_UPLOAD_URL)
                throw new Error("VITE_IMAGEKIT_UPLOAD_URL is not configured.");

            // Enforce size caps before any network request — fails fast with a clear message.
            // Each check is independent so image/video limits don't fall through to the generic cap.
            if (file.type.startsWith("image/") && file.size > 25 * 1024 * 1024)
                throw new Error("Images must be under 25MB.");
            if (file.type.startsWith("video/") && file.size > 100 * 1024 * 1024)
                throw new Error("Videos must be under 100MB.");
            if (
                !file.type.startsWith("image/") &&
                !file.type.startsWith("video/") &&
                file.size > 5 * 1024 * 1024
            )
                throw new Error("Files must be under 5MB.");

            // Fetch a one-time signed token from our server — the private key never leaves the server.
            const { data: auth } =
                await apiClient.get<GetUploadAuthResponseDto>(
                    "/document/upload-auth",
                );

            // Build the multipart payload for ImageKit's upload API.
            const body = new FormData();
            body.append("file", file);
            body.append("fileName", crypto.randomUUID());
            body.append("publicKey", IMAGEKIT_PUBLIC_KEY);
            body.append("token", auth.token);
            body.append("expire", String(auth.expire));
            body.append("signature", auth.signature);
            body.append("folder", `/converge/workspaces/${workspaceId}/documents/${documentId}`);

            // Pre-transform images at ingestion to cap resolution and quality before storage.
            if (file.type.startsWith("image/"))
                body.append(
                    "transformation",
                    JSON.stringify({ pre: "w-2000,q-80" }),
                );

            const res = await fetch(IMAGEKIT_UPLOAD_URL, {
                method: "POST",
                body,
            });

            if (!res.ok)
                throw new Error(
                    `Upload failed: ${res.status} ${res.statusText}`,
                );

            const json = await res.json();
            return json.url as string;
        },
        [workspaceId, documentId],
    );

    return uploadFile;
};

export default useUploadFile;
