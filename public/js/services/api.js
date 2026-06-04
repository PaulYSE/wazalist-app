import { state } from '../state/state.js';

export const api = async (path, method = 'GET', body = null) => {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}),
    },
  };
  if (body) opts.body = JSON.stringify(body);
  return (await fetch(path, opts)).json();
};