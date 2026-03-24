// axiosClient: shared Axios instance for all backend HTTP requests.
// In prod, Traefik handles load balancing so there is one URL (VITE_SERVER_URL).
// In dev, the ?server=2 param selects the second replica for testing Redis pub/sub:
//   ?server=2  → VITE_SERVER_URL_2 (port 5001)
//   anything else → VITE_SERVER_URL_1 (port 5000)

import axios from "axios";
import { ENV_DEV, ENV_PROD } from "../constants/constants";

const environment: string | undefined = import.meta.env.VITE_ENVIRONMENT;

const params = new URLSearchParams(window.location.search);
let serverUrl: string | undefined = undefined;
if (environment === ENV_DEV) {
    serverUrl =
        params.get("server") === "2"
            ? import.meta.env.VITE_SERVER_URL_2
            : import.meta.env.VITE_SERVER_URL_1;
} else if (environment === ENV_PROD) {
    serverUrl = import.meta.env.VITE_SERVER_URL;
} else {
    console.error(
        `Unknown VITE_ENVIRONMENT "${environment}" — expected "${ENV_DEV}" or "${ENV_PROD}"`,
    );
}

export const axiosClient = axios.create({
    baseURL: serverUrl,
    headers: {
        "Content-Type": "application/json",
    },
    // Required for httpOnly cookies to be sent on cross-origin requests.
    withCredentials: true,
});
