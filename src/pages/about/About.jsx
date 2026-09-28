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
    <div className="flex h-screen flex-col overflow-hidden bg-bg">
      <Topbar title="About" />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 pt-6">
          <Link to={ROUTES.ARCHITECTURE} className="text-sm font-semibold text-blue hover:underline">
            View architecture map
          </Link>
        </div>
        <ol className="mx-auto max-w-3xl px-6 pt-8">
          {PIPELINE.map((phase, index) => (
            <PipelinePhase
              key={phase.id}
              phase={phase}
              index={index}
              isLast={index === PIPELINE.length - 1}
            />
          ))}
        </ol>

        <div className="mx-auto max-w-3xl px-6 pb-12">
          <TechStack />
          <Gaps />
          <Glossary />
        </div>
      </div>
    </div>
  );
};

export default About;
