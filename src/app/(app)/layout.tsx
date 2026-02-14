import { Sidebar } from '@/components/layout/sidebar';
import { ToasterProvider } from '@/components/providers/toaster-provider';
import { KeyboardShortcutsProvider } from '@/components/providers/keyboard-shortcuts-provider';
import { ComposeEmailModal } from '@/components/actions/compose-email-modal';
import { CreateEventModal } from '@/components/actions/create-event-modal';
import { FloatingActionButton } from '@/components/ui/floating-action-button';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-6">
          {children}
        </div>
      </main>
      <ToasterProvider />
      <KeyboardShortcutsProvider />
      <ComposeEmailModal />
      <CreateEventModal />
      <FloatingActionButton />
    </div>
  );
}
