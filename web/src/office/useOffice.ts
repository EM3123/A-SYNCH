// React binding for the office store.
import { useSyncExternalStore } from 'react';
import type { OfficeController } from './controller';
import { initialState } from './store';

const empty = initialState();

export function useOffice(controller: OfficeController | null) {
  return useSyncExternalStore(
    controller ? controller.store.subscribe : () => () => {},
    controller ? controller.store.getState : () => empty,
    () => empty,
  );
}
