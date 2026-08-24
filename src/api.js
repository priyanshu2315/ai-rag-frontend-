import axios from 'axios'

/**
 * Base URL of the local RAG backend.
 * Override it by creating a `.env` file with: VITE_API_BASE_URL=http://localhost:4000
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
})

/* ------------------------------------------------------------------ *
 * 1. Document upload  ->  POST /api/documents/upload (multipart)
 * ------------------------------------------------------------------ */

/**
 * Uploads a single file as multipart/form-data under the field name "file".
 * `onProgress` receives an integer 0-100.
 */
export async function uploadDocument(file, { onProgress, signal } = {}) {
  const formData = new FormData()
  formData.append('file', file)

  // Content-Type is intentionally omitted: axios sets it along with the
  // multipart boundary once it sees a FormData body.
  const response = await http.post('/api/documents/upload', formData, {
    signal,
    onUploadProgress: (event) => {
      if (!onProgress) return
      const total = event.total ?? file.size
      if (!total) return
      onProgress(Math.min(100, Math.round((event.loaded * 100) / total)))
    },
  })

  return response.data
}

/* ------------------------------------------------------------------ *
 * 2. Chat (standard JSON)  ->  POST /api/chat
 *    Request:  { question }
 *    Response: { success: true, answer }
 * ------------------------------------------------------------------ */

export async function askQuestion(question, { signal } = {}) {
  const response = await http.post('/api/chat', { question }, { signal })
  return response.data
}

/* ------------------------------------------------------------------ *
 * 3. Chat (streaming alternative)  ->  POST /api/chat
 *
 * Axios cannot surface a response body incrementally in the browser, so the
 * streaming path uses the native fetch API and reads `response.body` through
 * a ReadableStream reader. Each Uint8Array chunk is decoded and handed to
 * `onChunk` the moment it arrives, so the UI can paint tokens in real time
 * instead of waiting for the request to finish.
 *
 * Handles both transports a backend is likely to use:
 *   - text/event-stream (SSE frames: `data: ...`, terminated by `[DONE]`)
 *   - a raw text/plain token stream
 * ------------------------------------------------------------------ */

const DONE = Symbol('stream-done')

export async function askQuestionStreaming(question, { onChunk, signal } = {}) {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream, text/plain, application/json',
    },
    body: JSON.stringify({ question }),
    signal,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(
      detail.trim().slice(0, 300) ||
        `Request failed with status ${response.status}`,
    )
  }

  if (!response.body) {
    throw new Error('This browser does not expose a readable response stream.')
  }

  const isEventStream = (response.headers.get('content-type') || '').includes(
    'text/event-stream',
  )

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let answer = ''

  const emit = (text) => {
    if (!text) return
    answer += text
    onChunk?.(text, answer)
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      // `value` is a Uint8Array; `stream: true` keeps multi-byte
      // characters intact when they straddle a chunk boundary.
      const decoded = decoder.decode(value, { stream: true })

      if (!isEventStream) {
        emit(decoded)
        continue
      }

      buffer += decoded
      const frames = buffer.split(/\r?\n\r?\n/)
      buffer = frames.pop() ?? ''

      for (const frame of frames) {
        const text = readEventFrame(frame)
        if (text === DONE) return answer
        emit(text)
      }
    }

    // Flush whatever bytes the decoder is still holding.
    const tail = decoder.decode()
    if (isEventStream) {
      buffer += tail
      if (buffer.trim()) {
        const text = readEventFrame(buffer)
        if (text !== DONE) emit(text)
      }
    } else {
      emit(tail)
    }
  } finally {
    reader.releaseLock()
  }

  return answer
}

/** Pulls the text out of one SSE frame (a frame may hold several `data:` lines). */
function readEventFrame(frame) {
  let out = ''

  for (const rawLine of frame.split(/\r?\n/)) {
    const line = rawLine.trimStart()
    if (!line || line.startsWith(':') || !line.startsWith('data:')) continue

    const payload = line.slice(5).trim()
    if (!payload) continue
    if (payload === '[DONE]') return DONE

    out += extractText(payload)
  }

  return out
}

/** An SSE payload may be plain text or JSON — accept the common shapes. */
function extractText(payload) {
  try {
    const parsed = JSON.parse(payload)
    if (typeof parsed === 'string') return parsed
    if (!parsed || typeof parsed !== 'object') return ''

    const candidate =
      parsed.answer ??
      parsed.text ??
      parsed.token ??
      parsed.content ??
      parsed.delta

    if (typeof candidate === 'string') return candidate
    if (candidate && typeof candidate === 'object') {
      return typeof candidate.text === 'string' ? candidate.text : ''
    }
    return ''
  } catch {
    // Not JSON — the backend is streaming bare text.
    return payload
  }
}

/* ------------------------------------------------------------------ *
 * Shared helpers
 * ------------------------------------------------------------------ */

export function isAbortError(error) {
  return (
    axios.isCancel(error) ||
    error?.name === 'AbortError' ||
    error?.name === 'CanceledError'
  )
}

/** Turns an axios/fetch failure into something worth showing a user. */
export function toErrorMessage(error, fallback = 'Something went wrong.') {
  if (isAbortError(error)) return 'Request cancelled.'

  const data = error?.response?.data
  if (typeof data === 'string' && data.trim()) return data.trim().slice(0, 300)

  const fromBody = data?.error || data?.message
  if (fromBody) return String(fromBody)

  if (error?.code === 'ERR_NETWORK') {
    return `Cannot reach the backend at ${API_BASE_URL}. Is the server running?`
  }
  if (error?.code === 'ECONNABORTED') {
    return 'The request timed out before the server responded.'
  }

  return error?.message || fallback
}

/** Stable-enough ids for list keys. */
export function createId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
