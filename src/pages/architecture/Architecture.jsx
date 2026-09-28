import architectureHtml from '../../constants/architecture.html?raw';
import usePageTitle from '../../hooks/usePageTitle';

const Architecture = () => {
  usePageTitle('Architecture');

  return (
    <iframe
      title="DocuMind architecture map"
      srcDoc={architectureHtml}
      sandbox=""
      className="block h-screen w-full border-0"
    />
  );
};

export default Architecture;
