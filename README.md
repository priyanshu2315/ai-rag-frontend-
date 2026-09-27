# DocuMind — Document RAG Frontend

React 19 + Vite SPA. **JS/JSX only — no TypeScript.** Upload documents, then ask
questions about them.

Two screens: `/login` (+ `/register`) and the chat itself.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # the gate — run this before calling anything done
npm run lint
```

The backend is expected on `http://localhost:3000/api`. Point it elsewhere with
a `.env` (see `.env.example`):

```
VITE_API_BASE_URL=http://localhost:4000/api
```

## Architecture

Built to `FRONTEND_ARCHITECTURE.md`. The section numbers below refer to it.

```txt
src/
├── components/   buttons/ inputs/ feedback/ layout/ chat/ documents/
├── pages/        auth/{Login,Register}  chat/ChatPage
├── redux/        store.js  axiosClient.js  createAppThunk.js  persistStorage.js
│                 slices/   actions/
├── services/     api.js + <module>Service.js     # the only place axios is called
├── router/       index.jsx  ProtectedRoute.jsx  GuestRoute.jsx
├── hooks/        useAuth  useChat  useDocuments  useAutoScroll  usePageTitle
├── validation/   authSchema.js  chatSchema.js    # Yup
├── constants/    env.js  routes.js  messages.js
├── utils/        notify.js  format.js  cn.js
└── styles/       index.css                       # design tokens (§3)
```

### The rules this codebase follows

- **Pages are thin** (§2). Logic lives in hooks → thunks → services.
- **Forms use RHF `Controller` — never `register`** (§8), validated with Yup.
- **Axios is only reachable from `services/`** (§11), and services call the
  shared `getAPI/postAPI/uploadAPI` wrappers rather than the client directly.
- **No `try/catch` in thunks or components** (§15.11). `createAppThunk` wraps
  every thunk once; `axiosClient` normalises and toasts errors centrally.
- **Cancellation is not an error** (§6). In-flight requests abort on unmount,
  and reducers ignore `{ canceled: true }` rejections.
- **Only `auth` is persisted** (§7.1). Documents are refetched; the chat
  transcript is deliberately per-session.
- **One `<Toaster/>`**, mounted at the root (§0.6). All toasts go through
  `utils/notify.js`.
- **Design tokens verbatim from §3.1**, consumed as Tailwind v4 token
  utilities (`bg-surface`, `text-muted`, `rounded-(--radius-sm)`), never inline
  styles.
- **Every route is lazy** (§10, §13).

### Request flow

```
Page → Hook → thunk (createAppThunk) → service → api.js → axiosClient → backend
```

`axiosClient` unwraps the success envelope, so callers get the payload directly.
It tolerates both shapes this backend uses:

| Response body | Caller receives |
|---|---|
| `{ success: true, data: X }` | `X` |
| `{ token, userId, email }` | itself |

### 401 handling

A 401 means two different things, and the interceptor distinguishes them:

- **Signed in** → the token went stale. Log out, purge storage, toast
  "session expired", redirect to `/login`.
- **Signed out** → this *is* the sign-in attempt, so 401 is "wrong password"
  and surfaces as a normal error toast.

### Runtime config

App code never reads `import.meta.env` — it imports from `constants/env.js`,
which resolves `window.__ENV__` → `import.meta.env` → default. `public/env.js`
is an empty dev placeholder; in a container, serve that path from the
environment so one built image can be promoted across dev/qa/prod without a
rebuild. Adding a new runtime var means adding it to `constants/env.js`.

## Backend contract

| Endpoint | Method | Body | Response |
|---|---|---|---|
| `/auth/register` | POST | `{ email, password }` | `{ message, userId }` |
| `/auth/login` | POST | `{ email, password }` | `{ token, userId, email }` |
| `/documents/my-documents` | GET | — | `{ success, data: Document[] }` |
| `/documents/upload` | POST | `multipart/form-data`, field `file` | `{ success, data: Document }` |
| `/documents/:docId` | DELETE | — | `{ success, message, data: { documentId } }` |
| `/chat` | POST | `{ question, documentId? }` | `text/event-stream` (see below) |

`documentId: null` means "search across every document".

The frontend (`:5173`) and backend (`:3000`) are different origins, so the
backend must send CORS headers and answer the `OPTIONS` preflight.

### Document deletion

The chat composer offers deletion beside Send for the selected document when its
status is `COMPLETED` or `FAILED`. A confirmation
names the document and explains that its file, summary, chunks, and document-specific
conversations are removed. Processing documents cannot be deleted.

The request uses the configured API base URL and bearer token, with no body or
query parameters. After success, the row and matching chunk cache are removed;
deleting the currently open document returns to All documents. Failed requests
keep the row and show the server error in the dialog, so partial storage/database
failures can be retried. Older list responses cannot restore deleted rows.

Run the frontend's offline deletion checks with:

```bash
node --test tests/document-delete.test.js
```

These exercise the real frontend service, authentication header, thunks, and
reducers with a mocked HTTP adapter. They do not call the backend or delete files.

## Rendering answers

`/chat` returns markdown, so assistant bubbles go through
`components/chat/Markdown.jsx` (react-markdown + remark-gfm). Every element is
mapped to design tokens there, so prose styling is defined once rather than
leaking into the bubble. Supported: bold/italic, headings, bullet and numbered
lists, links, inline code, fenced code blocks, blockquotes, and GFM tables.

Two rules that are deliberate, not incidental:

- **Raw HTML is not enabled** (no `rehype-raw`). Answers are model output built
  from user-supplied documents, so they are untrusted; react-markdown escapes
  any HTML in the source.
- **Only the assistant's text is parsed.** What the user typed renders verbatim
  — their own input should never be reinterpreted as markup.

Wide tables scroll inside the bubble, so the page itself never scrolls
sideways. The markdown dependency lands only on the lazy `ChatPage` chunk, so
`/login` is unaffected by it.

## Streaming (`POST /chat`)

The answer arrives as Server-Sent Events, so it renders token by token.

**Why this one service bypasses `api.js`** (`services/chatStream.js`): the
endpoint is a POST, which rules out `EventSource` — that is GET-only and cannot
carry an `Authorization` header. And axios in the browser cannot hand back a
response body incrementally. So this path uses `fetch` +
`response.body.getReader()`. §17 grants the same exception for SSE.

Because it skips the interceptors it re-attaches the bearer token itself and
routes failures through `handleApiError`, exported from `axiosClient` — so a
401 behaves identically whether it came from axios or from the stream, rather
than the stream growing a second, drifting copy of the policy.

**Frame handling.** Frames are `data: {"text":"…"}` separated by a blank line.
Network chunks split frames — and multi-byte characters — at arbitrary
boundaries, so the reader keeps a buffer, splits on the boundary, processes
only complete frames, and carries the remainder forward. `TextDecoder` is used
with `{ stream: true }` for the same reason. `[DONE]` is a bare sentinel, not
JSON, and is compared before any parse. A malformed frame is skipped rather
than killing an otherwise good stream.

**The states, all of which are real and handled:**

| Situation | What happens |
|---|---|
| Waiting for the first token | Empty bubble with animated dots |
| Tokens arriving | Text grows, blinking caret, Send becomes **Stop** |
| `[DONE]` with zero tokens | Fallback: "I couldn't find any relevant information…" |
| User presses Stop | Partial text is **kept** and labelled *Stopped* |
| Connection drops with no `[DONE]` | Partial text kept, flagged as unfinished |
| `202` still processing | Not a success — inline notice plus a **Try again** button |
| `401` | Signs out (shared policy) |
| `404` / `500` | Message surfaced in the transcript and toasted |

**Cancellation.** `thunkAPI.signal` is the abort path: `dispatch(askQuestion(…))`
returns a promise carrying `.abort()`, which reaches the fetch. `useChat` holds
that promise so the Stop button and the unmount cleanup share one mechanism —
which also means a StrictMode double-mount cannot leave a reader dangling.

Note for anyone adding thunks: `isCanceled` in `createAppThunk.js` checks
`action.meta.aborted` as well as the payload flag. RTK rejects an externally
aborted thunk with no payload at all, so a payload-only check silently
misreports every `.abort()` as a failure.
