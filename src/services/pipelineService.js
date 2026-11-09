import { getAPI } from './api';

const pipelineService = {
  /** Public — the shared client attaches a token when there is one, and the endpoint ignores it. */
  getPipeline: (signal) => getAPI('/pipeline', { signal }),
};

export default pipelineService;
