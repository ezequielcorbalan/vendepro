'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'

const API_PUBLIC = process.env.NEXT_PUBLIC_API_PUBLIC_URL ?? 'https://public.api.vendepro.com.ar'

interface Message {
  id: string
  text: string
  sender: 'bot' | 'user'
  timestamp: Date
}

interface WidgetConfig {
  org_name: string
  logo_url: string | null
  brand_color: string
  brand_accent_color: string
  welcome_message: string
  bot_enabled: boolean
}

function generateSessionId() {
  return 'ws_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16)
}

export default function ChatWidgetPage() {
  const params = useParams()
  const slug = params.slug as string

  const [config, setConfig] = useState<WidgetConfig | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sessionId] = useState(() => generateSessionId())
  const [started, setStarted] = useState(false)
  const [done, setDone] = useState(false)
  const [minimized, setMinimized] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const fallbackConfig: WidgetConfig = {
    org_name: 'Asistente',
    logo_url: null,
    brand_color: '#ff007c',
    brand_accent_color: '#ff8017',
    welcome_message: '¡Hola! ¿En qué te puedo ayudar?',
    bot_enabled: true,
  }

  useEffect(() => {
    fetch(`${API_PUBLIC}/widget/${slug}/config`)
      .then(r => {
        if (!r.ok) throw new Error('not found')
        return r.json()
      })
      .then(data => setConfig(data))
      .catch(() => setConfig(fallbackConfig))
  }, [slug])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (window.parent === window) return
    const msg = minimized
      ? { type: 'vendepro-widget-resize', width: 100, height: 100, interactive: true }
      : { type: 'vendepro-widget-resize', width: 420, height: 580, interactive: true }
    window.parent.postMessage(msg, '*')
  }, [minimized])

  const startConversation = async () => {
    setStarted(true)
    setMinimized(false)
    setSending(true)

    try {
      const res = await fetch(`${API_PUBLIC}/widget/${slug}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, text: '', visitor: {} }),
      })
      const data = (await res.json()) as any
      setMessages([{
        id: '1',
        text: data.reply,
        sender: 'bot',
        timestamp: new Date(),
      }])
    } catch {
      setMessages([{
        id: '1',
        text: config?.welcome_message || '¡Hola! ¿En qué te puedo ayudar?',
        sender: 'bot',
        timestamp: new Date(),
      }])
    }

    setSending(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const sendMessage = async () => {
    if (!input.trim() || sending || done) return
    const userMsg: Message = {
      id: Date.now().toString(),
      text: input.trim(),
      sender: 'user',
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)

    try {
      const res = await fetch(`${API_PUBLIC}/widget/${slug}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, text: userMsg.text }),
      })
      const data = (await res.json()) as any
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: data.reply,
        sender: 'bot',
        timestamp: new Date(),
      }])
      if (data.done) setDone(true)
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: 'Disculpá, hubo un error. Intentá de nuevo.',
        sender: 'bot',
        timestamp: new Date(),
      }])
    }

    setSending(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const brandColor = config?.brand_color || '#ff007c'
  const accentColor = config?.brand_accent_color || '#ff8017'

  if (!config) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'transparent' }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${brandColor}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // Minimized bubble
  if (minimized) {
    return (
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
        <button
          onClick={() => started ? setMinimized(false) : startConversation()}
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${brandColor}, ${accentColor})`,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      width: 380,
      maxWidth: 'calc(100vw - 32px)',
      height: 520,
      maxHeight: 'calc(100vh - 48px)',
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Poppins', -apple-system, sans-serif",
      zIndex: 9999,
      background: '#fff',
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${brandColor}, ${accentColor})`,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
      }}>
        {config.logo_url && (
          <img src={config.logo_url} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', background: 'white' }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ color: 'white', fontWeight: 600, fontSize: 15 }}>{config.org_name}</div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
            {done ? 'Conversación finalizada' : 'Responde en minutos'}
          </div>
        </div>
        <button
          onClick={() => setMinimized(true)}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: 'white', fontSize: 18, lineHeight: 1 }}
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: '#f8f9fa',
      }}>
        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div style={{
              maxWidth: '80%',
              padding: '10px 14px',
              borderRadius: msg.sender === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: msg.sender === 'user' ? brandColor : 'white',
              color: msg.sender === 'user' ? 'white' : '#333',
              fontSize: 14,
              lineHeight: 1.5,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}>
              {msg.text}
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '10px 14px',
              borderRadius: '16px 16px 16px 4px',
              background: 'white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              display: 'flex',
              gap: 4,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ccc', animation: 'bounce 1.4s ease-in-out infinite' }} />
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ccc', animation: 'bounce 1.4s ease-in-out 0.2s infinite' }} />
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ccc', animation: 'bounce 1.4s ease-in-out 0.4s infinite' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #eee',
        display: 'flex',
        gap: 8,
        background: 'white',
        flexShrink: 0,
      }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder={done ? 'Conversación finalizada' : 'Escribí tu mensaje...'}
          disabled={done || sending}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 24,
            border: '1px solid #e0e0e0',
            fontSize: 14,
            outline: 'none',
            fontFamily: 'inherit',
            background: done ? '#f5f5f5' : 'white',
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || sending || done}
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: !input.trim() || done ? '#e0e0e0' : brandColor,
            border: 'none',
            cursor: !input.trim() || done ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.2s',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>

      {/* Branding footer */}
      <div style={{
        padding: '6px 16px',
        textAlign: 'center',
        fontSize: 10,
        color: '#aaa',
        background: 'white',
        borderTop: '1px solid #f0f0f0',
        flexShrink: 0,
      }}>
        Powered by VendéPro
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap');
      `}</style>
    </div>
  )
}
