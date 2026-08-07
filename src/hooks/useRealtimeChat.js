import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabaseClient'

/**
 * Custom hook for real-time mentor chat via Supabase Realtime (postgres_changes + broadcast typing indicator).
 * Cleanly unsubscribes all channels on unmount.
 */
export function useRealtimeChat({ sessionId, userId }) {
  const [messages, setMessages] = useState([])
  const [isTyping, setIsTyping] = useState(false)
  const typingTimeoutRef = useRef(null)
  const broadcastChannelRef = useRef(null)

  // 1. Fetch initial message history & set up postgres_changes subscription
  useEffect(() => {
    if (!sessionId) return

    let isMounted = true

    // Initial fetch
    async function loadMessages() {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })

      if (!error && data && isMounted) {
        setMessages(data)
      }
    }

    loadMessages()

    // Realtime Postgres Changes Subscription
    const postgresChannel = supabase
      .channel(`chat_messages:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const newMsg = payload.new
          if (!newMsg) return

          setMessages((prev) => {
            // Reconcile optimistic messages if client temp ID matches
            const exists = prev.some(
              (m) => m.id === newMsg.id || (m._tempId && m._tempId === newMsg._tempId)
            )
            if (exists) {
              return prev.map((m) =>
                m.id === newMsg.id || (m._tempId && m._tempId === newMsg._tempId) ? newMsg : m
              )
            }
            return [...prev, newMsg]
          })
        }
      )
      .subscribe()

    // Realtime Broadcast Channel for typing indicators
    const broadcastChannel = supabase.channel(`typing:${sessionId}`)
    broadcastChannelRef.current = broadcastChannel

    broadcastChannel
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload?.payload?.senderId !== userId) {
          setIsTyping(Boolean(payload?.payload?.typing))

          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
          typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false)
          }, 2500)
        }
      })
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(postgresChannel)
      supabase.removeChannel(broadcastChannel)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }, [sessionId, userId])

  // 2. Broadcast typing status
  const sendTypingNotification = useCallback(() => {
    if (broadcastChannelRef.current && sessionId && userId) {
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { senderId: userId, typing: true },
      })
    }
  }, [sessionId, userId])

  // 3. Optimistic Send Message
  const sendMessage = useCallback(
    async (content) => {
      if (!content || !content.trim() || !sessionId || !userId) return null

      const _tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
      const optimisticMsg = {
        id: _tempId,
        _tempId,
        session_id: sessionId,
        sender_id: userId,
        content: content.trim(),
        created_at: new Date().toISOString(),
        _optimistic: true,
      }

      // Append immediately
      setMessages((prev) => [...prev, optimisticMsg])

      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .insert({
            session_id: sessionId,
            sender_id: userId,
            content: content.trim(),
          })
          .select()
          .single()

        if (error) {
          console.error('[useRealtimeChat] Failed to send message:', error.message)
          // Revert optimistic insert on failure
          setMessages((prev) => prev.filter((m) => m._tempId !== _tempId))
          return null
        }

        if (data) {
          setMessages((prev) =>
            prev.map((m) => (m._tempId === _tempId ? data : m))
          )
          return data
        }
      } catch (err) {
        console.error('[useRealtimeChat] Send exception:', err)
        setMessages((prev) => prev.filter((m) => m._tempId !== _tempId))
      }

      return null
    },
    [sessionId, userId]
  )

  return {
    messages,
    isTyping,
    sendMessage,
    sendTypingNotification,
  }
}
