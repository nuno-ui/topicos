import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/sidebar';
import { CommandPalette } from '@/components/ui/command-palette';
import { FeedbackButton } from '@/components/feedback/feedback-button';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="flex flex-col min-h-dvh bg-gray-50">
      {/* Skip to content – accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:text-blue-600 focus:rounded-lg focus:shadow-lg focus:text-sm focus:font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        Skip to content
      </a>
      {/* Brand gradient top border */}
      <div className="h-[2px] brand-gradient flex-shrink-0" aria-hidden="true" />
      <div className="flex flex-1 min-h-0">
        <Sidebar user={user} />
        <main id="main-content" className="flex-1 min-w-0 overflow-auto" aria-label="Main content">
          {children}
        </main>
      </div>
      <CommandPalette />
      <FeedbackButton />
    </div>
  );
}
