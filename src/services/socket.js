import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_SOCKET_URL

class SocketService {
  constructor() {
    this.socket = null
    this.isConnected = false
  }

  connect() {
    if (this.socket && this.isConnected) {
      return this.socket
    }

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    this.socket.on('connect', () => {
      this.isConnected = true
      console.log('Socket connected:', this.socket.id)
    })

    this.socket.on('disconnect', () => {
      this.isConnected = false
      console.log('Socket disconnected')
    })

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
    })

    return this.socket
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.isConnected = false
    }
  }

  emitReload(reason, timeout = 30000) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        reject(new Error('Socket not connected'))
        return
      }

      const responses = []
      let timeoutId

      // Listen for client responses
      const handleClientStatus = (data) => {
        responses.push(data)
      }

      this.socket.on('admin:client-status', handleClientStatus)

      // Set timeout
      timeoutId = setTimeout(() => {
        this.socket.off('admin:client-status', handleClientStatus)
        resolve({
          success: responses.length > 0,
          responses,
          timedOut: true,
        })
      }, timeout)

      // Emit reload event
      this.socket.emit('admin:reload', {
        reason,
        timestamp: new Date().toISOString(),
      })

      // If we get at least one response quickly, we can resolve early
      setTimeout(() => {
        if (responses.length > 0) {
          clearTimeout(timeoutId)
          this.socket.off('admin:client-status', handleClientStatus)
          resolve({
            success: true,
            responses,
            timedOut: false,
          })
        }
      }, 2000) // Wait 2 seconds for quick responses
    })
  }

  getSocket() {
    return this.socket
  }
}

// Create singleton instance
const socketService = new SocketService()

export default socketService
