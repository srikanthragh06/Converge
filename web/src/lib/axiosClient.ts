// axiosClient: shared Axios instance for all backend HTTP requests.
// Resolves baseURL from the ?server query param, same logic as socket.ts.
// ?server=2  → VITE_SERVER_URL_2
// anything else (including no param) → VITE_SERVER_URL_1

import axios from "axios";

const params = new URLSearchParams(window.location.search);
const serverUrl =
    params.get("server") === "2"
        ? import.meta.env.VITE_SERVER_URL_2
        : import.meta.env.VITE_SERVER_URL_1;

export const axiosClient = axios.create({
    baseURL: serverUrl,
    headers: {
        "Content-Type": "application/json",
    },
    // Required for httpOnly cookies to be sent on cross-origin requests.
    withCredentials: true,
});
