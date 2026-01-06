'use client'

import { io, Socket } from 'socket.io-client'

/**
 * Socket.io Client for Reno Dev Space Chat
 *
 * Provides real-time messaging with server persistence.
 */

let socketInstance: Socket | null = null
let connectionErrorCount = 0
let lastErrorLogTime = 0
const ERROR_LOG_THROTTLE_MS = 30000

export function getSocket(): Socket | null {
  if (typeof window === 'undefined') {
    return null
  }

  if (!socketInstance) {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKETIO_URL || 'http://localhost:8765'

    socketInstance = io(socketUrl, {
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: 10,
      transports: ['websocket', 'polling']
    })

    socketInstance.on('connect', () => {
      connectionErrorCount = 0
      console.log('[Socket.io] Connected to chat server')
    })

    socketInstance.on('disconnect', (reason) => {
      console.log('[Socket.io] Disconnected:', reason)
    })

    socketInstance.on('connect_error', () => {
      connectionErrorCount++
      const now = Date.now()
      if (now - lastErrorLogTime > ERROR_LOG_THROTTLE_MS) {
        lastErrorLogTime = now
        console.warn(`[Socket.io] Chat server unavailable (attempt ${connectionErrorCount})`)
      }
    })

    socketInstance.on('error', ({ code, message }: { code: string; message: string }) => {
      console.error(`[Socket.io] Server error [${code}]:`, message)
    })
  }

  return socketInstance
}

export function isSocketUnavailable(): boolean {
  return connectionErrorCount >= 10
}
