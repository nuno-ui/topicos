import { create } from 'zustand';

interface ComposeState {
  isOpen: boolean;
  to: string;
  cc: string;
  subject: string;
  body: string;
  topicId: string | null;
  inReplyTo: string | null;
  accountId: string | null;
  openCompose: (opts?: Partial<Omit<ComposeState, 'isOpen' | 'openCompose' | 'closeCompose' | 'reset'>>) => void;
  closeCompose: () => void;
  reset: () => void;
}

const initialState = {
  isOpen: false,
  to: '',
  cc: '',
  subject: '',
  body: '',
  topicId: null as string | null,
  inReplyTo: null as string | null,
  accountId: null as string | null,
};

export const useComposeStore = create<ComposeState>((set) => ({
  ...initialState,
  openCompose: (opts) => set({ ...initialState, isOpen: true, ...opts }),
  closeCompose: () => set({ isOpen: false }),
  reset: () => set(initialState),
}));
