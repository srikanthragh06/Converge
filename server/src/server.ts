import express from 'express'
import http from 'http'
import { Server as SocketIOServer } from 'socket.io'
import cors from 'cors'

export const expressApp = express()
export const server = http.createServer(expressApp)

const allowedOrigins = ['http://localhost:5173']

expressApp.use(cors({ origin: allowedOrigins }))

export const socketServer = new SocketIOServer(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
    },
    path: '/socket',
})
