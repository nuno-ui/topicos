'use client';

import { useEffect } from 'react';
import { useComposeStore } from '@/stores/compose-store';
import { useEventStore } from '@/stores/event-store';

export function useKeyboardShortcuts() {
  const openCompose = useComposeStore((s) => s.openCompose);
  const isComposeOpen = useComposeStore((s) => s.isOpen);
  const openEvent = useEventStore((s) => s.openEvent);
  const isEventOpen = useEventStore((s) => s.isOpen);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      // Don't trigger when modals are open
      if (isComposeOpen || isEventOpen) return;

      switch (e.key.toLowerCase()) {
        case 'c':
          e.preventDefault();
          openCompose();
          break;
        case 'e':
          e.preventDefault();
          openEvent();
          break;
        case '/':
          e.preventDefault();
          // Focus the first search input on the page
          const searchInput = document.querySelector<HTMLInputElement>(
            'input[placeholder*="Search"]'
          );
          if (searchInput) {
            searchInput.focus();
          }
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openCompose, openEvent, isComposeOpen, isEventOpen]);
}
