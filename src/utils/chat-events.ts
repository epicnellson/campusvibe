type EventCallback = (...args: any[]) => void;

const listeners = new Map<string, Set<EventCallback>>();

export function emit(event: string, ...args: any[]) {
  listeners.get(event)?.forEach((cb) => cb(...args));
}

export function on(event: string, cb: EventCallback) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(cb);
  return () => listeners.get(event)?.delete(cb);
}
