import PageHead from '../../components/layout/PageHead';
import { Link } from 'react-router-dom';
import EngineeringTimeline from '../../components/about/EngineeringTimeline';
import TechStack from '../../components/about/TechStack';
import Gaps from '../../components/about/Gaps';
import Glossary from '../../components/about/Glossary';
import usePageTitle from '../../hooks/usePageTitle';
import { ROUTES } from '../../constants/routes';

/**
 * Thin by design (§2) — the engineering timeline comes from the backend
 * (`GET /pipeline`) through `EngineeringTimeline`, so this page is only the frame.
 */
const About = () => {
  usePageTitle('About');

  return (
    <>
      <PageHead title="How it works" subtitle="The retrieval pipeline, the stack, and what is still missing" />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 pt-5 sm:px-6 sm:pt-6">
          <Link
            to={ROUTES.ARCHITECTURE}
            className="inline-flex h-10 items-center justify-center rounded-(--radius-sm) bg-blue-solid px-4 text-sm font-semibold text-white shadow-(--sh-sm) transition-colors hover:bg-blue-solid-hover"
          >
            View architecture map
          </Link>
        </div>
        <div className="mx-auto max-w-3xl px-4 pt-7 sm:px-6 sm:pt-8">
          <EngineeringTimeline />
        </div>

        <div className="mx-auto max-w-3xl px-4 pb-12 sm:px-6">
          <TechStack />
          <Gaps />
          <Glossary />
        </div>
      </div>
    </>
  );
};

export default About;
