import Topbar from '../../components/layout/Topbar';
import { Link } from 'react-router-dom';
import PipelinePhase from '../../components/about/PipelinePhase';
import TechStack from '../../components/about/TechStack';
import Gaps from '../../components/about/Gaps';
import Glossary from '../../components/about/Glossary';
import usePageTitle from '../../hooks/usePageTitle';
import { PIPELINE } from '../../constants/pipeline';
import { ROUTES } from '../../constants/routes';

/**
 * Thin by design (§2) — the phases live in `constants/pipeline.js` and the
 * timeline row is its own component, so this page is only the frame.
 */
const About = () => {
  usePageTitle('About');

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg">
      <Topbar title="About" />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 pt-5 sm:px-6 sm:pt-6">
          <Link
            to={ROUTES.ARCHITECTURE}
            className="inline-flex h-10 items-center justify-center rounded-(--radius-sm) bg-blue-solid px-4 text-sm font-semibold text-white shadow-(--sh-sm) transition-colors hover:bg-blue-solid-hover"
          >
            View architecture map
          </Link>
        </div>
        <ol className="mx-auto max-w-3xl px-4 pt-7 sm:px-6 sm:pt-8">
          {PIPELINE.map((phase, index) => (
            <PipelinePhase
              key={phase.id}
              phase={phase}
              index={index}
              isLast={index === PIPELINE.length - 1}
            />
          ))}
        </ol>

        <div className="mx-auto max-w-3xl px-4 pb-12 sm:px-6">
          <TechStack />
          <Gaps />
          <Glossary />
        </div>
      </div>
    </div>
  );
};

export default About;
