import axios from "axios";

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_SERVER_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

export default apiClient;
