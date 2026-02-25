// dotenv.config() must run before any other import that reads process.env,
// so it is called here at the top of the entry point.
import dotenv from 'dotenv'
dotenv.config()

import { server } from './server'

const PORT = Number(process.env.PORT) || 5000

server.listen(PORT, () => {
    console.log(`Server running on :${PORT}`)
})
