import createAppThunk from '../createAppThunk';
import pipelineService from '../../services/pipelineService';

export const fetchPipeline = createAppThunk('pipeline/fetch', (_arg, { signal }) =>
  pipelineService.getPipeline(signal)
);
