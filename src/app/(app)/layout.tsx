import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/sidebar';
import { CommandPalette } from '@/components/ui/command-palette';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="flex min-h-dvh bg-gray-50">
      <Sidebar user={user} />
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
      <CommandPalette />
    </div>
  );
}
