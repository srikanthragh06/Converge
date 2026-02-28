// Entry point. dotenv.config() must run before any import reads process.env —
// in CommonJS (tsc output), module evaluation runs top-to-bottom so this is safe.
import dotenv from "dotenv";
dotenv.config();

import { App } from "./App";

const PORT = Number(process.env.PORT) || 5000;

new App(PORT).start().catch((err) => {
    console.error("Fatal startup error:", err);
    process.exit(1);
});
