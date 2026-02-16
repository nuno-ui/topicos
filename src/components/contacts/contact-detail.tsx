'use client';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { formatRelativeDate } from '@/lib/utils';
import { SourceIcon } from '@/components/ui/source-icon';
import {
  ArrowLeft,
  Mail,
  Brain,
  Sparkles,
  Wand2,
  Link as LinkIcon,
  Copy,
  Trash2,
  Edit3,
  Save,
  X,
  Loader2,
  Search,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clock,
  AlertTriangle,
  Phone,
  Globe,
  MapPin,
  StickyNote,
  Check,
  Unlink,
  Building,
  User,
  Activity,
  Target,
  TrendingUp,
  Heart,
  MessageSquare,
  Tag,
} from 'lucide-react';

// ============================
// Types
// ============================

interface ContactTopicLink {
  id?: string;
  topic_id: string;
  role: string | null;
  created_at?: string;
  topics: {
    title: string;
    status?: string;
    due_date?: string | null;
    priority?: number;
    area?: string;
    updated_at?: string;
    tags?: string[];
  } | null;
}

interface ContactData {
  id: string;
  name: string;
  email: string | null;
  organization: string | null;
  role: string | null;
  area: string | null;
  notes: string | null;
  last_interaction_at: string | null;
  interaction_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  contact_topic_links?: ContactTopicLink[];
}

interface ContactDetailProps {
  contact: ContactData;
  relatedItems: Record<string, unknown>[];
  allTopics: Array<{ id: string; title: string; status: string; area: string }>;
}

// ============================
// Helpers
// ============================

const avatarGradients = [
  { bg: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)', text: 'text-white' },
  { bg: 'linear-gradient(135deg, #22c55e 0%, #0ea5e9 100%)', text: 'text-white' },
  { bg: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)', text: 'text-white' },
  { bg: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', text: 'text-white' },
  { bg: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)', text: 'text-white' },
  { bg: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)', text: 'text-white' },
];

const getAvatarGradient = (name: string) => {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return avatarGradients[hash % avatarGradients.length];
};

const avatarColors = [
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
  'bg-cyan-100 text-cyan-700',
];

const getAvatarColor = (name: string) => {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return avatarColors[hash % avatarColors.length];
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const areaColor = (area: string | null) => {
  switch (area) {
    case 'work': return 'bg-blue-100 text-blue-700';
    case 'personal': return 'bg-green-100 text-green-700';
    case 'career': return 'bg-purple-100 text-purple-700';
    default: return 'bg-gray-100 text-gray-500';
  }
};

const statusColor = (status: string | undefined) => {
  switch (status) {
    case 'active': return 'bg-emerald-100 text-emerald-700';
    case 'completed': return 'bg-gray-100 text-gray-600';
    case 'archived': return 'bg-amber-100 text-amber-700';
    default: return 'bg-gray-100 text-gray-500';
  }
};

const getEngagementLevel = (lastInteraction: string | null) => {
  if (!lastInteraction) return { label: 'New', color: 'bg-gray-100 text-gray-600', dotColor: 'bg-gray-400' };
  const days = Math.floor((Date.now() - new Date(lastInteraction).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 7) return { label: 'Active', color: 'bg-green-100 text-green-700', dotColor: 'bg-green-500' };
  if (days <= 30) return { label: 'Recent', color: 'bg-blue-100 text-blue-700', dotColor: 'bg-blue-500' };
  if (days <= 90) return { label: 'Idle', color: 'bg-amber-100 text-amber-700', dotColor: 'bg-amber-500' };
  return { label: 'Cold', color: 'bg-red-100 text-red-700', dotColor: 'bg-red-500' };
};

const getDaysAgo = (dateStr: string | null): number | null => {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
};

const formatShortDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getDateGroup = (dateStr: string): string => {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'This Week';
  if (days < 30) return 'This Month';
  return 'Older';
};

const ROLE_OPTIONS = ['Owner', 'Stakeholder', 'Decision Maker', 'Contributor', 'Reviewer', 'Client', 'Vendor'];

// ============================
// Component
// ============================

export function ContactDetail({ contact: initialContact, relatedItems, allTopics }: ContactDetailProps) {
  const router = useRouter();
  const [contact, setContact] = useState(initialContact);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(contact.name);
  const [editEmail, setEditEmail] = useState(contact.email || '');
  const [editOrganization, setEditOrganization] = useState(contact.organization || '');
  const [editRole, setEditRole] = useState(contact.role || '');
  const [editArea, setEditArea] = useState(contact.area || '');
  const [editNotes, setEditNotes] = useState(contact.notes || '');
  const [editPhone, setEditPhone] = useState((contact.metadata?.phone as string) || '');
  const [editLinkedin, setEditLinkedin] = useState((contact.metadata?.linkedin as string) || '');
  const [editTwitter, setEditTwitter] = useState((contact.metadata?.twitter as string) || '');
  const [editTimezone, setEditTimezone] = useState((contact.metadata?.timezone as string) || '');
  const [saving, setSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Inline notes editing state
  const [editingNotes, setEditingNotes] = useState(false);
  const [inlineNotes, setInlineNotes] = useState(contact.notes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // AI agent state
  const [agentLoading, setAgentLoading] = useState<string | null>(null);
  const [enrichedProfile, setEnrichedProfile] = useState<Record<string, unknown> | null>(null);
  const [showEnriched, setShowEnriched] = useState(false);
  const [emailSuggestion, setEmailSuggestion] = useState<Record<string, unknown> | null>(null);
  const [showEmailSuggestion, setShowEmailSuggestion] = useState(false);
  const [intelligence, setIntelligence] = useState<Record<string, unknown> | null>(null);
  const [showIntelligence, setShowIntelligence] = useState(false);

  // Link topic state
  const [showLinkDropdown, setShowLinkDropdown] = useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [linkRole, setLinkRole] = useState('');
  const [linkingTopic, setLinkingTopic] = useState(false);

  // Role editing state
  const [editingRoleForTopic, setEditingRoleForTopic] = useState<string | null>(null);
  const [roleEditValue, setRoleEditValue] = useState('');
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  // Communication timeline state
  const [timelineDisplayCount, setTimelineDisplayCount] = useState(20);

  // Sections collapse
  const [showPendingTopics, setShowPendingTopics] = useState(true);
  const [showAllTopics, setShowAllTopics] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);

  // ============================
  // Derived data
  // ============================

  const topicLinks = contact.contact_topic_links || [];

  const pendingTopics = useMemo(() => {
    return topicLinks
      .filter(link => link.topics?.status === 'active')
      .sort((a, b) => {
        const aDue = a.topics?.due_date ? new Date(a.topics.due_date) : null;
        const bDue = b.topics?.due_date ? new Date(b.topics.due_date) : null;
        const now = new Date();
        const aOverdue = aDue && aDue < now ? 1 : 0;
        const bOverdue = bDue && bDue < now ? 1 : 0;
        if (aOverdue !== bOverdue) return bOverdue - aOverdue;
        const aPriority = a.topics?.priority ?? 0;
        const bPriority = b.topics?.priority ?? 0;
        if (aPriority !== bPriority) return bPriority - aPriority;
        const aUpdated = a.topics?.updated_at ? new Date(a.topics.updated_at).getTime() : 0;
        const bUpdated = b.topics?.updated_at ? new Date(b.topics.updated_at).getTime() : 0;
        return bUpdated - aUpdated;
      });
  }, [topicLinks]);

  const filteredLinkTopics = useMemo(() => {
    const linkedIds = new Set(topicLinks.map(l => l.topic_id));
    let filtered = allTopics.filter(t => !linkedIds.has(t.id));
    if (linkSearchQuery.trim()) {
      const q = linkSearchQuery.toLowerCase();
      filtered = filtered.filter(t => t.title.toLowerCase().includes(q));
    }
    return filtered;
  }, [allTopics, topicLinks, linkSearchQuery]);

  const groupedTimeline = useMemo(() => {
    const items = relatedItems
      .filter(item => item.occurred_at || item.created_at)
      .sort((a, b) => {
        const aDate = (a.occurred_at || a.created_at) as string;
        const bDate = (b.occurred_at || b.created_at) as string;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });

    const groups: Record<string, Record<string, unknown>[]> = {};
    for (const item of items) {
      const dateStr = (item.occurred_at || item.created_at) as string;
      const group = getDateGroup(dateStr);
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
    }
    return groups;
  }, [relatedItems]);

  const timelineGroupOrder = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];

  const hasExtendedInfo = !!(
    (contact.metadata?.phone) ||
    (contact.metadata?.linkedin) ||
    (contact.metadata?.twitter) ||
    (contact.metadata?.timezone)
  );

  const engagement = getEngagementLevel(contact.last_interaction_at);
  const daysAgo = getDaysAgo(contact.last_interaction_at);

  // ============================
  // Actions
  // ============================

  const copyEmail = async () => {
    if (!contact.email) return;
    try {
      await navigator.clipboard.writeText(contact.email);
      toast.success('Email copied to clipboard');
    } catch {
      toast.error('Failed to copy email');
    }
  };

  const startEdit = () => {
    setEditName(contact.name || '');
    setEditEmail(contact.email || '');
    setEditOrganization(contact.organization || '');
    setEditRole(contact.role || '');
    setEditArea(contact.area || '');
    setEditNotes(contact.notes || '');
    const meta = contact.metadata || {};
    setEditPhone((meta.phone as string) || '');
    setEditLinkedin((meta.linkedin as string) || '');
    setEditTwitter((meta.twitter as string) || '');
    setEditTimezone((meta.timezone as string) || '');
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const saveContact = async () => {
    if (!editName.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      const metadata: Record<string, unknown> = { ...(contact.metadata || {}) };
      if (editPhone.trim()) metadata.phone = editPhone.trim();
      else delete metadata.phone;
      if (editLinkedin.trim()) metadata.linkedin = editLinkedin.trim();
      else delete metadata.linkedin;
      if (editTwitter.trim()) metadata.twitter = editTwitter.trim();
      else delete metadata.twitter;
      if (editTimezone.trim()) metadata.timezone = editTimezone.trim();
      else delete metadata.timezone;

      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim() || null,
          organization: editOrganization.trim() || null,
          role: editRole.trim() || null,
          area: editArea || null,
          notes: editNotes.trim() || null,
          metadata,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Build list of changed fields for the toast
      const changes: string[] = [];
      if (editName.trim() !== contact.name) changes.push('name');
      if ((editEmail.trim() || null) !== contact.email) changes.push('email');
      if ((editOrganization.trim() || null) !== contact.organization) changes.push('organization');
      if ((editRole.trim() || null) !== contact.role) changes.push('role');
      if ((editArea || null) !== contact.area) changes.push('area');
      if ((editNotes.trim() || null) !== contact.notes) changes.push('notes');
      if (editPhone.trim() !== ((contact.metadata?.phone as string) || '')) changes.push('phone');
      if (editLinkedin.trim() !== ((contact.metadata?.linkedin as string) || '')) changes.push('linkedin');
      if (editTwitter.trim() !== ((contact.metadata?.twitter as string) || '')) changes.push('twitter');
      if (editTimezone.trim() !== ((contact.metadata?.timezone as string) || '')) changes.push('timezone');

      setContact(prev => {
        const serverData = data.contact ?? {};
        return {
          ...prev,
          name: serverData.name ?? editName.trim(),
          email: serverData.email ?? (editEmail.trim() || null),
          organization: serverData.organization ?? (editOrganization.trim() || null),
          role: serverData.role ?? (editRole.trim() || null),
          area: serverData.area ?? (editArea || null),
          notes: serverData.notes ?? (editNotes.trim() || null),
          metadata: { ...(serverData.metadata ?? {}), ...metadata },
          updated_at: serverData.updated_at ?? prev.updated_at,
          contact_topic_links: prev.contact_topic_links,
        };
      });
      setEditing(false);
      setLastSavedAt(new Date());
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 1200);
      if (changes.length > 0) {
        toast.success(`Updated ${changes.join(', ')}`);
      } else {
        toast.success('Contact saved (no changes)');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
    setSaving(false);
  };

  const deleteContact = async () => {
    if (!confirm('Delete this contact? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Contact deleted');
      router.push('/contacts');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  // Inline notes save (auto-save on blur)
  const saveNotesInline = useCallback(async () => {
    const trimmed = inlineNotes.trim() || null;
    if (trimmed === contact.notes) {
      setEditingNotes(false);
      return;
    }
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setContact(prev => ({ ...prev, notes: trimmed, ...data.contact, contact_topic_links: prev.contact_topic_links }));
      setLastSavedAt(new Date());
      toast.success('Notes saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save notes');
    }
    setSavingNotes(false);
    setEditingNotes(false);
  }, [inlineNotes, contact.notes, contact.id]);

  // Keyboard shortcut: Enter to save, Escape to cancel in edit mode
  useEffect(() => {
    if (!editing) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        saveContact();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editing, saveContact]);

  // Focus notes textarea when entering inline notes editing
  useEffect(() => {
    if (editingNotes && notesRef.current) {
      notesRef.current.focus();
      // Move cursor to end
      const len = notesRef.current.value.length;
      notesRef.current.setSelectionRange(len, len);
    }
  }, [editingNotes]);

  // AI Agents
  const runAgent = async (agent: string) => {
    setAgentLoading(agent);
    try {
      const res = await fetch('/api/ai/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent, context: { contact_id: contact.id } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      switch (agent) {
        case 'enrich_contact':
          setEnrichedProfile(data.result);
          setShowEnriched(true);
          if (data.result.organization || data.result.role) {
            setContact(prev => ({
              ...prev,
              organization: data.result.organization || prev.organization,
              role: data.result.role || prev.role,
            }));
          }
          toast.success('Contact enriched with AI insights');
          break;
        case 'contact_intelligence':
          setIntelligence(data.result);
          setShowIntelligence(true);
          toast.success('Intelligence report generated');
          break;
        case 'propose_next_email':
          setEmailSuggestion(data.result);
          setShowEmailSuggestion(true);
          toast.success('Email suggestion ready');
          break;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Agent failed');
    }
    setAgentLoading(null);
  };

  // Topic linking
  const linkTopic = async (topicId: string) => {
    setLinkingTopic(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topicId, role: linkRole.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to link topic');
      const linkedTopic = allTopics.find(t => t.id === topicId);
      const newLink: ContactTopicLink = {
        id: data.link?.id,
        topic_id: topicId,
        role: linkRole.trim() || null,
        topics: linkedTopic ? {
          title: linkedTopic.title,
          status: linkedTopic.status,
          area: linkedTopic.area,
        } : null,
      };
      setContact(prev => ({
        ...prev,
        contact_topic_links: [...(prev.contact_topic_links || []), newLink],
      }));
      setLinkRole('');
      setLinkSearchQuery('');
      toast.success('Topic linked');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Link failed');
    }
    setLinkingTopic(false);
  };

  const unlinkTopic = async (topicId: string) => {
    if (!confirm('Unlink this topic from the contact?')) return;
    try {
      const res = await fetch(`/api/contacts/${contact.id}/topics?topic_id=${topicId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to unlink');
      setContact(prev => ({
        ...prev,
        contact_topic_links: (prev.contact_topic_links || []).filter(l => l.topic_id !== topicId),
      }));
      toast.success('Topic unlinked');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unlink failed');
    }
  };

  const updateTopicRole = async (topicId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/contacts/${contact.id}/topics`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topicId, role: newRole.trim() || null }),
      });
      if (!res.ok) throw new Error('Failed to update role');
      setContact(prev => ({
        ...prev,
        contact_topic_links: (prev.contact_topic_links || []).map(l =>
          l.topic_id === topicId ? { ...l, role: newRole.trim() || null } : l
        ),
      }));
      setEditingRoleForTopic(null);
      setShowRoleDropdown(false);
      toast.success('Role updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  // ============================
  // Render
  // ============================

  return (
    <div className="animate-stagger space-y-6 pb-16">
      {/* ============================
          1. Profile Header
          ============================ */}
      <div className={cn(
        'animate-fade-in bg-white rounded-2xl border shadow-sm transition-all duration-500 overflow-hidden',
        saveFlash ? 'border-green-300 ring-2 ring-green-100' : 'border-gray-200/60'
      )}>
        {/* Gradient accent bar at top */}
        <div className="h-1 w-full" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }} />

        <div className="p-6">
          {/* Breadcrumb with gradient accent */}
          <div className="flex items-center gap-2 mb-5">
            <Link
              href="/contacts"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Contacts
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }}>
              {contact.name}
            </span>
          </div>

          {editing ? (
            /* ---- EDIT MODE ---- */
            <div className="space-y-5 mt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Floating label input: Name */}
                <div className="relative">
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="peer w-full px-3.5 pt-5 pb-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-shadow placeholder-transparent"
                    placeholder="Full name"
                    id="edit-name"
                  />
                  <label
                    htmlFor="edit-name"
                    className="absolute left-3.5 top-1.5 text-[10px] font-semibold text-blue-600 flex items-center gap-1 pointer-events-none transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-xs peer-placeholder-shown:text-gray-400 peer-placeholder-shown:font-medium peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:text-blue-600"
                  >
                    <User className="w-3 h-3" /> Name *
                  </label>
                </div>
                {/* Floating label input: Email */}
                <div className="relative">
                  <input
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                    type="email"
                    className="peer w-full px-3.5 pt-5 pb-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-shadow placeholder-transparent"
                    placeholder="email@example.com"
                    id="edit-email"
                  />
                  <label
                    htmlFor="edit-email"
                    className="absolute left-3.5 top-1.5 text-[10px] font-semibold text-blue-600 flex items-center gap-1 pointer-events-none transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-xs peer-placeholder-shown:text-gray-400 peer-placeholder-shown:font-medium peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:text-blue-600"
                  >
                    <Mail className="w-3 h-3" /> Email
                  </label>
                </div>
                {/* Floating label input: Organization */}
                <div className="relative">
                  <input
                    value={editOrganization}
                    onChange={e => setEditOrganization(e.target.value)}
                    className="peer w-full px-3.5 pt-5 pb-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-shadow placeholder-transparent"
                    placeholder="Company or organization"
                    id="edit-org"
                  />
                  <label
                    htmlFor="edit-org"
                    className="absolute left-3.5 top-1.5 text-[10px] font-semibold text-blue-600 flex items-center gap-1 pointer-events-none transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-xs peer-placeholder-shown:text-gray-400 peer-placeholder-shown:font-medium peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:text-blue-600"
                  >
                    <Building className="w-3 h-3" /> Organization
                  </label>
                </div>
                {/* Floating label input: Role */}
                <div className="relative">
                  <input
                    value={editRole}
                    onChange={e => setEditRole(e.target.value)}
                    className="peer w-full px-3.5 pt-5 pb-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-shadow placeholder-transparent"
                    placeholder="Job title or role"
                    id="edit-role"
                  />
                  <label
                    htmlFor="edit-role"
                    className="absolute left-3.5 top-1.5 text-[10px] font-semibold text-blue-600 flex items-center gap-1 pointer-events-none transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-xs peer-placeholder-shown:text-gray-400 peer-placeholder-shown:font-medium peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:text-blue-600"
                  >
                    <Target className="w-3 h-3" /> Role
                  </label>
                </div>
                {/* Area select */}
                <div>
                  <label className="block text-[10px] font-semibold text-blue-600 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Area
                  </label>
                  <select
                    value={editArea}
                    onChange={e => setEditArea(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-shadow bg-white"
                  >
                    <option value="">No area</option>
                    <option value="work">Work</option>
                    <option value="personal">Personal</option>
                    <option value="career">Career</option>
                  </select>
                </div>
              </div>

              {/* Notes textarea */}
              <div className="relative">
                <textarea
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  className="peer w-full px-3.5 pt-6 pb-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-shadow placeholder-transparent"
                  rows={3}
                  placeholder="Notes about this contact..."
                  id="edit-notes"
                />
                <label
                  htmlFor="edit-notes"
                  className="absolute left-3.5 top-1.5 text-[10px] font-semibold text-blue-600 flex items-center gap-1 pointer-events-none"
                >
                  <StickyNote className="w-3 h-3" /> Notes
                </label>
              </div>

              {/* Extended fields */}
              <div className="border-t border-gray-100 pt-5">
                <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)' }}>
                    <Globe className="w-2.5 h-2.5 text-white" />
                  </div>
                  Extended Info
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <input
                      value={editPhone}
                      onChange={e => setEditPhone(e.target.value)}
                      className="peer w-full px-3.5 pt-5 pb-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-shadow placeholder-transparent"
                      placeholder="+1 (555) 000-0000"
                      id="edit-phone"
                    />
                    <label
                      htmlFor="edit-phone"
                      className="absolute left-3.5 top-1.5 text-[10px] font-semibold text-blue-600 flex items-center gap-1 pointer-events-none transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-xs peer-placeholder-shown:text-gray-400 peer-placeholder-shown:font-medium peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:text-blue-600"
                    >
                      <Phone className="w-3 h-3" /> Phone
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      value={editLinkedin}
                      onChange={e => setEditLinkedin(e.target.value)}
                      className="peer w-full px-3.5 pt-5 pb-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-shadow placeholder-transparent"
                      placeholder="linkedin.com/in/username"
                      id="edit-linkedin"
                    />
                    <label
                      htmlFor="edit-linkedin"
                      className="absolute left-3.5 top-1.5 text-[10px] font-semibold text-blue-600 flex items-center gap-1 pointer-events-none transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-xs peer-placeholder-shown:text-gray-400 peer-placeholder-shown:font-medium peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:text-blue-600"
                    >
                      <Globe className="w-3 h-3" /> LinkedIn
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      value={editTwitter}
                      onChange={e => setEditTwitter(e.target.value)}
                      className="peer w-full px-3.5 pt-5 pb-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-shadow placeholder-transparent"
                      placeholder="@handle"
                      id="edit-twitter"
                    />
                    <label
                      htmlFor="edit-twitter"
                      className="absolute left-3.5 top-1.5 text-[10px] font-semibold text-blue-600 flex items-center gap-1 pointer-events-none transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-xs peer-placeholder-shown:text-gray-400 peer-placeholder-shown:font-medium peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:text-blue-600"
                    >
                      <MessageSquare className="w-3 h-3" /> Twitter / X
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      value={editTimezone}
                      onChange={e => setEditTimezone(e.target.value)}
                      className="peer w-full px-3.5 pt-5 pb-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-shadow placeholder-transparent"
                      placeholder="e.g. America/New_York"
                      id="edit-timezone"
                    />
                    <label
                      htmlFor="edit-timezone"
                      className="absolute left-3.5 top-1.5 text-[10px] font-semibold text-blue-600 flex items-center gap-1 pointer-events-none transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-xs peer-placeholder-shown:text-gray-400 peer-placeholder-shown:font-medium peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:text-blue-600"
                    >
                      <Clock className="w-3 h-3" /> Timezone
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={saveContact}
                  disabled={saving}
                  className="px-6 py-2.5 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
                  style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 flex items-center gap-2 transition-colors"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
                <span className="text-xs text-gray-400 ml-auto">
                  Ctrl+Enter to save &middot; Esc to cancel
                </span>
              </div>
            </div>
          ) : (
            /* ---- DISPLAY MODE ---- */
            <div className="flex flex-col sm:flex-row items-start gap-6">
              {/* Large avatar with gradient background based on name hash */}
              <div className="relative flex-shrink-0">
                <div
                  className={cn('w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold shadow-lg', getAvatarGradient(contact.name).text)}
                  style={{ background: getAvatarGradient(contact.name).bg }}
                >
                  {getInitials(contact.name)}
                </div>
                {/* Activity level indicator with colored dot animation */}
                <div className={cn('absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white animate-pulse-dot', engagement.dotColor)} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    {/* Name in large bold text with subtle gradient */}
                    <h1
                      className="text-2xl font-extrabold tracking-tight bg-clip-text text-transparent leading-tight"
                      style={{ backgroundImage: 'linear-gradient(135deg, #1e293b 0%, #3b82f6 50%, #8b5cf6 100%)' }}
                    >
                      {contact.name}
                    </h1>

                    {/* Organization and role shown below name */}
                    {(contact.organization || contact.role) && (
                      <div className="flex items-center gap-2 mt-1.5 text-sm text-gray-500">
                        {contact.role && (
                          <span className="font-medium text-gray-700">{contact.role}</span>
                        )}
                        {contact.role && contact.organization && (
                          <span className="text-gray-300">at</span>
                        )}
                        {contact.organization && (
                          <span className="font-medium text-gray-700 flex items-center gap-1">
                            <Building className="w-3.5 h-3.5 text-gray-400" />
                            {contact.organization}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Badges row: Area, Activity level, interaction count */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {contact.area && (
                        <span className={cn('text-xs px-3 py-1 rounded-full font-semibold capitalize', areaColor(contact.area))}>
                          {contact.area}
                        </span>
                      )}
                      <span className={cn('text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1.5', engagement.color)}>
                        <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse-dot', engagement.dotColor)} />
                        {engagement.label}
                      </span>
                      {contact.interaction_count > 0 && (
                        <span className="text-xs text-gray-600 flex items-center gap-1.5 bg-gray-50 rounded-full px-3 py-1 border border-gray-100">
                          <Activity className="w-3 h-3 text-gray-400" />
                          {contact.interaction_count} interaction{contact.interaction_count !== 1 ? 's' : ''}
                        </span>
                      )}
                      {daysAgo !== null && (
                        <span className="text-xs text-gray-500 flex items-center gap-1.5 bg-gray-50 rounded-full px-3 py-1 border border-gray-100">
                          <Clock className="w-3 h-3 text-gray-400" />
                          {daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`}
                        </span>
                      )}
                      {lastSavedAt && (
                        <span className="text-xs text-green-700 flex items-center gap-1.5 bg-green-50 rounded-full px-3 py-1 font-medium border border-green-100">
                          <Check className="w-3 h-3" />
                          Saved {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    {/* Email display */}
                    {contact.email && (
                      <div className="flex items-center gap-1.5 mt-2.5">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                        >
                          {contact.email}
                        </a>
                        <button
                          onClick={copyEmail}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-all"
                          title="Copy email"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={startEdit}
                    className="px-4 py-2 text-sm font-semibold text-white rounded-xl hover:opacity-90 flex items-center gap-2 shadow-sm transition-all"
                    style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }}
                    title="Edit contact"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================
          2. Quick Action Bar (sticky, glass morphism)
          ============================ */}
      {!editing && (
        <div className="animate-fade-in sticky top-0 z-20 glass-dark rounded-2xl border border-white/60 shadow-lg p-2.5" style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Primary actions group */}
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="group relative px-3 py-2 text-blue-700 rounded-xl text-xs font-semibold hover:bg-blue-50 flex items-center gap-1.5 transition-all"
              >
                <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Mail className="w-3 h-3 text-blue-600" />
                </div>
                Email
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30">
                  Send email to {contact.name}
                </span>
              </a>
            )}

            <div className="w-px h-6 bg-gray-200 mx-0.5" />

            <button
              onClick={() => runAgent('enrich_contact')}
              disabled={!!agentLoading}
              className="group relative px-3 py-2 text-purple-700 rounded-xl text-xs font-semibold hover:bg-purple-50 disabled:opacity-50 flex items-center gap-1.5 transition-all"
            >
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }}>
                {agentLoading === 'enrich_contact' ? <Loader2 className="w-3 h-3 animate-spin text-white" /> : <Brain className="w-3 h-3 text-white" />}
              </div>
              Enrich
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30">
                Enrich profile with AI
              </span>
            </button>

            <button
              onClick={() => runAgent('contact_intelligence')}
              disabled={!!agentLoading}
              className="group relative px-3 py-2 text-purple-700 rounded-xl text-xs font-semibold hover:bg-purple-50 disabled:opacity-50 flex items-center gap-1.5 transition-all"
            >
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)' }}>
                {agentLoading === 'contact_intelligence' ? <Loader2 className="w-3 h-3 animate-spin text-white" /> : <Sparkles className="w-3 h-3 text-white" />}
              </div>
              Intelligence
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30">
                Generate intelligence report
              </span>
            </button>

            <div className="w-px h-6 bg-gray-200 mx-0.5" />

            <div className="relative">
              <button
                onClick={() => setShowLinkDropdown(!showLinkDropdown)}
                className="group relative px-3 py-2 text-blue-700 rounded-xl text-xs font-semibold hover:bg-blue-50 flex items-center gap-1.5 transition-all"
              >
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }}>
                  <LinkIcon className="w-3 h-3 text-white" />
                </div>
                Link Topic
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30">
                  Link a topic to this contact
                </span>
              </button>
            </div>

            <div className="flex-1" />

            <button
              onClick={() => runAgent('propose_next_email')}
              disabled={!!agentLoading}
              className="group relative px-3 py-2 text-purple-700 rounded-xl text-xs font-semibold hover:bg-purple-50 disabled:opacity-50 flex items-center gap-1.5 transition-all"
            >
              <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center">
                {agentLoading === 'propose_next_email' ? <Loader2 className="w-3 h-3 animate-spin text-purple-600" /> : <Wand2 className="w-3 h-3 text-purple-600" />}
              </div>
              Suggest Email
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30">
                AI-suggested next email
              </span>
            </button>

            <button
              onClick={deleteContact}
              className="group relative p-2 text-gray-400 rounded-xl text-xs font-medium hover:bg-red-50 hover:text-red-600 flex items-center gap-1.5 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30">
                Delete this contact
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ============================
          6. Link Topic Dropdown
          ============================ */}
      {showLinkDropdown && (
        <div className="animate-fade-in bg-white rounded-2xl border border-gray-200/60 shadow-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }}>
                <LinkIcon className="w-3.5 h-3.5 text-white" />
              </div>
              Link a Topic
            </h3>
            <button onClick={() => setShowLinkDropdown(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={linkSearchQuery}
                onChange={e => setLinkSearchQuery(e.target.value)}
                placeholder="Search topics..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-shadow"
              />
            </div>
            <input
              value={linkRole}
              onChange={e => setLinkRole(e.target.value)}
              placeholder="Role (optional)"
              className="w-40 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-shadow"
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1.5">
            {filteredLinkTopics.length === 0 ? (
              <p className="text-sm text-gray-600 text-center py-6">No matching topics found.</p>
            ) : (
              filteredLinkTopics.map(topic => (
                <div
                  key={topic.id}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn('text-xs px-2.5 py-0.5 rounded-full font-medium capitalize', areaColor(topic.area))}>
                      {topic.area}
                    </span>
                    <span className="text-sm text-gray-900 font-medium truncate">{topic.title}</span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', statusColor(topic.status))}>
                      {topic.status}
                    </span>
                  </div>
                  <button
                    onClick={() => linkTopic(topic.id)}
                    disabled={linkingTopic}
                    className="px-3.5 py-1.5 text-white rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50 flex-shrink-0 flex items-center gap-1 transition-opacity"
                    style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }}
                  >
                    {linkingTopic ? <Loader2 className="w-3 h-3 animate-spin" /> : <LinkIcon className="w-3 h-3" />}
                    Link
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ============================
          8a. Enriched Profile Banner
          ============================ */}
      {showEnriched && enrichedProfile && (
        <div className="animate-fade-in bg-white rounded-2xl border border-purple-200/60 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 flex items-center justify-between border-b border-purple-100/60" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(59,130,246,0.05) 100%)' }}>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }}>
                <Brain className="w-3.5 h-3.5 text-white" />
              </div>
              AI Enriched Profile
            </h3>
            <button onClick={() => setShowEnriched(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-purple-50 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5">
            {(() => {
              const org = enrichedProfile.organization as string | undefined;
              const rl = enrichedProfile.role as string | undefined;
              const freq = enrichedProfile.interaction_frequency as string | undefined;
              const keyTopics = Array.isArray(enrichedProfile.key_topics) ? (enrichedProfile.key_topics as string[]) : [];
              const relSummary = enrichedProfile.relationship_summary as string | undefined;
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {org && (
                    <div className="p-4 bg-gradient-to-br from-purple-50/60 to-white rounded-xl border border-purple-100/40">
                      <p className="text-xs font-semibold text-purple-600 mb-1.5 flex items-center gap-1.5">
                        <Building className="w-3 h-3" /> Organization
                      </p>
                      <p className="text-sm text-gray-900 font-medium leading-relaxed">{org}</p>
                    </div>
                  )}
                  {rl && (
                    <div className="p-4 bg-gradient-to-br from-purple-50/60 to-white rounded-xl border border-purple-100/40">
                      <p className="text-xs font-semibold text-purple-600 mb-1.5 flex items-center gap-1.5">
                        <User className="w-3 h-3" /> Role
                      </p>
                      <p className="text-sm text-gray-900 font-medium leading-relaxed">{rl}</p>
                    </div>
                  )}
                  {freq && (
                    <div className="p-4 bg-gradient-to-br from-purple-50/60 to-white rounded-xl border border-purple-100/40">
                      <p className="text-xs font-semibold text-purple-600 mb-1.5 flex items-center gap-1.5">
                        <Activity className="w-3 h-3" /> Frequency
                      </p>
                      <p className="text-sm text-gray-900 font-medium leading-relaxed">{freq}</p>
                    </div>
                  )}
                  {keyTopics.length > 0 && (
                    <div className="p-4 bg-gradient-to-br from-purple-50/60 to-white rounded-xl border border-purple-100/40 md:col-span-2 lg:col-span-1">
                      <p className="text-xs font-semibold text-purple-600 mb-2 flex items-center gap-1.5">
                        <Tag className="w-3 h-3" /> Key Topics
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {keyTopics.map((t, i) => (
                          <span key={i} className="text-xs px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {relSummary && (
                    <div className="p-4 bg-gradient-to-br from-purple-50/60 to-white rounded-xl border border-purple-100/40 md:col-span-2 lg:col-span-3">
                      <p className="text-xs font-semibold text-purple-600 mb-1.5 flex items-center gap-1.5">
                        <Heart className="w-3 h-3" /> Relationship Summary
                      </p>
                      <p className="text-sm text-gray-600 leading-relaxed">{relSummary}</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ============================
          8b. Email Suggestion Card
          ============================ */}
      {showEmailSuggestion && emailSuggestion && (() => {
        const esUrgency = emailSuggestion.urgency as string | undefined;
        const esSubject = emailSuggestion.subject as string | undefined;
        const esBody = emailSuggestion.body as string | undefined;
        const esKeyPoints = Array.isArray(emailSuggestion.key_points) ? (emailSuggestion.key_points as string[]) : [];
        return (
          <div className="animate-fade-in rounded-2xl shadow-md overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(168,85,247,0.04) 50%, rgba(59,130,246,0.03) 100%)' }}>
            <div className="border border-purple-200/50 rounded-2xl overflow-hidden">
              {/* Purple gradient top border */}
              <div className="h-1.5 w-full" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 50%, #6366f1 100%)' }} />
              <div className="px-5 py-3.5 flex items-center justify-between border-b border-purple-100/40">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)' }}>
                    <Wand2 className="w-3.5 h-3.5 text-white" />
                  </div>
                  Suggested Email
                  {esUrgency && (
                    <span className={cn(
                      'text-xs px-2.5 py-1 rounded-full font-semibold',
                      esUrgency === 'high' ? 'bg-red-100 text-red-700' :
                      esUrgency === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    )}>
                      {esUrgency.charAt(0).toUpperCase() + esUrgency.slice(1)} urgency
                    </span>
                  )}
                </h3>
                <button onClick={() => setShowEmailSuggestion(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-purple-50 rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-5">
                {/* Subject line preview */}
                {esSubject && (
                  <div className="p-3.5 rounded-xl bg-white/80 border border-purple-100/40">
                    <p className="text-[10px] font-semibold text-purple-500 mb-1 uppercase tracking-wider">Subject</p>
                    <p className="text-sm font-bold text-gray-900">{esSubject}</p>
                  </div>
                )}
                {/* Key points as bullet list */}
                {esKeyPoints.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-purple-500 mb-2.5 uppercase tracking-wider">Key Points</p>
                    <ul className="space-y-2">
                      {esKeyPoints.map((point, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-2.5 leading-relaxed">
                          <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 shadow-sm" style={{ background: 'linear-gradient(135deg, #8b5cf6, #a855f7)' }} />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {esBody && (
                  <div>
                    <p className="text-[10px] font-semibold text-purple-500 mb-1.5 uppercase tracking-wider">Draft Body</p>
                    <div className="bg-white/80 rounded-xl p-4 text-sm text-gray-600 whitespace-pre-wrap leading-relaxed border border-purple-100/30">
                      {esBody}
                    </div>
                  </div>
                )}
                {/* "Open in Email" button with mail icon */}
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}?subject=${encodeURIComponent(esSubject || '')}&body=${encodeURIComponent(esBody || '')}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-md hover:shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)' }}
                  >
                    <Mail className="w-4 h-4" />
                    Open in Email
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================
          8c. Intelligence Panel
          ============================ */}
      {showIntelligence && intelligence && (() => {
        const healthScore = typeof intelligence.relationship_health === 'number' ? (intelligence.relationship_health as number) : null;
        const commPattern = intelligence.communication_pattern as string | undefined;
        const sentimentVal = intelligence.sentiment as string | undefined;
        const keyThemes = Array.isArray(intelligence.key_themes) ? (intelligence.key_themes as string[]) : [];
        const recs = Array.isArray(intelligence.recommendations) ? (intelligence.recommendations as string[]) : [];
        const themeColors = ['bg-purple-100 text-purple-700 border-purple-200', 'bg-blue-100 text-blue-700 border-blue-200', 'bg-pink-100 text-pink-700 border-pink-200', 'bg-cyan-100 text-cyan-700 border-cyan-200', 'bg-amber-100 text-amber-700 border-amber-200', 'bg-emerald-100 text-emerald-700 border-emerald-200'];
        return (
          <div className="animate-fade-in rounded-2xl shadow-sm overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.04) 0%, rgba(59,130,246,0.04) 50%, rgba(236,72,153,0.03) 100%)' }}>
            <div className="border border-purple-200/40 rounded-2xl overflow-hidden">
              <div className="h-1 w-full" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 50%, #ec4899 100%)' }} />
              <div className="px-5 py-3.5 flex items-center justify-between border-b border-purple-100/40">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)' }}>
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                  Contact Intelligence
                </h3>
                <button onClick={() => setShowIntelligence(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-purple-50 rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-6">
                {/* Relationship Health Visual Gauge (0-100) */}
                {healthScore !== null && (
                  <div className="p-5 rounded-xl border border-gray-100" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(249,250,251,0.9) 100%)' }}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                          <Heart className="w-4 h-4 text-pink-500" />
                          Relationship Health
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                          {healthScore >= 70 ? 'Strong relationship - keep it up!' : healthScore >= 40 ? 'Needs attention - consider reaching out' : 'At risk - immediate action recommended'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-3xl font-extrabold bg-clip-text text-transparent" style={{ backgroundImage: healthScore >= 70 ? 'linear-gradient(135deg, #22c55e, #16a34a)' : healthScore >= 40 ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                          {healthScore}
                        </span>
                        <span className="text-xs text-gray-400 ml-0.5">/100</span>
                      </div>
                    </div>
                    {/* Segmented gauge bar */}
                    <div className="flex gap-1 w-full">
                      {Array.from({ length: 10 }, (_, i) => {
                        const segmentVal = (i + 1) * 10;
                        const filled = healthScore >= segmentVal;
                        const partial = !filled && healthScore > (i * 10);
                        return (
                          <div
                            key={i}
                            className="flex-1 h-3 rounded-full transition-all duration-500"
                            style={{
                              background: filled || partial
                                ? healthScore >= 70
                                  ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                                  : healthScore >= 40
                                  ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                                  : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                                : '#e5e7eb',
                              opacity: partial ? 0.5 : 1,
                            }}
                          />
                        );
                      })}
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-[10px] text-red-400 font-medium">At Risk</span>
                      <span className="text-[10px] text-amber-400 font-medium">Needs Attention</span>
                      <span className="text-[10px] text-green-500 font-medium">Strong</span>
                    </div>
                  </div>
                )}

                {/* Communication Pattern & Sentiment in a grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {commPattern && (
                    <div className="p-4 rounded-xl bg-white border border-gray-100 hover:border-purple-200 transition-colors">
                      <p className="text-xs font-semibold text-purple-600 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                        <MessageSquare className="w-3 h-3" /> Communication Pattern
                      </p>
                      <p className="text-sm text-gray-600 leading-relaxed">{commPattern}</p>
                    </div>
                  )}

                  {sentimentVal && (
                    <div className="p-4 rounded-xl bg-white border border-gray-100 hover:border-pink-200 transition-colors">
                      <p className="text-xs font-semibold text-pink-600 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                        <Heart className="w-3 h-3" /> Sentiment
                      </p>
                      <p className="text-sm text-gray-600 leading-relaxed">{sentimentVal}</p>
                    </div>
                  )}
                </div>

                {/* Key Themes as colored tag pills */}
                {keyThemes.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2.5 flex items-center gap-1.5 uppercase tracking-wider">
                      <Tag className="w-3 h-3" /> Key Themes
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {keyThemes.map((theme, i) => (
                        <span key={i} className={cn('text-xs px-3 py-1.5 rounded-full font-semibold border', themeColors[i % themeColors.length])}>
                          {theme}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Recommendations as checklist */}
                {recs.length > 0 && (
                  <div className="p-4 rounded-xl bg-white border border-gray-100">
                    <p className="text-xs font-semibold text-gray-600 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                      <Target className="w-3 h-3" /> Action Recommendations
                    </p>
                    <ul className="space-y-2.5">
                      {recs.map((rec, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-gray-600 leading-relaxed">
                          <div className="w-5 h-5 mt-0.5 flex-shrink-0 rounded-md border-2 border-purple-300 flex items-center justify-center bg-white hover:bg-purple-50 transition-colors cursor-default">
                            <Check className="w-3 h-3 text-purple-500" />
                          </div>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================
          4. Pending Topics Section
          ============================ */}
      {pendingTopics.length > 0 && (
        <div className="animate-fade-in bg-white rounded-2xl border border-gray-200/60 shadow-sm hover-lift overflow-hidden">
          {/* Gradient accent on section header */}
          <div className="h-0.5 w-full" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' }} />
          <button
            onClick={() => setShowPendingTopics(!showPendingTopics)}
            className="w-full px-5 py-4 flex items-center justify-between text-left"
          >
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' }}>
                <AlertTriangle className="w-3.5 h-3.5 text-white" />
              </div>
              Pending Topics
              <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' }}>{pendingTopics.length}</span>
            </h2>
            {showPendingTopics ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {showPendingTopics && (
            <div className="px-5 pb-5 space-y-2">
              {pendingTopics.map(link => {
                const topic = link.topics;
                if (!topic) return null;
                const dueDate = topic.due_date ? new Date(topic.due_date) : null;
                const isOverdue = dueDate ? dueDate < new Date() : false;
                const overdueDays = dueDate ? Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                const priority = topic.priority ?? 0;

                return (
                  <div
                    key={link.topic_id}
                    className={cn(
                      'group flex items-center gap-3 p-3.5 rounded-xl border transition-all hover:shadow-sm',
                      isOverdue
                        ? 'border-red-200 bg-red-50/30 hover:border-red-300'
                        : 'border-gray-100 bg-white hover:border-blue-200'
                    )}
                    style={isOverdue ? { borderLeftWidth: '3px', borderLeftColor: '#ef4444' } : { borderLeftWidth: '3px', borderLeftColor: '#22c55e' }}
                  >
                    {/* Priority indicator */}
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold',
                      priority >= 4 ? 'bg-red-100 text-red-700' : priority === 3 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    )}>
                      P{priority || 0}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/topics/${link.topic_id}`}
                          className="text-sm font-semibold text-gray-900 hover:text-blue-600 truncate transition-colors"
                        >
                          {topic.title}
                        </Link>
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide', statusColor(topic.status))}>
                          {topic.status}
                        </span>
                        {topic.area && (
                          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize', areaColor(topic.area))}>
                            {topic.area}
                          </span>
                        )}
                        {isOverdue && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold flex items-center gap-1 animate-pulse-dot">
                            <AlertTriangle className="w-3 h-3" />
                            {overdueDays}d overdue
                          </span>
                        )}
                        {priority >= 4 && !isOverdue && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">
                            Urgent
                          </span>
                        )}
                        {priority === 3 && !isOverdue && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">
                            High
                          </span>
                        )}
                      </div>
                      {dueDate && !isOverdue && (
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          Due {formatShortDate(topic.due_date!)}
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/topics/${link.topic_id}`}
                      className="p-2 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all flex-shrink-0 opacity-0 group-hover:opacity-100"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================
          5. All Related Topics Section
          ============================ */}
      <div className="animate-fade-in bg-white rounded-2xl border border-gray-200/60 shadow-sm hover-lift overflow-hidden">
        {/* Gradient accent on section header */}
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }} />
        <button
          onClick={() => setShowAllTopics(!showAllTopics)}
          className="w-full px-5 py-4 flex items-center justify-between text-left"
        >
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }}>
              <LinkIcon className="w-3.5 h-3.5 text-white" />
            </div>
            Related Topics
            <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }}>{topicLinks.length}</span>
          </h2>
          {showAllTopics ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {showAllTopics && (
          <div className="px-5 pb-5">
            {topicLinks.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-100 flex items-center justify-center">
                  <LinkIcon className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-sm text-gray-600">No topics linked yet.</p>
                <p className="text-xs text-gray-400 mt-1">Use the Link Topic button above to connect topics.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {topicLinks.map(link => {
                  const topic = link.topics;
                  if (!topic) return null;
                  const isTopicOverdue = topic.due_date ? new Date(topic.due_date) < new Date() : false;
                  const isTopicActive = topic.status === 'active';
                  const topicPriority = topic.priority ?? 0;
                  const statusDotColor: Record<string, string> = { active: 'bg-emerald-500', completed: 'bg-gray-400', archived: 'bg-amber-500' };
                  // Health indicator: green if active + recent update, amber if stale, red if overdue
                  const lastUpdate = topic.updated_at ? Math.floor((Date.now() - new Date(topic.updated_at).getTime()) / (1000 * 60 * 60 * 24)) : 999;
                  const healthColor = isTopicOverdue ? '#ef4444' : (isTopicActive && lastUpdate <= 7) ? '#22c55e' : (isTopicActive && lastUpdate <= 30) ? '#f59e0b' : '#94a3b8';

                  return (
                    <div
                      key={link.topic_id}
                      className={cn(
                        'group flex items-center gap-3 p-3.5 rounded-xl border transition-all hover:shadow-sm',
                        isTopicOverdue
                          ? 'border-red-200 bg-red-50/20 hover:border-red-300'
                          : isTopicActive
                          ? 'border-green-100 bg-white hover:border-green-200'
                          : 'border-gray-100 bg-white hover:border-blue-200'
                      )}
                      style={isTopicOverdue ? { borderLeftWidth: '3px', borderLeftColor: '#ef4444' } : isTopicActive ? { borderLeftWidth: '3px', borderLeftColor: '#22c55e' } : { borderLeftWidth: '3px', borderLeftColor: '#94a3b8' }}
                    >
                      {/* Topic health indicator */}
                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: healthColor }} />
                        {topicPriority > 0 && (
                          <span className="text-[9px] font-bold text-gray-400">P{topicPriority}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/topics/${link.topic_id}`}
                            className="text-sm font-semibold text-gray-900 hover:text-blue-600 truncate transition-colors"
                          >
                            {topic.title}
                          </Link>
                          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide', statusColor(topic.status))}>
                            {topic.status || 'active'}
                          </span>
                          {topic.area && (
                            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize', areaColor(topic.area))}>
                              {topic.area}
                            </span>
                          )}

                          {/* Role badge (editable) */}
                          {editingRoleForTopic === link.topic_id ? (
                            <div className="relative flex items-center gap-1">
                              <input
                                value={roleEditValue}
                                onChange={e => setRoleEditValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    updateTopicRole(link.topic_id, roleEditValue);
                                  }
                                  if (e.key === 'Escape') {
                                    setEditingRoleForTopic(null);
                                    setShowRoleDropdown(false);
                                  }
                                }}
                                className="w-32 px-2.5 py-1 border border-blue-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="Enter role..."
                                autoFocus
                                onFocus={() => setShowRoleDropdown(true)}
                              />
                              <button
                                onClick={() => updateTopicRole(link.topic_id, roleEditValue)}
                                className="p-0.5 text-blue-600 hover:text-blue-800"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => { setEditingRoleForTopic(null); setShowRoleDropdown(false); }}
                                className="p-0.5 text-gray-400 hover:text-gray-600"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                              {showRoleDropdown && (
                                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1.5 w-40">
                                  {ROLE_OPTIONS.map(option => (
                                    <button
                                      key={option}
                                      onClick={() => {
                                        setRoleEditValue(option);
                                        updateTopicRole(link.topic_id, option);
                                      }}
                                      className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                      {option}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingRoleForTopic(link.topic_id);
                                setRoleEditValue(link.role || '');
                              }}
                              className={cn(
                                'text-[10px] px-2.5 py-0.5 rounded-full cursor-pointer transition-colors font-semibold',
                                link.role
                                  ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                  : 'bg-gray-50 text-gray-400 hover:bg-gray-100 border border-dashed border-gray-300'
                              )}
                              title="Click to edit role"
                            >
                              {link.role || 'Set role'}
                            </button>
                          )}
                        </div>
                        {topic.tags && topic.tags.length > 0 && (
                          <div className="flex gap-1.5 mt-2">
                            {topic.tags.map((tag, i) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          href={`/topics/${link.topic_id}`}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Open topic"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => unlinkTopic(link.topic_id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Unlink topic"
                        >
                          <Unlink className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================
          7. Communication Timeline
          ============================ */}
      <div className="animate-fade-in bg-white rounded-2xl border border-gray-200/60 shadow-sm hover-lift overflow-hidden">
        {/* Gradient accent on section header */}
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)' }} />
        <button
          onClick={() => setShowTimeline(!showTimeline)}
          className="w-full px-5 py-4 flex items-center justify-between text-left"
        >
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)' }}>
              <Clock className="w-3.5 h-3.5 text-white" />
            </div>
            Communication History
            <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)' }}>{relatedItems.length}</span>
          </h2>
          {showTimeline ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {showTimeline && (
          <div className="px-5 pb-5">
            {relatedItems.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #ede9fe 100%)' }}>
                  <Clock className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-sm text-gray-600 font-medium">No communication history yet.</p>
                <p className="text-xs text-gray-400 mt-1">Interactions will appear here as they occur.</p>
              </div>
            ) : (() => {
              let displayedCount = 0;
              const totalCount = relatedItems.length;
              const maxDisplay = timelineDisplayCount;
              const sourceGradientMap: Record<string, string> = {
                email: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                gmail: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                slack: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                calendar: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                meeting: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                manual: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                notion: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
              };

              return (
                <div className="space-y-6">
                  {timelineGroupOrder.map(groupName => {
                    const groupItems = groupedTimeline[groupName];
                    if (!groupItems || groupItems.length === 0) return null;

                    const itemsToShow: Record<string, unknown>[] = [];
                    for (const item of groupItems) {
                      if (displayedCount >= maxDisplay) break;
                      itemsToShow.push(item);
                      displayedCount++;
                    }
                    if (itemsToShow.length === 0) return null;

                    return (
                      <div key={groupName}>
                        <div className="flex items-center gap-2 mb-3">
                          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">{groupName}</h3>
                          <div className="flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent" />
                          <span className="text-[10px] text-gray-400 font-medium">{groupItems.length} items</span>
                        </div>
                        {/* Timeline with vertical connector line */}
                        <div className="relative">
                          {/* Vertical timeline line */}
                          <div className="absolute left-[15px] top-4 bottom-4 w-[2px] rounded-full" style={{ background: 'linear-gradient(to bottom, #e5e7eb 0%, #d1d5db 50%, transparent 100%)' }} />
                          <div className="space-y-0.5">
                            {itemsToShow.map((item, idx) => {
                              const itemSource = (item.source as string) || 'manual';
                              const itemTitle = (item.title as string) || 'Untitled';
                              const itemSnippet = (item.snippet as string) || '';
                              const truncatedSnippet = itemSnippet.length > 150 ? itemSnippet.slice(0, 150) + '...' : itemSnippet;
                              const itemDate = (item.occurred_at || item.created_at) as string;
                              const itemUrl = item.url as string | undefined;
                              const itemMeta = (item.metadata || {}) as Record<string, unknown>;
                              const topicId = item.topic_id as string | undefined;
                              const metaFrom = itemMeta.from as string | undefined;
                              const metaTo = itemMeta.to as string | undefined;
                              const metaChannel = itemMeta.channel as string | undefined;
                              const metaLocation = itemMeta.location as string | undefined;
                              const sourceGradient = sourceGradientMap[itemSource] || sourceGradientMap.manual;

                              return (
                                <div
                                  key={idx}
                                  className="flex items-start gap-4 py-2.5 group animate-fade-in"
                                  style={{ animationDelay: `${idx * 30}ms` }}
                                >
                                  {/* Source icon with colored gradient background */}
                                  <div
                                    className="relative z-10 w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-white shadow-sm"
                                    style={{ background: sourceGradient }}
                                    title={itemSource}
                                  >
                                    <SourceIcon source={itemSource} className="w-3.5 h-3.5 text-white" />
                                  </div>
                                  <div className="flex-1 min-w-0 p-3 rounded-xl border border-transparent group-hover:border-gray-200 group-hover:bg-gray-50/50 transition-all -mt-0.5">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        {itemUrl ? (
                                          <a href={itemUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-gray-900 hover:text-blue-600 truncate block transition-colors">
                                            {itemTitle}
                                          </a>
                                        ) : (
                                          <p className="text-sm font-semibold text-gray-900 truncate">{itemTitle}</p>
                                        )}
                                        {truncatedSnippet && (
                                          <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{truncatedSnippet}</p>
                                        )}
                                        {/* Metadata details */}
                                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                                          {metaFrom && (
                                            <span className="text-[10px] text-gray-600 bg-gray-100 rounded-full px-2 py-0.5 font-medium">From: {metaFrom}</span>
                                          )}
                                          {metaTo && (
                                            <span className="text-[10px] text-gray-600 bg-gray-100 rounded-full px-2 py-0.5 font-medium">To: {metaTo}</span>
                                          )}
                                          {metaChannel && (
                                            <span className="text-[10px] text-purple-600 bg-purple-50 rounded-full px-2 py-0.5 font-medium">#{metaChannel}</span>
                                          )}
                                          {metaLocation && (
                                            <span className="text-[10px] text-gray-600 bg-gray-100 rounded-full px-2 py-0.5 font-medium flex items-center gap-0.5">
                                              <MapPin className="w-2.5 h-2.5" />{metaLocation}
                                            </span>
                                          )}
                                          {topicId && (
                                            <Link
                                              href={`/topics/${topicId}`}
                                              className="text-[10px] text-blue-600 bg-blue-50 rounded-full px-2 py-0.5 font-medium hover:bg-blue-100 flex items-center gap-0.5 transition-colors"
                                            >
                                              <ExternalLink className="w-2.5 h-2.5" /> Topic
                                            </Link>
                                          )}
                                        </div>
                                      </div>
                                      <span className="text-[10px] text-gray-400 flex-shrink-0 whitespace-nowrap font-medium bg-gray-50 rounded-full px-2.5 py-0.5 border border-gray-100">
                                        {formatRelativeDate(itemDate)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {totalCount > maxDisplay && (
                    <button
                      onClick={() => setTimelineDisplayCount(prev => prev + 20)}
                      className="w-full py-2.5 text-sm font-semibold hover:opacity-90 rounded-xl transition-all text-center text-white shadow-sm"
                      style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)' }}
                    >
                      Load More ({totalCount - maxDisplay} remaining)
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ============================
          9. Extended Info Section
          ============================ */}
      {hasExtendedInfo && !editing && (() => {
        const extPhone = contact.metadata?.phone as string | undefined;
        const extLinkedin = contact.metadata?.linkedin as string | undefined;
        const extTwitter = contact.metadata?.twitter as string | undefined;
        const extTimezone = contact.metadata?.timezone as string | undefined;
        return (
          <div className="animate-fade-in bg-white rounded-2xl border border-gray-200/60 shadow-sm hover-lift overflow-hidden">
            <div className="h-0.5 w-full" style={{ background: 'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)' }} />
            <div className="p-5">
              <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)' }}>
                  <Globe className="w-3.5 h-3.5 text-white" />
                </div>
                Extended Info
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {extPhone && (
                  <div className="flex items-center gap-3 text-sm text-gray-700 p-3 rounded-xl bg-gradient-to-br from-gray-50 to-white border border-gray-100 hover:border-gray-200 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Phone className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                    <span className="leading-relaxed font-medium">{extPhone}</span>
                  </div>
                )}
                {extLinkedin && (
                  <div className="flex items-center gap-3 text-sm p-3 rounded-xl bg-gradient-to-br from-blue-50/30 to-white border border-gray-100 hover:border-blue-200 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Globe className="w-3.5 h-3.5 text-blue-500" />
                    </div>
                    <a
                      href={extLinkedin.startsWith('http') ? extLinkedin : `https://${extLinkedin}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline truncate leading-relaxed font-medium"
                    >
                      {extLinkedin}
                    </a>
                  </div>
                )}
                {extTwitter && (
                  <div className="flex items-center gap-3 text-sm p-3 rounded-xl bg-gradient-to-br from-gray-50 to-white border border-gray-100 hover:border-gray-200 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                    <a
                      href={extTwitter.startsWith('http') ? extTwitter : `https://x.com/${extTwitter.replace(/^@/, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline leading-relaxed font-medium"
                    >
                      {extTwitter}
                    </a>
                  </div>
                )}
                {extTimezone && (
                  <div className="flex items-center gap-3 text-sm text-gray-700 p-3 rounded-xl bg-gradient-to-br from-gray-50 to-white border border-gray-100 hover:border-gray-200 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                    <span className="leading-relaxed font-medium">{extTimezone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================
          10. Notes Section
          ============================ */}
      <div className="animate-fade-in bg-white rounded-2xl border border-gray-200/60 shadow-sm hover-lift overflow-hidden">
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)' }} />
        <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)' }}>
              <StickyNote className="w-3.5 h-3.5 text-white" />
            </div>
            Notes
          </h2>
          {!editingNotes && (
            <button
              onClick={() => {
                setInlineNotes(contact.notes || '');
                setEditingNotes(true);
              }}
              className="text-xs text-gray-600 hover:text-blue-600 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-all font-medium"
            >
              <Edit3 className="w-3 h-3" />
              {contact.notes ? 'Edit' : 'Add notes'}
            </button>
          )}
          {savingNotes && (
            <span className="text-xs text-gray-600 flex items-center gap-1.5 font-medium">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving...
            </span>
          )}
        </div>
        {editingNotes ? (
          <div className="space-y-2">
            <textarea
              ref={notesRef}
              value={inlineNotes}
              onChange={e => setInlineNotes(e.target.value)}
              onBlur={() => saveNotesInline()}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setInlineNotes(contact.notes || '');
                  setEditingNotes(false);
                }
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  saveNotesInline();
                }
              }}
              className="w-full px-3.5 py-2.5 border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 min-h-[100px] resize-y transition-shadow leading-relaxed"
              placeholder="Write notes about this contact..."
              rows={4}
            />
            <p className="text-xs text-gray-400">
              Click outside to save &middot; Ctrl+Enter to save &middot; Esc to cancel
            </p>
          </div>
        ) : contact.notes ? (
          <div
            onClick={() => {
              setInlineNotes(contact.notes || '');
              setEditingNotes(true);
            }}
            className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed cursor-pointer hover:bg-gray-50 rounded-xl p-3 -m-1 transition-colors"
            title="Click to edit notes"
          >
            {contact.notes}
          </div>
        ) : (
          <div
            onClick={() => {
              setInlineNotes('');
              setEditingNotes(true);
            }}
            className="text-sm text-gray-400 cursor-pointer hover:bg-gray-50 rounded-xl p-5 border border-dashed border-gray-200 text-center transition-colors"
          >
            Click to add notes...
          </div>
        )}
        </div>
      </div>

      {/* ============================
          Footer info
          ============================ */}
      <div className="animate-fade-in text-center text-xs text-gray-400 py-3 flex items-center justify-center gap-3">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          Created {formatShortDate(contact.created_at)}
        </span>
        <span className="w-1 h-1 rounded-full bg-gray-300" />
        <span>Updated {formatRelativeDate(contact.updated_at)}</span>
      </div>
    </div>
  );
}
