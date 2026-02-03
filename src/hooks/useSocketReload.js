import { useState, useEffect } from 'react'
import socketService from '../services/socket'

export function useSocketReload() {
  const [isReloading, setIsReloading] = useState(false)
  const [reloadMessage, setReloadMessage] = useState('')
  const [reloadMessageType, setReloadMessageType] = useState('')

  useEffect(() => {
    // Connect socket on mount
    socketService.connect()

    return () => {
      // Don't disconnect on unmount, keep connection alive across components
    }
  }, [])

  const notifyReload = async (reason) => {
    setIsReloading(true)
    setReloadMessage('Executing operation and notifying clients...')
    setReloadMessageType('info')

    try {
      const result = await socketService.emitReload(reason, 15000) // 30 second timeout

      if (result.success && !result.timedOut) {
        setReloadMessage(
          `Operation successful! and ${result.responses.length} client(s) refreshed.`
        )
        setReloadMessageType('success')
      } else if (result.success && result.timedOut) {
        setReloadMessage(
          `Operation successful! ${result.responses.length} client(s) responded before timeout.`
        )
        setReloadMessageType('success')
      } else {
        setReloadMessage(
          'Operation successful but no clients responded within 30 seconds.'
        )
        setReloadMessageType('warning')
      }
    } catch (error) {
      console.error('Reload notification error:', error)
      setReloadMessage(
        'Error while executing.'
      )
      setReloadMessageType('warning')
    } finally {
      setIsReloading(false)
      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setReloadMessage('')
        setReloadMessageType('')
      }, 1000)
    }
  }

  return {
    isReloading,
    reloadMessage,
    reloadMessageType,
    notifyReload,
  }
}
