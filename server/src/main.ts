import dotenv from 'dotenv'
dotenv.config()

import { server } from './server'

const PORT = Number(process.env.PORT) || 5000

server.listen(PORT, () => {
    console.log(`Server running on :${PORT}`)
})
