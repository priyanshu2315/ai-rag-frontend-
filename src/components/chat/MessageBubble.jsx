import { memo, useCallback, useMemo, useState } from 'react';
import { Bot, User, AlertTriangle, RotateCw } from 'lucide-react';
import cn from '../../utils/cn';
import { formatTime } from '../../utils/format';
import { MESSAGES, ROLE } from '../../constants/messages';
import Markdown from './Markdown';
import TypingDots from './TypingDots';
import ReasoningViewer from './ReasoningViewer';
import AnswerTimeline from './AnswerTimeline';
import SourceDrawer from './SourceDrawer';
import { resolveCitation, sourceDocuments } from '../../utils/crag';
import { buildCitationIndex, chunkForCitation, evidenceForAnswer, previewSource, streamCitationFor } from '../../utils/chatSources';
import AnswerSources from './AnswerSources';
import AnswerUsage from './AnswerUsage';
import DocumentPreview from '../documents/DocumentPreview';
import { messageCitations, messageUsage, messageSteps, messageStepCosts, messageReasoningChain } from '../../utils/messageMetadata';
import { enrichReferenceCitation, observedChunks, referenceSelection } from '../../utils/crossReferences';
import { reasoningExport } from '../../utils/reasoningExport';

/**
 * Memoised, and it earns it here: a streaming answer dispatches once per
 * fragment, so without this every settled bubble would re-render on every
 * token. Immer keeps the identity of untouched messages, so only the bubble
 * being streamed into actually re-renders.
 */
const MessageBubble = memo(({ message, onRetry }) => {
  const isUser = message.role === ROLE.USER;
  const { content, streaming, failed, interrupted, stopped, muted, retryable, notice } = message;
  const steps = useMemo(() => messageSteps(message), [message]);
  const [citation, setCitation] = useState(null);
  const [preview, setPreview] = useState(null);
  const [selectedEvidence, setSelectedEvidence] = useState([]);
  const [referenceStatus, setReferenceStatus] = useState(null);
  const sources = useMemo(() => sourceDocuments(steps), [steps]);
  const referenceChunks = useMemo(() => evidenceForAnswer({ retrievedChunks: observedChunks(steps, message.retrievedChunks) }), [steps, message.retrievedChunks]);
  const citations = useMemo(() => messageCitations(message).map((item) => enrichReferenceCitation(item, referenceChunks)), [message, referenceChunks]);
  const citationIndex = useMemo(() => buildCitationIndex(citations), [citations]);
  const usage = messageUsage(message);
  const evidence = useMemo(() => evidenceForAnswer(message), [message]);
  const inspectorChunks = selectedEvidence.length ? referenceChunks : evidence;
  const selectEvidence = (ids, status) => { setSelectedEvidence(ids); setReferenceStatus(status); };
  const openSource = useCallback((value) => {
    const enriched = enrichReferenceCitation(value, referenceChunks);
    const sourcePreview = previewSource(enriched, referenceChunks);
    if (sourcePreview.file.fileUrl) setPreview(sourcePreview);
    else setCitation(enriched);
  }, [referenceChunks]);
  const openCitation = useCallback((value) => {
    const supplied = streamCitationFor(value, citations, citationIndex);
    const chunk = chunkForCitation(value, evidence);
    if (supplied || chunk?.fileUrl) openSource(supplied ?? value);
    else setCitation(value);
  }, [citations, citationIndex, evidence, openSource]);
  const closeCitation = useCallback(() => setCitation(null), []);
  const closePreview = useCallback(() => setPreview(null), []);

  return (
    <div className={cn('flex min-w-0 gap-2 sm:gap-3', isUser && 'flex-row-reverse')}>
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser && 'bg-navy text-white',
          !isUser && failed && 'bg-red-bg text-red',
          !isUser && !failed && 'bg-blue-lt text-blue'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </span>

      <div className={cn('min-w-0', isUser ? 'max-w-[min(640px,85%)] text-right' : 'max-w-[760px] flex-1')}>
        <div
          className={cn(
            'break-words rounded-(--radius) px-3 py-2.5 text-left text-sm leading-relaxed sm:px-4',
            isUser && 'whitespace-pre-wrap rounded-tr-sm bg-navy text-white',
            !isUser && 'rounded-tl-sm border shadow-(--sh-sm)',
            !isUser && failed && 'border-red/30 bg-red-bg text-red',
            !isUser && !failed && 'border-border bg-surface',
            !isUser && !failed && muted ? 'text-muted' : !isUser && !failed && 'text-ink'
          )}
        >
          {/* eslint-disable-next-line no-nested-ternary */}
          {isUser ? (
            // The user's own text is never parsed as markup.
            content
          ) : failed ? (
            <span className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{content}</span>
            </span>
          ) : (
            <>
              {steps.length > 0 && <AnswerTimeline steps={steps} streaming={streaming} separated={Boolean(content)}
                copyText={() => reasoningExport(message)}
                onReferenceSelect={(link) => selectEvidence(referenceSelection(link), `Connected evidence for ${link.reference ?? 'reference'}`)} />}
              {messageReasoningChain(message) && (
                <ReasoningViewer
                  message={message}
                  chain={messageReasoningChain(message)}
                  steps={steps}
                  streaming={streaming}
                  onReferenceSelect={(link) => selectEvidence(referenceSelection(link), `Connected evidence for ${link.reference ?? 'reference'}`)}
                />
              )}

              {content && (
                <>
                  <Markdown onCitation={openCitation} citations={citations} citationIndex={citationIndex}>{content}</Markdown>
                  {streaming && <span className="caret" aria-hidden="true" />}
                </>
              )}

              {/* Only until the agent says what it is doing — after that the
                  timeline is the better answer to "is anything happening". */}
              {streaming && !content && steps.length === 0 && <TypingDots />}
              <AnswerSources citations={citations} chunks={inspectorChunks} count={message.retrievedChunkCount} final={selectedEvidence.length === 0 && steps.some((step) => step.kind === 'generation_context')} onOpen={openSource} selected={selectedEvidence} onSelect={selectEvidence} referenceStatus={referenceStatus} />
              <AnswerUsage usage={usage} stepCosts={messageStepCosts(message)} historical={!streaming} />
            </>
          )}
        </div>

        {(interrupted || stopped) && (
          <p className="mt-1 px-1 text-[11px] text-muted">
            {stopped ? MESSAGES.STOPPED : notice}
          </p>
        )}

        {retryable && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-1.5 rounded-(--radius-sm) border border-border-2 bg-surface px-2.5 py-1 text-[12px] font-medium text-ink-2 transition-colors hover:bg-surface-2"
          >
            <RotateCw className="h-3 w-3" />
            Try again
          </button>
        )}

        {message.createdAt && !streaming && (
          <p className="mono mt-1 px-1 text-[11px] text-muted-2">{formatTime(message.createdAt)}</p>
        )}
      </div>
      {citation && <SourceDrawer citation={citation} parent={chunkForCitation(citation, evidence) ?? resolveCitation(citation, sources)} onClose={closeCitation} />}
      {preview && <DocumentPreview file={preview.file} selection={preview.selection} onClose={closePreview} />}
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;
