import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bot,
  CircleStop,
  MessagesSquare,
  Send,
  Sparkles,
  User,
  Zap,
} from 'lucide-react'
import {
  askQuestion,
  askQuestionStreaming,
  createId,
  isAbortError,
  toErrorMessage,
} from '../api'
import './ChatPanel.css'

const WELCOME = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hi! Upload a PDF on the left, then ask me anything about it. I'll answer using only the content of your indexed documents.",
}

const SUGGESTIONS = [
  'Summarise the key points of the document.',
  'What are the main risks mentioned?',
  'List every date and deadline you can find.',
]

export default function ChatPanel({ documentCount }) {
  const [messages, setMessages] = useState([WELCOME])
  const [input, setInput] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [useStreaming, setUseStreaming] = useState(false)

  const scrollRef = useRef(null)
  const textareaRef = useRef(null)
  const formRef = useRef(null)
  const abortRef = useRef(null)

  const appendMessage = useCallback((message) => {
    setMessages((prev) => [...prev, message])
  }, [])

  /* --------------------------------------------------------------- *
   * A. Standard JSON request (axios)  — the default path.
   *    POST /api/chat  { question }  ->  { success: true, answer }
   * --------------------------------------------------------------- */
  const sendMessage = useCallback(
    async (question) => {
      setIsBusy(true)
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const data = await askQuestion(question, { signal: controller.signal })

        if (data && data.success === false) {
          throw new Error(
            data.error || data.message || 'The server could not answer that.',
          )
        }

        appendMessage({
          id: createId('msg'),
          role: 'assistant',
          content: data?.answer || 'The server returned an empty answer.',
        })
      } catch (error) {
        if (!isAbortError(error)) {
          appendMessage({
            id: createId('msg'),
            role: 'assistant',
            content: toErrorMessage(error),
            isError: true,
          })
        }
      } finally {
        abortRef.current = null
        setIsBusy(false)
      }
    },
    [appendMessage],
  )

  /* --------------------------------------------------------------- *
   * B. Streaming request (native fetch + ReadableStream reader).
   *
   *    Same endpoint and same JSON payload, but the answer bubble is
   *    created empty up front and grows as decoded chunks arrive, so
   *    text appears word-by-word instead of all at once.
   *
   *    The reader/decoder plumbing lives in `askQuestionStreaming`
   *    (src/api.js); this function only owns the React state.
   * --------------------------------------------------------------- */
  const sendMessageStreaming = useCallback(async (question) => {
    setIsBusy(true)
    const controller = new AbortController()
    abortRef.current = controller

    const messageId = createId('msg')
    setMessages((prev) => [
      ...prev,
      { id: messageId, role: 'assistant', content: '', isStreaming: true },
    ])

    const patch = (updater) =>
      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId ? { ...message, ...updater(message) } : message,
        ),
      )

    try {
      await askQuestionStreaming(question, {
        signal: controller.signal,
        // Fires on every decoded chunk — repaint immediately.
        onChunk: (_chunk, answerSoFar) => patch(() => ({ content: answerSoFar })),
      })

      patch((message) => ({
        isStreaming: false,
        content: message.content || 'The server returned an empty answer.',
      }))
    } catch (error) {
      const message = toErrorMessage(error)
      patch((current) => ({
        isStreaming: false,
        isError: !current.content,
        content: current.content
          ? `${current.content}\n\n— stream interrupted: ${message}`
          : message,
      }))
    } finally {
      abortRef.current = null
      setIsBusy(false)
    }
  }, [])

  const handleSubmit = (event) => {
    event.preventDefault()
    const question = input.trim()
    if (!question || isBusy) return

    setInput('')
    appendMessage({ id: createId('msg'), role: 'user', content: question })

    if (useStreaming) sendMessageStreaming(question)
    else sendMessage(question)
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      formRef.current?.requestSubmit()
    }
  }

  const stopRequest = () => abortRef.current?.abort()

  // Keep the newest message in view.
  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, isBusy])

  // Grow the textarea with its content, up to a ceiling.
  useEffect(() => {
    const node = textareaRef.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`
  }, [input])

  // Abort any in-flight request if the panel unmounts.
  useEffect(() => () => abortRef.current?.abort(), [])

  const showTypingIndicator =
    isBusy && !messages.some((message) => message.isStreaming)

  return (
    <section className="panel chat">
      <header className="panel__head">
        <div>
          <h2 className="panel__title">
            <MessagesSquare size={16} strokeWidth={2.2} />
            AI Chat Interface
          </h2>
          <p className="panel__subtitle">
            {documentCount > 0
              ? `Answering from ${documentCount} indexed ${documentCount === 1 ? 'document' : 'documents'}`
              : 'Upload a document to ground the answers'}
          </p>
        </div>

        <label className="stream-toggle" title="Stream tokens as they arrive">
          <input
            type="checkbox"
            checked={useStreaming}
            onChange={(event) => setUseStreaming(event.target.checked)}
          />
          <span className="stream-toggle__track">
            <span className="stream-toggle__thumb" />
          </span>
          <span className="stream-toggle__label">
            <Zap size={13} strokeWidth={2.4} />
            Stream
          </span>
        </label>
      </header>

      <div className="chat__scroll" ref={scrollRef}>
        <div className="chat__messages">
          {messages.map((message) => (
            <article
              key={message.id}
              className={`msg msg--${message.role}${message.isError ? ' msg--error' : ''}`}
            >
              <span className="msg__avatar">
                {message.role === 'user' ? (
                  <User size={15} strokeWidth={2.2} />
                ) : (
                  <Bot size={15} strokeWidth={2.2} />
                )}
              </span>
              <div className="msg__bubble">
                {message.content}
                {message.isStreaming && <span className="msg__caret" />}
              </div>
            </article>
          ))}

          {showTypingIndicator && (
            <article className="msg msg--assistant">
              <span className="msg__avatar">
                <Bot size={15} strokeWidth={2.2} />
              </span>
              <div className="msg__bubble msg__bubble--typing">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </article>
          )}
        </div>
      </div>

      <div className="composer">
        {messages.length === 1 && !isBusy && (
          <div className="suggestions">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="suggestion"
                onClick={() => {
                  setInput(suggestion)
                  textareaRef.current?.focus()
                }}
              >
                <Sparkles size={12} strokeWidth={2.2} />
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <form className="composer__form" onSubmit={handleSubmit} ref={formRef}>
          <textarea
            ref={textareaRef}
            className="composer__input"
            value={input}
            rows={1}
            placeholder="Ask a question about your documents…"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
          />

          {isBusy ? (
            <button
              type="button"
              className="composer__button composer__button--stop"
              onClick={stopRequest}
              aria-label="Stop generating"
            >
              <CircleStop size={17} strokeWidth={2.2} />
            </button>
          ) : (
            <button
              type="submit"
              className="composer__button"
              disabled={!input.trim()}
              aria-label="Send message"
            >
              <Send size={16} strokeWidth={2.2} />
            </button>
          )}
        </form>

        <p className="composer__hint">
          <kbd>Enter</kbd> to send · <kbd>Shift</kbd> + <kbd>Enter</kbd> for a new
          line
        </p>
      </div>
    </section>
  )
}
