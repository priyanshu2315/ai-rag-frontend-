import { originLabel } from '../../utils/crag';

import { originIcon, originStyle, originTooltip } from '../../utils/retrievalOrigin';

const RetrievalOrigin = ({ origin }) => <span title={originTooltip(origin) ?? originLabel(origin)} className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${originStyle(origin)}`}>
  {originIcon(origin)} {origin?.type === 'search' ? 'Direct Search Hit' : originLabel(origin)}
</span>;

export default RetrievalOrigin;
