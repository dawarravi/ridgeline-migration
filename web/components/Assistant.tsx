'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useMemo, useState } from 'react'

const TOOL_LABELS: Record<string, string> = {
  'tool-checkStock': 'Checked live stock',
  'tool-getProductDetails': 'Looked up product details',
  'tool-findProducts': 'Searched the catalog',
}

// Client island inside the cached product page: the page shell stays static
// and only this box talks to /api/assistant.
export function Assistant({ slug, name }: { slug: string; name: string }) {
  const [input, setInput] = useState('')
  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/assistant', body: { slug } }), [slug])
  const { messages, sendMessage, status, error } = useChat({ id: `assistant-${slug}`, transport })
  const busy = status === 'submitted' || status === 'streaming'

  return (
    <section className="assistant" aria-label="Shopping assistant">
      <h2>Ask about the {name}</h2>
      <div className="chat" aria-live="polite">
        {messages.length === 0 && <p className="muted">e.g. &ldquo;Is medium in stock? Warm enough for Iceland in March?&rdquo;</p>}
        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'msg me' : 'msg bot'}>
            {m.parts.map((part, i) =>
              part.type === 'text' ? (
                <p key={i}>{part.text}</p>
              ) : part.type in TOOL_LABELS ? (
                <p key={i} className="tool">↳ {TOOL_LABELS[part.type]}</p>
              ) : null,
            )}
          </div>
        ))}
        {status === 'submitted' && <p className="muted">Thinking…</p>}
        {error && <p className="muted">The assistant is unavailable right now. Stock and sizes are shown above.</p>}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const text = input.trim()
          if (!text || busy) return
          sendMessage({ text })
          setInput('')
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          placeholder="Ask a question"
          aria-label="Ask the shopping assistant"
        />{' '}
        <button disabled={busy}>Ask</button>
      </form>
    </section>
  )
}
