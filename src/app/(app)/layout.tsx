import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/sidebar';
import { CommandPalette } from '@/components/ui/command-palette';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="flex flex-col min-h-dvh bg-gray-50">
      {/* Brand gradient top border */}
      <div className="h-[2px] brand-gradient flex-shrink-0" />
      <div className="flex flex-1 min-h-0">
        <Sidebar user={user} />
        <main className="flex-1 min-w-0 overflow-auto" aria-label="Main content">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
