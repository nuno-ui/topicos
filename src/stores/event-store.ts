import { create } from 'zustand';

interface EventState {
  isOpen: boolean;
  title: string;
  startDate: string;
  endDate: string;
  description: string;
  attendees: string;
  accountId: string | null;
  openEvent: (opts?: Partial<Omit<EventState, 'isOpen' | 'openEvent' | 'closeEvent' | 'reset'>>) => void;
  closeEvent: () => void;
  reset: () => void;
}

const initialState = {
  isOpen: false,
  title: '',
  startDate: '',
  endDate: '',
  description: '',
  attendees: '',
  accountId: null as string | null,
};

export const useEventStore = create<EventState>((set) => ({
  ...initialState,
  openEvent: (opts) => set({ ...initialState, isOpen: true, ...opts }),
  closeEvent: () => set({ isOpen: false }),
  reset: () => set(initialState),
}));
