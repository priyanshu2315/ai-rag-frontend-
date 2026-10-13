import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, TextLayer } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { pdfPageUrl } from '../../utils/chatSources';
import { findPdfPassageRanges, isCitationPage, textRunHighlights } from '../../utils/pdfPassage';
import Spinner from '../feedback/Spinner';
import './pdfCitation.css';

GlobalWorkerOptions.workerSrc = workerUrl;

const PdfCitationPreview = ({ url, selection }) => {
  const container = useRef(null);
  const scrollArea = useRef(null);
  const canvas = useRef(null);
  const layer = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [pageNumber, setPageNumber] = useState(selection.pageNumber ?? 1);
  const [width, setWidth] = useState(700);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [matched, setMatched] = useState(false);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(Math.max(240, Math.floor(entry.contentRect.width)));
    });
    observer.observe(scrollArea.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    setPdf(null);
    setError(null);
    setStatus('loading');
    const task = getDocument({ url, isEvalSupported: false });
    task.promise.then((documentPdf) => {
      if (!active) return;
      const requested = Number.isInteger(selection.pageNumber) && selection.pageNumber > 0 ? selection.pageNumber : 1;
      if (requested > documentPdf.numPages) throw new Error('The cited page is outside this PDF.');
      setPageNumber(requested);
      setPdf(documentPdf);
    }).catch((failure) => {
      if (active) { setError(failure.message); setStatus('error'); }
    });
    return () => { active = false; task.destroy().catch(() => {}); };
  }, [url, selection.pageNumber]);

  useEffect(() => {
    if (!pdf) return undefined;
    let active = true;
    let renderTask;
    let textLayer;
    setStatus('loading');
    setMatched(false);
    setError(null);
    const render = async () => {
      const page = await pdf.getPage(pageNumber);
      if (!active) return;
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(width / base.width, 1.8) });
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 3);
      const element = canvas.current;
      element.width = Math.floor(viewport.width * pixelRatio);
      element.height = Math.floor(viewport.height * pixelRatio);
      element.style.width = `${viewport.width}px`;
      element.style.height = `${viewport.height}px`;
      layer.current.parentElement.style.width = `${viewport.width}px`;
      layer.current.parentElement.style.height = `${viewport.height}px`;
      layer.current.parentElement.style.setProperty('--total-scale-factor', String(viewport.scale));
      layer.current.replaceChildren();
      renderTask = page.render({ canvasContext: element.getContext('2d'), viewport,
        transform: pixelRatio === 1 ? null : [pixelRatio, 0, 0, pixelRatio, 0, 0] });
      await renderTask.promise;
      const textContent = await page.getTextContent();
      if (!active) return;
      textLayer = new TextLayer({ textContentSource: textContent, container: layer.current, viewport });
      await textLayer.render();
      if (!active) return;
      // Backend offsets are retained in the selection; PDF positions require verified text matching.
      const strings = textLayer.textContentItemsStr;
      const items = textContent.items.filter((item) => typeof item.str === 'string');
      const pageText = strings.map((text, index) => text + (items[index]?.hasEOL ? '\n' : ' ')).join('');
      const ranges = isCitationPage(selection, pageNumber) ? findPdfPassageRanges(pageText, selection) : [];
      const highlights = textRunHighlights(strings, ranges);
      textLayer.textDivs.forEach((elementText, index) => {
        const parts = highlights[index];
        if (!parts?.length) return;
        const text = strings[index];
        const content = document.createDocumentFragment();
        let cursor = 0;
        for (const part of parts) {
          content.append(document.createTextNode(text.slice(cursor, part.start)));
          const highlight = document.createElement('mark');
          highlight.className = 'citation-highlight';
          highlight.textContent = text.slice(part.start, part.end);
          content.append(highlight);
          cursor = part.end;
        }
        content.append(document.createTextNode(text.slice(cursor)));
        elementText.replaceChildren(content);
      });
      setMatched(ranges.length > 0);
      setStatus('ready');
      layer.current.querySelector('mark')?.scrollIntoView({ block: 'center', inline: 'nearest' });
    };
    render().catch((failure) => {
      if (!active || failure.name === 'RenderingCancelledException') return;
      setError(failure.message);
      setStatus('error');
    });
    return () => { active = false; renderTask?.cancel(); textLayer?.cancel(); };
  }, [pdf, pageNumber, width, selection]);

  return <div ref={container} className="flex h-full min-h-0 flex-col">
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2 text-[12px] text-muted">
      <span>Page {pageNumber}{pdf ? ` of ${pdf.numPages}` : ''}</span>
      <div className="flex gap-3">
        <button type="button" disabled={!pdf || pageNumber <= 1} onClick={() => setPageNumber((page) => page - 1)} className="text-blue disabled:text-muted-2">Previous</button>
        <button type="button" disabled={!pdf || pageNumber >= pdf.numPages} onClick={() => setPageNumber((page) => page + 1)} className="text-blue disabled:text-muted-2">Next</button>
        {pageNumber !== (selection.pageNumber ?? 1) && <button type="button" onClick={() => setPageNumber(selection.pageNumber ?? 1)} className="text-blue">Cited page</button>}
      </div>
    </div>
    {status === 'loading' && <p role="status" className="flex items-center justify-center gap-2 p-3 text-sm text-muted"><Spinner />Loading PDF page…</p>}
    {status === 'ready' && matched && <p role="status" className="px-3 py-1 text-[12px] text-muted">Matching source text is highlighted on this page.</p>}
    {status === 'ready' && !matched && Boolean(selection.text || selection.snippet) && isCitationPage(selection, pageNumber) && <p role="status" className="px-3 py-2 text-[12px] text-muted">No matching text was found on this page. Open Source text to inspect the supplied passage. Scanned pages need a searchable text layer for highlighting.</p>}
    {error && <div role="alert" className="p-3 text-sm text-muted"><p>PDF preview unavailable: {error}</p>
      <a href={pdfPageUrl(url, selection.pageNumber)} target="_blank" rel="noopener noreferrer" className="text-blue underline">Open the cited page in a new tab</a>
      <iframe src={pdfPageUrl(url, selection.pageNumber)} title="Cited PDF page" className="mt-3 h-[55vh] w-full border-0" />
    </div>}
    <div ref={scrollArea} className={`min-h-0 flex-1 overflow-auto p-4 ${error ? 'hidden' : ''}`}>
      <div className="citation-pdf-page relative mx-auto bg-white shadow-sm">
        <canvas ref={canvas} aria-label={`PDF page ${pageNumber}`} />
        <div ref={layer} className="citation-pdf-text-layer" />
      </div>
    </div>
  </div>;
};

export default PdfCitationPreview;
