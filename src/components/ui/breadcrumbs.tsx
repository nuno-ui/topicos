'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { useMemo } from 'react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  /** Override the current page label (useful for dynamic pages) */
  currentLabel?: string;
}

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  topics: 'Topics',
  contacts: 'Contacts',
  search: 'Search',
  settings: 'Settings',
};

export function Breadcrumbs({ items, currentLabel }: BreadcrumbsProps) {
  const pathname = usePathname();

  const breadcrumbs = useMemo(() => {
    if (items) return items;

    const segments = pathname.split('/').filter(Boolean);
    const crumbs: BreadcrumbItem[] = [];

    let currentPath = '';
    for (let i = 0; i < segments.length; i++) {
      currentPath += `/${segments[i]}`;
      const isLast = i === segments.length - 1;
      const label = isLast && currentLabel
        ? currentLabel
        : ROUTE_LABELS[segments[i]] || decodeURIComponent(segments[i]);

      crumbs.push({
        label,
        href: isLast ? undefined : currentPath,
      });
    }

    return crumbs;
  }, [pathname, items, currentLabel]);

  if (breadcrumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm mb-4">
      <Link
        href="/dashboard"
        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
        aria-label="Home"
      >
        <Home className="w-3.5 h-3.5" />
      </Link>
      {breadcrumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" aria-hidden="true" />
          {crumb.href ? (
            <Link
              href={crumb.href}
              className="text-gray-500 hover:text-gray-700 transition-colors truncate max-w-[200px] text-xs font-medium"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="text-gray-900 font-semibold truncate max-w-[250px] text-xs" aria-current="page">
              {crumb.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
