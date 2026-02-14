'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FolderOpen,
  Mail,
  Calendar,
  FileText,
  MessageSquare,
  StickyNote,
  Settings,
  LogOut,
  Zap,
  Users,
  Bot,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const mainNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/topics', label: 'Topics', icon: FolderOpen },
];

const sourceNavItems = [
  { href: '/emails', label: 'Emails', icon: Mail },
  { href: '/events', label: 'Events', icon: Calendar },
  { href: '/files', label: 'Files', icon: FileText },
  { href: '/chats', label: 'Chats', icon: MessageSquare },
  { href: '/notes', label: 'Notes', icon: StickyNote },
];

const bottomNavItems = [
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const renderNavItem = (item: { href: string; label: string; icon: React.ElementType }) => {
    const isActive = pathname.startsWith(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        )}
      >
        <item.icon className="h-4 w-4" />
        {item.label}
      </Link>
    );
  };

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 px-6 py-5">
        <Zap className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold tracking-tight">
          Topic<span className="text-primary">OS</span>
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {mainNavItems.map(renderNavItem)}

        {/* Sources section divider */}
        <div className="pt-4 pb-1">
          <span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Sources
          </span>
        </div>
        {sourceNavItems.map(renderNavItem)}

        {/* Tools section divider */}
        <div className="pt-4 pb-1">
          <span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Tools
          </span>
        </div>
        {bottomNavItems.map(renderNavItem)}
      </nav>

      <div className="border-t border-border p-3">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
