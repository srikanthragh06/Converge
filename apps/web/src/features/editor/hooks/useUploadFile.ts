import { useCallback } from "react";
import { type GetUploadAuthResponseDto } from "@converge/shared";
import apiClient from "@/lib/http";

/**
 * Returns an async uploadFile function suitable for BlockNote's uploadFile config.
 * Handles size validation, fetching a signed upload token from the server, and the
 * direct upload to ImageKit, so the private key never passes through the client.
 * @param documentId - the document the uploaded file goes into
 */
const useUploadFile = (documentId: number) => {
    /**
     * Validates the file, fetches a one-time upload token for it from the server,
     * uploads the file directly to ImageKit, and returns the public CDN URL.
     * Throws on size violations, auth failures, or upload errors so BlockNote
     * can surface an error state in the block.
     * @param file - the file to upload
     * @returns the public CDN URL of the uploaded file
     */
    const uploadFile = useCallback(
        async (file: File): Promise<string> => {
            // Reject unsupported file types before any network request.
            let fileType: "image" | "video" | "audio";
            if (file.type.startsWith("image/")) fileType = "image";
            else if (file.type.startsWith("video/")) fileType = "video";
            else if (file.type.startsWith("audio/")) fileType = "audio";
            else
                throw new Error(
                    "Only images, videos, and audio files can be uploaded.",
                );

            // Fail fast with a clear message. ImageKit enforces the real limits
            // through the checks the server signs into the token.
            if (fileType === "image" && file.size > 25 * 1024 * 1024)
                throw new Error("Images must be under 25MB.");
            if (fileType === "video" && file.size > 100 * 1024 * 1024)
                throw new Error("Videos must be under 100MB.");
            if (fileType === "audio" && file.size > 5 * 1024 * 1024)
                throw new Error("Audio files must be under 5MB.");

            // The server picks the folder, name, transformation and checks, and signs
            // them into the token — ImageKit rejects the upload if any field differs.
            const { data: auth } =
                await apiClient.get<GetUploadAuthResponseDto>(
                    `/document/${documentId}/upload-auth`,
                    { params: { fileType } },
                );

            const body = new FormData();
            body.append("file", file);
            for (const [name, value] of Object.entries(auth.fields))
                body.append(name, value);
            body.append("token", auth.token);

            const res = await fetch(auth.uploadUrl, {
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
        [documentId],
    );

    return uploadFile;
};

export default useUploadFile;
