import architectureHtml from '../../constants/architecture.html?raw';
import usePageTitle from '../../hooks/usePageTitle';

const Architecture = () => {
  usePageTitle('Architecture');

  return (
    <iframe
      title="Batman architecture map"
      srcDoc={architectureHtml}
      sandbox=""
      className="block h-dvh w-full border-0"
    />
  );
};

export default Architecture;
