import { useState, useEffect } from 'react'
import socketService from '../services/socket'

export function useSocketReload() {
  const [isReloading, setIsReloading] = useState(false)
  const [reloadMessage, setReloadMessage] = useState('')
  const [reloadMessageType, setReloadMessageType] = useState('')
  const [isAnnouncing, setIsAnnouncing] = useState(false)

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

  const notifyAnnounce = async (announcement) => {
    console.log('notifyAnnounce called with:', announcement)
    
    setIsAnnouncing(true)
    setIsReloading(true)
    setReloadMessage('Sending announcement to clients...')
    setReloadMessageType('info')

    try {
      console.log('Calling socketService.emitAnnounce...')
      const result = await socketService.emitAnnounce(announcement, 15000) // 15 second timeout
      console.log('Announce result:', result)

      if (result.success && !result.timedOut) {
        setReloadMessage(
          result.message || 'Announcement sent successfully!'
        )
        setReloadMessageType('success')
      } else if (result.timedOut) {
        setReloadMessage(
          'Request timed out. Server did not respond.'
        )
        setReloadMessageType('warning')
      } else {
        setReloadMessage(
          result.error || 'Failed to send announcement.'
        )
        setReloadMessageType('error')
      }
    } catch (error) {
      console.error('Announce notification error:', error)
      setReloadMessage(
        `Error while sending announcement: ${error.message || 'Unknown error'}`
      )
      setReloadMessageType('error')
      // Re-throw to allow component to catch it
      throw error
    } finally {
      setIsAnnouncing(false)
      setIsReloading(false)
      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setReloadMessage('')
        setReloadMessageType('')
      }, 5000)
    }
  }

  return {
    isReloading,
    reloadMessage,
    reloadMessageType,
    notifyReload,
    isAnnouncing,
    notifyAnnounce,
  }
}
