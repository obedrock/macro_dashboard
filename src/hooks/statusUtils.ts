import { WidgetStatus, ResultWarning } from '../types';

export const loadingStatus: WidgetStatus = { state: 'loading' };
export const loadedStatus: WidgetStatus = { state: 'loaded' };
export function errorStatus(msg: string): WidgetStatus {
  return { state: 'error', error: msg };
}
export function warnedStatus(warnings: ResultWarning[]): WidgetStatus {
  return { state: 'loaded', error: warnings.map(w => w.message).join('; ') };
}
