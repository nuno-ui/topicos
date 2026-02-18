'use client';
import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { ChevronDown, Search, Inbox, Folder, Circle, X } from 'lucide-react';

// --- Types ---

export interface HierarchyPickerItem {
  id: string;
  label: string;
  depth: number;
  icon?: ReactNode;
  badges?: Array<{ text: string; className: string }>;
  description?: string;
}

interface HierarchyPickerProps {
  items: HierarchyPickerItem[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  noneLabel?: string;
  noneIcon?: ReactNode;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
}

// --- Component ---

export function HierarchyPicker({
  items,
  value,
  onChange,
  placeholder = 'Select...',
  noneLabel,
  noneIcon,
  searchPlaceholder = 'Search...',
  className = '',
  disabled = false,
}: HierarchyPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter items by search
  const filtered = search.trim()
    ? items.filter(i =>
        i.label.toLowerCase().includes(search.toLowerCase()) ||
        (i.description && i.description.toLowerCase().includes(search.toLowerCase()))
      )
    : items;

  // Total selectable: noneLabel counts as index 0 if present, then filtered items
  const hasNone = !!noneLabel;
  const totalItems = (hasNone ? 1 : 0) + filtered.length;

  // Get selected label
  const selectedItem = value ? items.find(i => i.id === value) : null;
  const displayLabel = selectedItem ? selectedItem.label : (value === null && noneLabel ? noneLabel : placeholder);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Focus search on open
  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open]);

  // Reset highlight when search changes
  useEffect(() => {
    setHighlightIndex(-1);
  }, [search]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-picker-item]');
    const item = items[highlightIndex] as HTMLElement | undefined;
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  const handleSelect = useCallback((id: string | null) => {
    onChange(id);
    setOpen(false);
    setSearch('');
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex(prev => Math.min(prev + 1, totalItems - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIndex >= 0) {
          if (hasNone && highlightIndex === 0) {
            handleSelect(null);
          } else {
            const idx = hasNone ? highlightIndex - 1 : highlightIndex;
            if (filtered[idx]) handleSelect(filtered[idx].id);
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setSearch('');
        break;
    }
  }, [open, highlightIndex, totalItems, hasNone, filtered, handleSelect]);

  return (
    <div ref={containerRef} className={`relative ${className}`} onKeyDown={handleKeyDown}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => { if (!disabled) setOpen(!open); }}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm transition-all bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed ${
          open ? 'ring-2 ring-blue-500/30 border-blue-300' : ''
        }`}
      >
        <span className={`truncate ${selectedItem || (value === null && noneLabel) ? 'text-gray-900' : 'text-gray-400'}`}>
          {displayLabel}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden animate-fade-in">
          {/* Search */}
          {(items.length > 4 || search) && (
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-7 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 placeholder:text-gray-400"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Item list */}
          <div ref={listRef} className="max-h-[240px] overflow-y-auto p-1.5 space-y-0.5">
            {/* None option */}
            {hasNone && (
              <button
                data-picker-item
                onClick={() => handleSelect(null)}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 transition-all text-sm ${
                  value === null
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : highlightIndex === 0
                    ? 'bg-gray-100 text-gray-700 border border-transparent'
                    : 'hover:bg-gray-50 text-gray-600 border border-transparent'
                }`}
              >
                <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${value === null ? 'bg-blue-100' : 'bg-gray-100'}`}>
                  {noneIcon || <Inbox className="w-3.5 h-3.5" />}
                </div>
                <span className="font-medium">{noneLabel}</span>
                {value === null && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full font-medium ml-auto">Selected</span>
                )}
              </button>
            )}

            {/* Items */}
            {filtered.map((item, i) => {
              const itemIndex = hasNone ? i + 1 : i;
              const isSelected = item.id === value;
              const isHighlighted = highlightIndex === itemIndex;

              return (
                <button
                  key={item.id}
                  data-picker-item
                  onClick={() => handleSelect(item.id)}
                  className={`w-full text-left py-2 rounded-lg flex items-center gap-2.5 transition-all text-sm ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : isHighlighted
                      ? 'bg-gray-100 text-gray-700 border border-transparent'
                      : 'hover:bg-gray-50 text-gray-700 border border-transparent'
                  }`}
                  style={{ paddingLeft: `${12 + item.depth * 20}px`, paddingRight: '12px' }}
                >
                  {/* Depth guide line */}
                  {item.depth > 0 && (
                    <div className="flex items-center absolute" style={{ left: `${6 + (item.depth - 1) * 20}px` }}>
                      <div className="w-2.5 h-px bg-gray-200" />
                    </div>
                  )}

                  {/* Icon */}
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    {item.icon || <Circle className="w-3 h-3" />}
                  </div>

                  {/* Label + description */}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium block truncate">{item.label}</span>
                    {item.description && (
                      <span className="text-[10px] text-gray-400 block truncate">{item.description}</span>
                    )}
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {item.badges?.map((badge, bi) => (
                      <span key={bi} className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${badge.className}`}>
                        {badge.text}
                      </span>
                    ))}
                    {isSelected && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full font-medium">Selected</span>
                    )}
                  </div>
                </button>
              );
            })}

            {/* Empty state */}
            {filtered.length === 0 && (
              <div className="py-4 text-center text-sm text-gray-400">
                {search ? `No results for "${search}"` : 'No options available'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Builder Helpers ---

interface FolderLike {
  id: string;
  name: string;
  parent_id: string | null;
  color?: string | null;
  area?: string | null;
  position?: number;
}

interface TopicLike {
  id: string;
  title: string;
  parent_topic_id: string | null;
  folder_id?: string | null;
  area?: string;
  status?: string;
}

const areaColors: Record<string, string> = {
  work: 'bg-blue-100 text-blue-700',
  personal: 'bg-green-100 text-green-700',
  career: 'bg-purple-100 text-purple-700',
};

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-gray-100 text-gray-600',
  archived: 'bg-amber-100 text-amber-700',
  paused: 'bg-orange-100 text-orange-700',
};

const folderColorMap: Record<string, string> = {
  red: 'text-red-500', blue: 'text-blue-500', green: 'text-green-500',
  purple: 'text-purple-500', amber: 'text-amber-500', gray: 'text-gray-500',
};

const folderAreaColorMap: Record<string, string> = {
  work: 'text-blue-500', personal: 'text-green-500', career: 'text-purple-500',
};

export function buildFolderPickerItems(
  folders: FolderLike[],
  topics?: TopicLike[],
): HierarchyPickerItem[] {
  const result: HierarchyPickerItem[] = [];

  const buildTree = (parentId: string | null, depth: number, pathPrefix: string) => {
    const children = folders
      .filter(f => f.parent_id === parentId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name));

    for (const f of children) {
      const path = pathPrefix ? `${pathPrefix} / ${f.name}` : f.name;
      const topicCount = topics ? topics.filter(t => t.folder_id === f.id).length : undefined;
      const fColor = f.color ? (folderColorMap[f.color] || 'text-amber-500')
        : f.area ? (folderAreaColorMap[f.area] || 'text-amber-500') : 'text-amber-500';

      const badges: HierarchyPickerItem['badges'] = [];
      if (f.area) {
        badges.push({ text: f.area, className: areaColors[f.area] || 'bg-gray-100 text-gray-600' });
      }
      if (topicCount !== undefined && topicCount > 0) {
        badges.push({ text: `${topicCount}`, className: 'bg-gray-100 text-gray-500' });
      }

      result.push({
        id: f.id,
        label: f.name,
        depth,
        description: depth > 0 ? path : undefined,
        icon: <Folder className={`w-3.5 h-3.5 ${fColor}`} />,
        badges,
      });

      buildTree(f.id, depth + 1, path);
    }
  };

  buildTree(null, 0, '');
  return result;
}

export function buildTopicPickerItems(
  topics: TopicLike[],
  excludeId?: string,
): HierarchyPickerItem[] {
  const result: HierarchyPickerItem[] = [];

  // Root topics (no parent)
  const rootTopics = topics.filter(t => !t.parent_topic_id && t.id !== excludeId);

  for (const t of rootTopics) {
    const badges: HierarchyPickerItem['badges'] = [];
    if (t.area) {
      badges.push({ text: t.area, className: areaColors[t.area] || 'bg-gray-100 text-gray-600' });
    }
    if (t.status) {
      badges.push({ text: t.status, className: statusColors[t.status] || 'bg-gray-100 text-gray-600' });
    }

    result.push({
      id: t.id,
      label: t.title,
      depth: 0,
      icon: <Circle className="w-3 h-3 text-gray-400" />,
      badges,
    });

    // Level-1 children of this root topic
    const children = topics.filter(c => c.parent_topic_id === t.id && c.id !== excludeId);
    for (const c of children) {
      const childBadges: HierarchyPickerItem['badges'] = [];
      if (c.area) {
        childBadges.push({ text: c.area, className: areaColors[c.area] || 'bg-gray-100 text-gray-600' });
      }
      if (c.status) {
        childBadges.push({ text: c.status, className: statusColors[c.status] || 'bg-gray-100 text-gray-600' });
      }

      result.push({
        id: c.id,
        label: c.title,
        depth: 1,
        description: `${t.title} / ${c.title}`,
        icon: <Circle className="w-2.5 h-2.5 text-gray-300" />,
        badges: childBadges,
      });
    }
  }

  return result;
}
