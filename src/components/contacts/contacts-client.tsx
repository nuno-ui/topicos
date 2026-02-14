'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Contact, Area } from '@/types/database';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useComposeStore } from '@/stores/compose-store';
import {
  Users,
  Search,
  Mail,
  Building2,
  Briefcase,
  Clock,
  Hash,
  Sparkles,
  Loader2,
  User,
  Globe,
  MailPlus,
  X,
} from 'lucide-react';
import Link from 'next/link';

const AREA_COLORS: Record<string, string> = {
  personal: 'bg-[#8b5cf6]/10 text-[#8b5cf6] border-[#8b5cf6]/20',
  career: 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20',
  work: 'bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20',
};

type AreaFilter = 'all' | Area;

interface ContactsClientProps {
  contacts: Contact[];
  contactTopicsMap: Record<string, { id: string; title: string; area: string }[]>;
}

export function ContactsClient({ contacts: initialContacts, contactTopicsMap }: ContactsClientProps) {
  const [contacts] = useState(initialContacts);
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState<AreaFilter>('all');
  const [extracting, setExtracting] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const router = useRouter();
  const openCompose = useComposeStore((s) => s.openCompose);

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (areaFilter !== 'all' && c.area !== areaFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !(c.name?.toLowerCase().includes(q) ?? false) &&
          !c.email.toLowerCase().includes(q) &&
          !(c.organization?.toLowerCase().includes(q) ?? false)
        ) return false;
      }
      return true;
    });
  }, [contacts, search, areaFilter]);

  // Group by area
  const grouped = useMemo(() => {
    const groups: Record<string, Contact[]> = { work: [], career: [], personal: [], unassigned: [] };
    for (const c of filtered) {
      const area = c.area ?? 'unassigned';
      if (!groups[area]) groups[area] = [];
      groups[area].push(c);
    }
    return groups;
  }, [filtered]);

  const handleExtractContacts = async () => {
    setExtracting(true);
    try {
      const res = await fetch('/api/agents/contacts', { method: 'POST' });
      if (res.ok) {
        toast.success('Contact extraction completed');
        router.refresh();
      } else {
        toast.error('Contact extraction failed');
      }
    } catch {
      toast.error('Network error during extraction');
    } finally {
      setExtracting(false);
    }
  };

  const formatLastInteraction = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''} extracted from your communications
          </p>
        </div>
        <button
          onClick={handleExtractContacts}
          disabled={extracting}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {extracting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Extracting...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              AI Extract Contacts
            </>
          )}
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search contacts by name, email, or organization..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'work', 'career', 'personal'] as AreaFilter[]).map((area) => (
            <button
              key={area}
              onClick={() => setAreaFilter(area)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                areaFilter === area
                  ? area === 'all'
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : AREA_COLORS[area]
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {area}
            </button>
          ))}
        </div>
      </div>

      {/* Contacts grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16 text-center">
          <Users className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium text-foreground">No contacts found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {contacts.length === 0
              ? 'Click "AI Extract Contacts" to discover contacts from your emails.'
              : 'Try adjusting your search or filters.'}
          </p>
        </div>
      ) : (
        Object.entries(grouped)
          .filter(([, contacts]) => contacts.length > 0)
          .map(([area, areaContacts]) => (
            <div key={area} className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {area === 'work' && <Briefcase className="h-4 w-4" />}
                {area === 'career' && <Globe className="h-4 w-4" />}
                {area === 'personal' && <User className="h-4 w-4" />}
                {area === 'unassigned' && <Users className="h-4 w-4" />}
                {area} ({areaContacts.length})
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {areaContacts.map((contact) => {
                  const topics = contactTopicsMap[contact.id] ?? [];
                  return (
                    <div
                      key={contact.id}
                      onClick={() => setSelectedContact(contact)}
                      className="cursor-pointer rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/20"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {contact.name?.[0]?.toUpperCase() ?? contact.email[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground">
                            {contact.name ?? contact.email.split('@')[0]}
                          </p>
                          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <Mail className="h-3 w-3 shrink-0" />
                            {contact.email}
                          </p>
                        </div>
                      </div>

                      {(contact.organization || contact.role) && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          {contact.organization && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {contact.organization}
                            </span>
                          )}
                          {contact.role && (
                            <span className="truncate">· {contact.role}</span>
                          )}
                        </div>
                      )}

                      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          {contact.interaction_count} interactions
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatLastInteraction(contact.last_interaction_at)}
                        </span>
                      </div>

                      {/* Quick email button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openCompose({ to: contact.email });
                        }}
                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                      >
                        <MailPlus className="h-3 w-3" />
                        Send Email
                      </button>

                      {/* Related topics */}
                      {topics.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {topics.slice(0, 3).map((topic) => (
                            <Link
                              key={topic.id}
                              href={`/topics/${topic.id}`}
                              className={cn(
                                'rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize transition-colors hover:opacity-80',
                                AREA_COLORS[topic.area] ?? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                              )}
                            >
                              {topic.title}
                            </Link>
                          ))}
                          {topics.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{topics.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
      )}

      {/* Contact Detail Panel (slide-out) */}
      {selectedContact && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm" onClick={() => setSelectedContact(null)}>
          <div
            className="w-full max-w-md overflow-y-auto bg-card border-l border-border shadow-2xl animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h3 className="text-lg font-semibold text-foreground">Contact Details</h3>
              <button
                onClick={() => setSelectedContact(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-6">
              {/* Profile */}
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {selectedContact.name?.[0]?.toUpperCase() ?? selectedContact.email[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-lg font-medium text-foreground">
                    {selectedContact.name ?? selectedContact.email.split('@')[0]}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedContact.email}</p>
                </div>
              </div>

              {/* Details */}
              {(selectedContact.organization || selectedContact.role) && (
                <div className="rounded-lg border border-border bg-background p-4 space-y-2">
                  {selectedContact.organization && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">{selectedContact.organization}</span>
                    </div>
                  )}
                  {selectedContact.role && (
                    <div className="flex items-center gap-2 text-sm">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">{selectedContact.role}</span>
                    </div>
                  )}
                  {selectedContact.area && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className={cn('rounded-md border px-2 py-0.5 text-xs font-medium capitalize', AREA_COLORS[selectedContact.area] ?? '')}>
                        {selectedContact.area}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Interactions</p>
                  <p className="text-xl font-bold text-foreground">{selectedContact.interaction_count}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Last Seen</p>
                  <p className="text-sm font-medium text-foreground">
                    {formatLastInteraction(selectedContact.last_interaction_at)}
                  </p>
                </div>
              </div>

              {/* Related Topics */}
              {(contactTopicsMap[selectedContact.id] ?? []).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Related Topics</h4>
                  <div className="space-y-1.5">
                    {(contactTopicsMap[selectedContact.id] ?? []).map((topic) => (
                      <Link
                        key={topic.id}
                        href={`/topics/${topic.id}`}
                        className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/30"
                      >
                        <span className={cn('rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize', AREA_COLORS[topic.area] ?? '')}>
                          {topic.area}
                        </span>
                        {topic.title}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <button
                onClick={() => {
                  openCompose({ to: selectedContact.email });
                  setSelectedContact(null);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <MailPlus className="h-4 w-4" />
                Send Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
