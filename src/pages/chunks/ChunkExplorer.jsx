import { ArrowLeft, Layers } from 'lucide-react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import Topbar from '../../components/layout/Topbar';
import Button from '../../components/buttons/Button';
import ParentChunkRow from '../../components/chunks/ParentChunkRow';
import EmptyState from '../../components/feedback/EmptyState';
import ErrorState from '../../components/feedback/ErrorState';
import Skeleton from '../../components/feedback/Skeleton';
import useDocumentChunks from '../../hooks/useDocumentChunks';
import usePageTitle from '../../hooks/usePageTitle';
import { MESSAGES } from '../../constants/messages';
import { documentPath } from '../../constants/routes';

/**
 * Thin by design (§2) — `useDocumentChunks` owns the two requests and the
 * expansion state, and the row owns its own presentation.
 */
const ChunkExplorer = () => {
  usePageTitle('Chunks');

  const { documentId } = useParams();
  const { activeDocument } = useOutletContext();
  const navigate = useNavigate();

  const { parents, loading, error, children, expanded, toggle, retryChildren, reload } =
    useDocumentChunks(documentId);

  const filename = activeDocument?.filename ?? 'this document';

  return (
    <>
      <Topbar
        title="Chunks"
        subtitle={`How ${filename} was split for retrieval`}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(documentPath(documentId))}
            title="Back to chat"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to chat</span>
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-6">
          <div className="mb-4">
            <h3 className="font-display text-[15px] font-semibold text-ink">
              Parent chunks
              {parents.length > 0 && (
                <span className="ml-2 text-[13px] font-normal text-muted">{parents.length}</span>
              )}
            </h3>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
              A parent is the passage the model reads. Expand one to see the sentence-level children
              that are embedded and matched against your question.
            </p>
          </div>

          {loading && parents.length === 0 && (
            <div className="space-y-2">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          )}

          {error && parents.length === 0 && <ErrorState message={error} onRetry={reload} />}

          {!loading && !error && parents.length === 0 && (
            <EmptyState
              icon={Layers}
              title={MESSAGES.NO_PARENT_CHUNKS}
              description="Once processing finishes, every passage the assistant can quote from will be listed here."
            />
          )}

          {parents.length > 0 && (
            <ol className="space-y-2">
              {parents.map((chunk, index) => (
                <ParentChunkRow
                  key={chunk.id}
                  chunk={chunk}
                  index={index}
                  open={expanded.has(chunk.id)}
                  entry={children[chunk.id]}
                  onToggle={toggle}
                  onRetry={retryChildren}
                />
              ))}
            </ol>
          )}
        </div>
      </div>
    </>
  );
};

export default ChunkExplorer;
