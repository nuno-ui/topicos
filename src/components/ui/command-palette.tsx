'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Search, LayoutDashboard, FolderKanban, Users, Settings, Brain,
  Sparkles, RefreshCw, Command, X, Zap, ArrowRight
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'navigation' | 'ai' | 'action';
  shortcut?: string;
  action: () => void;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const commands: CommandItem[] = [
    { id: 'dashboard', label: 'Go to Dashboard', description: 'View overview and stats', icon: LayoutDashboard, category: 'navigation', shortcut: '1', action: () => router.push('/dashboard') },
    { id: 'topics', label: 'Go to Topics', description: 'Manage your topics and folders', icon: FolderKanban, category: 'navigation', shortcut: '2', action: () => router.push('/topics') },
    { id: 'search', label: 'Go to Search', description: 'Search across all sources', icon: Search, category: 'navigation', shortcut: '3', action: () => router.push('/search') },
    { id: 'contacts', label: 'Go to Contacts', description: 'View and manage contacts', icon: Users, category: 'navigation', shortcut: '4', action: () => router.push('/contacts') },
    { id: 'settings', label: 'Go to Settings', description: 'Manage accounts and preferences', icon: Settings, category: 'navigation', shortcut: '5', action: () => router.push('/settings') },
    { id: 'briefing', label: 'Generate Daily Briefing', description: 'AI-powered summary of your day', icon: Brain, category: 'ai', action: () => runAiAgent('daily_briefing') },
    { id: 'suggest', label: 'AI Suggest Topics', description: 'Get AI-generated topic ideas', icon: Sparkles, category: 'ai', action: () => runAiAgent('suggest_topics') },
    { id: 'review', label: 'Weekly Review', description: 'Reflect on your productivity', icon: Zap, category: 'ai', action: () => runAiAgent('weekly_review') },
    { id: 'sync', label: 'Sync All Sources', description: 'Pull latest from Gmail, Slack, etc.', icon: RefreshCw, category: 'action', action: () => runSync() },
  ];

  const filteredCommands = query.trim()
    ? commands.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.description.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  const runAiAgent = async (agent: string) => {
    setOpen(false);
    toast.info(`Running ${agent.replace(/_/g, ' ')}...`);
    try {
      const res = await fetch('/api/ai/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent, context: {} }),
      });
      if (!res.ok) throw new Error('Agent failed');
      toast.success(`${agent.replace(/_/g, ' ')} complete!`);
    } catch {
      toast.error(`${agent.replace(/_/g, ' ')} failed`);
    }
  };

  const runSync = async () => {
    setOpen(false);
    toast.info('Syncing all sources...');
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (!res.ok) throw new Error('Sync failed');
      const data = await res.json();
      toast.success(`Sync complete: ${data.total_new || 0} new items`);
    } catch {
      toast.error('Sync failed');
    }
  };

  const executeCommand = useCallback((cmd: CommandItem) => {
    setOpen(false);
    setQuery('');
    cmd.action();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
        setQuery('');
        setSelectedIndex(0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
      e.preventDefault();
      executeCommand(filteredCommands[selectedIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  if (!open) return null;

  const categories = [
    { key: 'navigation', label: 'Navigation' },
    { key: 'ai', label: 'AI Agents' },
    { key: 'action', label: 'Actions' },
  ];

  let globalIndex = -1;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[20vh]" onClick={() => setOpen(false)}>
      <div className="bg-white rounded-2xl shadow-2xl w-[560px] max-h-[420px] border border-gray-200 overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Command className="w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded border border-gray-200 font-mono">ESC</kbd>
        </div>
        {/* Commands list */}
        <div className="max-h-[340px] overflow-y-auto py-2">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-gray-400">No commands found</p>
            </div>
          ) : (
            categories.map(cat => {
              const catCommands = filteredCommands.filter(c => c.category === cat.key);
              if (catCommands.length === 0) return null;
              return (
                <div key={cat.key}>
                  <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{cat.label}</p>
                  {catCommands.map((cmd) => {
                    globalIndex++;
                    const idx = globalIndex;
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => executeCommand(cmd)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          selectedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <cmd.icon className={`w-4 h-4 flex-shrink-0 ${selectedIndex === idx ? 'text-blue-500' : 'text-gray-400'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{cmd.label}</p>
                          <p className="text-xs text-gray-400">{cmd.description}</p>
                        </div>
                        {cmd.shortcut && (
                          <kbd className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded border border-gray-200 font-mono">{cmd.shortcut}</kbd>
                        )}
                        <ArrowRight className={`w-3 h-3 ${selectedIndex === idx ? 'text-blue-400' : 'text-transparent'}`} />
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-gray-100 rounded border border-gray-200 font-mono">↑↓</kbd> Navigate</span>
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-gray-100 rounded border border-gray-200 font-mono">↵</kbd> Execute</span>
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-gray-100 rounded border border-gray-200 font-mono">esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
