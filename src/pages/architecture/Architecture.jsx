import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import usePageTitle from '../../hooks/usePageTitle';
import { API_BASE_URL } from '../../constants/env';
import { ROUTES } from '../../constants/routes';

/**
 * The backend serves the diagram (`GET /architecture`, public): its file is
 * the only copy and changes with the pipeline, so nothing of it lives here.
 * `API_BASE_URL` already ends in `/api`.
 */
const ARCHITECTURE_URL = `${API_BASE_URL}/architecture`;

/** The diagram page's own background, so the frame edges never show. */
const DIAGRAM_BG = 'bg-[#0a0c11]';

const Architecture = () => {
  usePageTitle('Architecture');
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={`flex min-h-dvh flex-col ${DIAGRAM_BG} text-[#c3cad6]`}>
      <div className="mx-auto flex w-full max-w-[1672px] items-center justify-between gap-3 px-4 pt-3 text-[13px]">
        <Link to={ROUTES.ABOUT} className="inline-flex items-center gap-1.5 hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> About
        </Link>
        <a href={ARCHITECTURE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-white">
          Open in a new tab <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>

      <div className="relative mx-auto w-full max-w-[1672px]">
        {!loaded && (
          <p role="status" className="absolute inset-x-0 top-24 flex items-center justify-center gap-2 text-[13px]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading the architecture…
          </p>
        )}
        {/* No scripts are needed or allowed in the frame. On narrow screens
            the diagram keeps its minimum width and scrolls sideways inside
            the frame, so the frame keeps enough height to show it whole. */}
        <iframe
          src={ARCHITECTURE_URL}
          title="Architecture"
          sandbox=""
          onLoad={() => setLoaded(true)}
          className="block min-h-[900px] w-full border-0"
          style={{ aspectRatio: '1600 / 1240' }}
        />
      </div>
    </div>
  );
};

export default Architecture;
