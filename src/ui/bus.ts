import type { Angle } from '../engine';
import type { HistoryEntry, TabName } from './state';

/** Événements partagés entre modules, pour éviter les dépendances croisées. */
export interface BusEvents {
  angle: Angle;
  tabShown: TabName;
  reuse: HistoryEntry;
  memories: void;
  themeApplied: void;
}

type Handler<T> = (payload: T) => void;
const handlers = new Map<keyof BusEvents, Array<Handler<unknown>>>();

export function on<K extends keyof BusEvents>(event: K, fn: Handler<BusEvents[K]>): void {
  const list = handlers.get(event) ?? [];
  list.push(fn as Handler<unknown>);
  handlers.set(event, list);
}

export function emit<K extends keyof BusEvents>(event: K, ...payload: BusEvents[K] extends void ? [] : [BusEvents[K]]): void {
  for (const fn of handlers.get(event) ?? []) fn(payload[0]);
}
