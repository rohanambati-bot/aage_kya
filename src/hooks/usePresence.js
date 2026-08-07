import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

/**
 * Custom hook for presence-based online status via Supabase Presence channel.
 * Cleanly unsubscribes on component unmount.
 */
export function usePresence(userId, userMeta = {}) {
  const [onlineUsers, setOnlineUsers] = useState(new Map())

  useEffect(() => {
    if (!userId) return

    const presenceChannel = supabase.channel('presence:mentors', {
      config: {
        presence: {
          key: userId,
        },
      },
    })

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const newState = presenceChannel.presenceState()
        const activeMap = new Map()
        for (const [key, presences] of Object.entries(newState)) {
          if (presences && presences.length > 0) {
            activeMap.set(key, presences[0])
          }
        }
        setOnlineUsers(activeMap)
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        setOnlineUsers((prev) => {
          const next = new Map(prev)
          if (newPresences && newPresences[0]) {
            next.set(key, newPresences[0])
          }
          return next
        })
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUsers((prev) => {
          const next = new Map(prev)
          next.delete(key)
          return next
        })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            userId,
            onlineAt: new Date().toISOString(),
            ...userMeta,
          })
        }
      })

    return () => {
      supabase.removeChannel(presenceChannel)
    }
  }, [userId, userMeta])

  const isUserOnline = (id) => onlineUsers.has(id)

  return { onlineUsers, isUserOnline }
}
