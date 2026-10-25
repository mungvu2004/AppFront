import { useSyncExternalStore } from 'react';

/** Khe cổng trong thanh bước + số màn đang giữ cổng (xem FlowGate.tsx). */
interface GateState {
  readonly slot: HTMLElement | null;
  readonly owners: number;
}

let state: GateState = { slot: null, owners: 0 };
const listeners = new Set<() => void>();

function update(next: Partial<GateState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

export const flowGateStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getState: (): GateState => state,
  addOwner(delta: number) {
    update({ owners: state.owners + delta });
  },
};

/** Thanh bước gọi: có màn nào đang giữ cổng không (thì ẩn nút "Tiếp" mặc định). */
export function useFlowGateOwned(): boolean {
  return useSyncExternalStore(flowGateStore.subscribe, flowGateStore.getState).owners > 0;
}

/** Ref của khe cổng trong thanh bước. */
export function setFlowGateSlot(element: HTMLElement | null) {
  if (state.slot !== element) update({ slot: element });
}
