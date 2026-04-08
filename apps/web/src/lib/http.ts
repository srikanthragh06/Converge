import axios from "axios";

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_SERVER_URL,
    headers: {
        "Content-Type": "application/json",
    },
    // Required for the browser to send and receive cookies on cross-origin requests.
    withCredentials: true,
});

export default apiClient;
