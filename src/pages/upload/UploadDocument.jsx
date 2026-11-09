import { Link, useOutletContext } from 'react-router-dom';
import { Info } from 'lucide-react';
import PageHead from '../../components/layout/PageHead';
import DocumentDropzone from '../../components/documents/DocumentDropzone';
import usePageTitle from '../../hooks/usePageTitle';
import { ROUTES } from '../../constants/routes';

/**
 * Admin module: add a document to the library. A successful upload lands on
 * the new document's page, where its processing progress streams live.
 */
const UploadDocument = () => {
  usePageTitle('Upload document');
  const { upload, uploading } = useOutletContext();

  return (
    <>
      <PageHead title="Upload document" subtitle="Add a file to the shared library" />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6 sm:px-6">
          <section className="overflow-hidden rounded-(--radius-lg) border border-border bg-surface">
            <h2 className="border-b border-border bg-surface-2 px-4 py-2.5 text-[13.5px] font-semibold">New document</h2>
            <div className="p-4">
              <DocumentDropzone onUpload={upload} uploading={uploading} />
            </div>
          </section>

          <div className="flex gap-2.5 rounded-(--radius) border border-border bg-surface-2 px-4 py-3 text-[13px] text-ink-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue" />
            <p>
              A new document is visible to admins straight away. Users see it only once it is added to one of
              their roles. Every upload is listed in the{' '}
              <Link to={ROUTES.KNOWLEDGE_BASE} className="font-medium text-blue hover:underline">Knowledge base</Link>.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default UploadDocument;
