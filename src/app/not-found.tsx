import Link from 'next/link';
import { Home, Search, FolderKanban, Users, Settings, ArrowRight } from 'lucide-react';

const quickLinks = [
  { href: '/dashboard', label: 'Dashboard', desc: 'View your overview and stats', icon: Home, color: 'bg-blue-50 text-blue-600 border-blue-100' },
  { href: '/topics', label: 'Topics', desc: 'Manage your projects and topics', icon: FolderKanban, color: 'bg-purple-50 text-purple-600 border-purple-100' },
  { href: '/search', label: 'Search', desc: 'Find anything across all sources', icon: Search, color: 'bg-amber-50 text-amber-600 border-amber-100' },
  { href: '/contacts', label: 'Contacts', desc: 'Browse your contact network', icon: Users, color: 'bg-teal-50 text-teal-600 border-teal-100' },
  { href: '/settings', label: 'Settings', desc: 'Manage accounts and preferences', icon: Settings, color: 'bg-gray-50 text-gray-600 border-gray-200' },
];

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6">
      {/* Brand logo */}
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 brand-gradient rounded-xl flex items-center justify-center shadow-sm">
          <span className="text-white font-bold text-lg">Y</span>
        </div>
        <span className="text-xl font-extrabold brand-gradient-text tracking-tight">YouOS</span>
      </div>

      {/* Large 404 with gradient */}
      <h1 className="text-8xl sm:text-[10rem] md:text-[12rem] font-black leading-none brand-gradient-text select-none tracking-tighter">
        404
      </h1>

      {/* Message */}
      <div className="text-center max-w-lg -mt-2 sm:-mt-4 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Page not found
        </h2>
        <p className="text-gray-500 text-sm leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
          Try one of the links below to get back on track.
        </p>
      </div>

      {/* Quick navigation cards */}
      <div className="w-full max-w-lg space-y-2 mb-8">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex items-center gap-4 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 transition-all"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${link.color}`}>
              <link.icon className="w-4.5 h-4.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{link.label}</p>
              <p className="text-xs text-gray-400">{link.desc}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </Link>
        ))}
      </div>

      {/* Keyboard shortcut hint */}
      <p className="text-xs text-gray-400">
        Tip: Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono border border-gray-200">Ctrl+K</kbd> to open the command palette
      </p>

      {/* Decorative gradient orbs */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-purple-500/5 blur-3xl" />
        <div className="absolute top-1/3 left-1/4 w-64 h-64 rounded-full bg-amber-500/3 blur-3xl" />
      </div>
    </div>
  );
}
