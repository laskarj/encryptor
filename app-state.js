const state = {
  status: { tone: 'info', message: 'Ready to encrypt or decrypt.' },
  busy: false,
  mode: 'encrypt',
};

const subscribers = new Set();

export function subscribe(callback) {
  subscribers.add(callback);
  callback(state);
  return () => subscribers.delete(callback);
}

export function setState(partial) {
  Object.assign(state, partial);
  subscribers.forEach((cb) => cb(state));
}

export function setStatus(status) {
  setState({ status });
}

export function setMode(mode) {
  setState({ mode });
}

export function getState() {
  return state;
}
