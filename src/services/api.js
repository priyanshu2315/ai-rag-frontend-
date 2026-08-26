import client from '../redux/axiosClient';

/**
 * Reusable request methods (§11.1).
 *
 * Services call these — never `client.get/post/...` directly — so multipart,
 * blobs, and abort signals are configured in exactly one place.
 * Each returns the already-unwrapped payload.
 */
export const getAPI = (url, { params, signal, ...rest } = {}) =>
  client.get(url, { params, signal, ...rest });

export const postAPI = (url, data, config = {}) => client.post(url, data, config);

export const putAPI = (url, data, config = {}) => client.put(url, data, config);

export const patchAPI = (url, data, config = {}) => client.patch(url, data, config);

export const deleteAPI = (url, config = {}) => client.delete(url, config);

/** multipart/form-data — lets the browser set the boundary itself. */
export const uploadAPI = (url, formData, { signal, onUploadProgress, ...rest } = {}) =>
  client.post(url, formData, { signal, onUploadProgress, ...rest });

export const downloadAPI = (url, { params, signal } = {}) =>
  client.get(url, { params, signal, responseType: 'blob' });
