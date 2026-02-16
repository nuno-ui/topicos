'use client';
import { useState, useMemo } from 'react';
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
  if (!lastInteraction) return { label: 'New', color: 'bg-gray-100 text-gray-600' };
  const days = Math.floor((Date.now() - new Date(lastInteraction).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 7) return { label: 'Active', color: 'bg-green-100 text-green-700' };
  if (days <= 30) return { label: 'Recent', color: 'bg-blue-100 text-blue-700' };
  if (days <= 90) return { label: 'Idle', color: 'bg-amber-100 text-amber-700' };
  return { label: 'Cold', color: 'bg-red-100 text-red-700' };
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
    setEditName(contact.name);
    setEditEmail(contact.email || '');
    setEditOrganization(contact.organization || '');
    setEditRole(contact.role || '');
    setEditArea(contact.area || '');
    setEditNotes(contact.notes || '');
    setEditPhone((contact.metadata?.phone as string) || '');
    setEditLinkedin((contact.metadata?.linkedin as string) || '');
    setEditTwitter((contact.metadata?.twitter as string) || '');
    setEditTimezone((contact.metadata?.timezone as string) || '');
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
      const metadata = { ...contact.metadata };
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
      setContact(prev => ({
        ...prev,
        ...data.contact,
        metadata,
        contact_topic_links: prev.contact_topic_links,
      }));
      setEditing(false);
      toast.success('Contact updated');
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
    <div className="space-y-6 pb-16">
      {/* ============================
          1. Profile Header
          ============================ */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        {/* Back button */}
        <Link
          href="/contacts"
          className="inline-flex items-center gap-1.5 text-sm font-medium bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent hover:opacity-80 transition-opacity mb-4"
        >
          <ArrowLeft className="w-4 h-4 text-blue-500" />
          Back to Contacts
        </Link>

        {editing ? (
          /* ---- EDIT MODE ---- */
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                <input
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  type="email"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Organization</label>
                <input
                  value={editOrganization}
                  onChange={e => setEditOrganization(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Company or organization"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                <input
                  value={editRole}
                  onChange={e => setEditRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Job title or role"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Area</label>
                <select
                  value={editArea}
                  onChange={e => setEditArea(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No area</option>
                  <option value="work">Work</option>
                  <option value="personal">Personal</option>
                  <option value="career">Career</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
              <textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Notes about this contact..."
              />
            </div>

            {/* Extended fields */}
            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Extended Info</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                  <input
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">LinkedIn</label>
                  <input
                    value={editLinkedin}
                    onChange={e => setEditLinkedin(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="linkedin.com/in/username"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Twitter / X</label>
                  <input
                    value={editTwitter}
                    onChange={e => setEditTwitter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="@handle"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Timezone</label>
                  <input
                    value={editTimezone}
                    onChange={e => setEditTimezone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. America/New_York"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={saveContact}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
              <button
                onClick={cancelEdit}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 flex items-center gap-2"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
            </div>
          </div>
        ) : (
          /* ---- DISPLAY MODE ---- */
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className={cn('w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0', getAvatarColor(contact.name))}>
              {getInitials(contact.name)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{contact.name}</h1>
                  {(contact.organization || contact.role) && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {contact.role}{contact.role && contact.organization ? ' at ' : ''}{contact.organization}
                    </p>
                  )}
                </div>
                <button
                  onClick={startEdit}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                  title="Edit contact"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>

              {/* Email row */}
              {contact.email && (
                <div className="flex items-center gap-2 mt-2">
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {contact.email}
                  </a>
                  <button
                    onClick={copyEmail}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                    title="Copy email"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Badges row */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {contact.area && (
                  <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', areaColor(contact.area))}>
                    {contact.area}
                  </span>
                )}
                <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', engagement.color)}>
                  {engagement.label}
                </span>
                {contact.interaction_count > 0 && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    {contact.interaction_count} interaction{contact.interaction_count !== 1 ? 's' : ''}
                  </span>
                )}
                {daysAgo !== null && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Last interaction: {daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================
          2. Quick Action Bar (sticky)
          ============================ */}
      {!editing && (
        <div className="sticky top-0 z-20 bg-white rounded-xl border border-gray-100 shadow-sm p-3">
          <div className="flex items-center gap-2 flex-wrap">
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="px-3 py-2 bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-100 flex items-center gap-1.5 transition-colors"
                title="Send email"
              >
                <Mail className="w-3.5 h-3.5" />
                Email
              </a>
            )}

            <button
              onClick={() => runAgent('enrich_contact')}
              disabled={!!agentLoading}
              className="px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-medium hover:bg-purple-100 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
              title="AI Enrich"
            >
              {agentLoading === 'enrich_contact' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
              AI Enrich
            </button>

            <button
              onClick={() => runAgent('contact_intelligence')}
              disabled={!!agentLoading}
              className="px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-medium hover:bg-purple-100 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
              title="Intelligence"
            >
              {agentLoading === 'contact_intelligence' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Intelligence
            </button>

            <button
              onClick={() => runAgent('propose_next_email')}
              disabled={!!agentLoading}
              className="px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-medium hover:bg-purple-100 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
              title="Suggest Email"
            >
              {agentLoading === 'propose_next_email' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              Suggest Email
            </button>

            <div className="relative">
              <button
                onClick={() => setShowLinkDropdown(!showLinkDropdown)}
                className="px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium hover:bg-blue-100 flex items-center gap-1.5 transition-colors"
                title="Link Topic"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                Link Topic
              </button>
            </div>

            {contact.email && (
              <button
                onClick={copyEmail}
                className="px-3 py-2 bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-100 flex items-center gap-1.5 transition-colors"
                title="Copy email"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy
              </button>
            )}

            <div className="flex-1" />

            <button
              onClick={deleteContact}
              className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100 flex items-center gap-1.5 transition-colors"
              title="Delete contact"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </div>
      )}

      {/* ============================
          6. Link Topic Dropdown
          ============================ */}
      {showLinkDropdown && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-blue-500" />
              Link a Topic
            </h3>
            <button onClick={() => setShowLinkDropdown(false)} className="p-1 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={linkSearchQuery}
                onChange={e => setLinkSearchQuery(e.target.value)}
                placeholder="Search topics..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <input
              value={linkRole}
              onChange={e => setLinkRole(e.target.value)}
              placeholder="Role (optional)"
              className="w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1">
            {filteredLinkTopics.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No matching topics found.</p>
            ) : (
              filteredLinkTopics.map(topic => (
                <div
                  key={topic.id}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', areaColor(topic.area))}>
                      {topic.area}
                    </span>
                    <span className="text-sm text-gray-900 truncate">{topic.title}</span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', statusColor(topic.status))}>
                      {topic.status}
                    </span>
                  </div>
                  <button
                    onClick={() => linkTopic(topic.id)}
                    disabled={linkingTopic}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 flex-shrink-0 flex items-center gap-1"
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
        <div className="bg-white rounded-xl border border-purple-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-purple-50 to-purple-100/50 px-5 py-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-purple-800 flex items-center gap-2">
              <Brain className="w-4 h-4" />
              AI Enriched Profile
            </h3>
            <button onClick={() => setShowEnriched(false)} className="p-1 text-purple-400 hover:text-purple-600">
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
                    <div className="p-3 bg-purple-50/50 rounded-lg">
                      <p className="text-xs font-medium text-purple-600 mb-1 flex items-center gap-1">
                        <Building className="w-3 h-3" /> Organization
                      </p>
                      <p className="text-sm text-gray-900">{org}</p>
                    </div>
                  )}
                  {rl && (
                    <div className="p-3 bg-purple-50/50 rounded-lg">
                      <p className="text-xs font-medium text-purple-600 mb-1 flex items-center gap-1">
                        <User className="w-3 h-3" /> Role
                      </p>
                      <p className="text-sm text-gray-900">{rl}</p>
                    </div>
                  )}
                  {freq && (
                    <div className="p-3 bg-purple-50/50 rounded-lg">
                      <p className="text-xs font-medium text-purple-600 mb-1 flex items-center gap-1">
                        <Activity className="w-3 h-3" /> Frequency
                      </p>
                      <p className="text-sm text-gray-900">{freq}</p>
                    </div>
                  )}
                  {keyTopics.length > 0 && (
                    <div className="p-3 bg-purple-50/50 rounded-lg md:col-span-2 lg:col-span-1">
                      <p className="text-xs font-medium text-purple-600 mb-1.5 flex items-center gap-1">
                        <Tag className="w-3 h-3" /> Key Topics
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {keyTopics.map((t, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {relSummary && (
                    <div className="p-3 bg-purple-50/50 rounded-lg md:col-span-2 lg:col-span-3">
                      <p className="text-xs font-medium text-purple-600 mb-1 flex items-center gap-1">
                        <Heart className="w-3 h-3" /> Relationship Summary
                      </p>
                      <p className="text-sm text-gray-700 leading-relaxed">{relSummary}</p>
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
          <div className="bg-white rounded-xl border border-purple-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-purple-50 to-purple-100/50 px-5 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-purple-800 flex items-center gap-2">
                <Wand2 className="w-4 h-4" />
                Suggested Email
                {esUrgency && (
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-medium',
                    esUrgency === 'high' ? 'bg-red-100 text-red-700' :
                    esUrgency === 'medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-green-100 text-green-700'
                  )}>
                    {esUrgency.charAt(0).toUpperCase() + esUrgency.slice(1)} urgency
                  </span>
                )}
              </h3>
              <button onClick={() => setShowEmailSuggestion(false)} className="p-1 text-purple-400 hover:text-purple-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {esSubject && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Subject</p>
                  <p className="text-sm font-semibold text-gray-900">{esSubject}</p>
                </div>
              )}
              {esKeyPoints.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">Key Points</p>
                  <ul className="space-y-1">
                    {esKeyPoints.map((point, i) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-purple-500 mt-0.5">&#8226;</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {esBody && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Draft Body</p>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border border-gray-100">
                    {esBody}
                  </div>
                </div>
              )}
              {contact.email && (
                <a
                  href={`mailto:${contact.email}?subject=${encodeURIComponent(esSubject || '')}&body=${encodeURIComponent(esBody || '')}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Open in Email
                </a>
              )}
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
        return (
          <div className="bg-white rounded-xl border border-purple-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-purple-50 to-purple-100/50 px-5 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-purple-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Contact Intelligence
              </h3>
              <button onClick={() => setShowIntelligence(false)} className="p-1 text-purple-400 hover:text-purple-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              {/* Relationship Health Gauge */}
              {healthScore !== null && (
                <div className="flex items-center gap-6">
                  <div className="relative w-24 h-24 flex-shrink-0">
                    <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                      <circle
                        cx="50" cy="50" r="40"
                        fill="none"
                        stroke={healthScore >= 70 ? '#22c55e' : healthScore >= 40 ? '#f59e0b' : '#ef4444'}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${healthScore * 2.51} 251`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-gray-900">{healthScore}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Relationship Health</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {healthScore >= 70 ? 'Strong relationship' : healthScore >= 40 ? 'Needs attention' : 'At risk'}
                    </p>
                  </div>
                </div>
              )}

              {/* Communication Pattern */}
              {commPattern && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Communication Pattern
                  </p>
                  <p className="text-sm text-gray-700">{commPattern}</p>
                </div>
              )}

              {/* Sentiment */}
              {sentimentVal && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                    <Heart className="w-3 h-3" /> Sentiment
                  </p>
                  <p className="text-sm text-gray-700">{sentimentVal}</p>
                </div>
              )}

              {/* Key Themes */}
              {keyThemes.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Key Themes
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {keyThemes.map((theme, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Recommendations */}
              {recs.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                    <Target className="w-3 h-3" /> Action Recommendations
                  </p>
                  <ul className="space-y-1.5">
                    {recs.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <div className="w-4 h-4 mt-0.5 flex-shrink-0 rounded border border-purple-300 flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-purple-400" />
                        </div>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ============================
          4. Pending Topics Section
          ============================ */}
      {pendingTopics.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <button
            onClick={() => setShowPendingTopics(!showPendingTopics)}
            className="w-full px-5 py-4 flex items-center justify-between text-left"
          >
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Pending Topics
              <span className="text-xs text-gray-400 font-normal ml-1">({pendingTopics.length})</span>
            </h2>
            {showPendingTopics ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {showPendingTopics && (
            <div className="px-5 pb-4 space-y-2">
              {pendingTopics.map(link => {
                const topic = link.topics;
                if (!topic) return null;
                const dueDate = topic.due_date ? new Date(topic.due_date) : null;
                const isOverdue = dueDate ? dueDate < new Date() : false;
                const overdueDays = dueDate ? Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                const priority = topic.priority ?? 0;

                return (
                  <div key={link.topic_id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/topics/${link.topic_id}`}
                          className="text-sm font-medium text-gray-900 hover:text-blue-600 truncate transition-colors"
                        >
                          {topic.title}
                        </Link>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full', statusColor(topic.status))}>
                          {topic.status}
                        </span>
                        {topic.area && (
                          <span className={cn('text-xs px-2 py-0.5 rounded-full', areaColor(topic.area))}>
                            {topic.area}
                          </span>
                        )}
                        {isOverdue && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Overdue by {overdueDays} day{overdueDays !== 1 ? 's' : ''}
                          </span>
                        )}
                        {priority >= 4 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                            Urgent
                          </span>
                        )}
                        {priority === 3 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                            High
                          </span>
                        )}
                      </div>
                      {dueDate && !isOverdue && (
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Due {formatShortDate(topic.due_date!)}
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/topics/${link.topic_id}`}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors flex-shrink-0"
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
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <button
          onClick={() => setShowAllTopics(!showAllTopics)}
          className="w-full px-5 py-4 flex items-center justify-between text-left"
        >
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-blue-500" />
            Related Topics
            <span className="text-xs text-gray-400 font-normal ml-1">({topicLinks.length})</span>
          </h2>
          {showAllTopics ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {showAllTopics && (
          <div className="px-5 pb-4">
            {topicLinks.length === 0 ? (
              <div className="text-center py-8">
                <LinkIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No topics linked. Use the Link Topic button above.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {topicLinks.map(link => {
                  const topic = link.topics;
                  if (!topic) return null;

                  return (
                    <div key={link.topic_id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-gray-50 transition-colors group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/topics/${link.topic_id}`}
                            className="text-sm font-medium text-gray-900 hover:text-blue-600 truncate transition-colors"
                          >
                            {topic.title}
                          </Link>
                          <span className={cn('text-xs px-2 py-0.5 rounded-full', statusColor(topic.status))}>
                            {topic.status || 'active'}
                          </span>
                          {topic.area && (
                            <span className={cn('text-xs px-2 py-0.5 rounded-full', areaColor(topic.area))}>
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
                                className="w-32 px-2 py-0.5 border border-blue-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 w-40">
                                  {ROLE_OPTIONS.map(option => (
                                    <button
                                      key={option}
                                      onClick={() => {
                                        setRoleEditValue(option);
                                        updateTopicRole(link.topic_id, option);
                                      }}
                                      className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
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
                                'text-xs px-2 py-0.5 rounded-full cursor-pointer transition-colors',
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
                          <div className="flex gap-1 mt-1.5">
                            {topic.tags.map((tag, i) => (
                              <span key={i} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          href={`/topics/${link.topic_id}`}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
                          title="Open topic"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => unlinkTopic(link.topic_id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
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
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <button
          onClick={() => setShowTimeline(!showTimeline)}
          className="w-full px-5 py-4 flex items-center justify-between text-left"
        >
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            Communication History
            <span className="text-xs text-gray-400 font-normal ml-1">({relatedItems.length})</span>
          </h2>
          {showTimeline ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {showTimeline && (
          <div className="px-5 pb-4">
            {relatedItems.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No communication history found for this contact.</p>
              </div>
            ) : (() => {
              let displayedCount = 0;
              const totalCount = relatedItems.length;
              const maxDisplay = timelineDisplayCount;

              return (
                <div className="space-y-5">
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
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{groupName}</h3>
                        <div className="space-y-2">
                          {itemsToShow.map((item, idx) => {
                            const itemSource = (item.source as string) || 'manual';
                            const itemTitle = (item.title as string) || 'Untitled';
                            const itemSnippet = (item.snippet as string) || '';
                            const truncatedSnippet = itemSnippet.length > 100 ? itemSnippet.slice(0, 100) + '...' : itemSnippet;
                            const itemDate = (item.occurred_at || item.created_at) as string;
                            const itemUrl = item.url as string | undefined;
                            const itemMeta = (item.metadata || {}) as Record<string, unknown>;
                            const topicId = item.topic_id as string | undefined;
                            const metaFrom = itemMeta.from as string | undefined;
                            const metaTo = itemMeta.to as string | undefined;
                            const metaChannel = itemMeta.channel as string | undefined;
                            const metaLocation = itemMeta.location as string | undefined;

                            return (
                              <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-gray-50 transition-colors">
                                <div className="flex-shrink-0 mt-0.5" title={itemSource}>
                                  <SourceIcon source={itemSource} className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      {itemUrl ? (
                                        <a href={itemUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-900 hover:text-blue-600 truncate block transition-colors">
                                          {itemTitle}
                                        </a>
                                      ) : (
                                        <p className="text-sm font-medium text-gray-900 truncate">{itemTitle}</p>
                                      )}
                                      {truncatedSnippet && (
                                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{truncatedSnippet}</p>
                                      )}
                                      {/* Metadata details */}
                                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                        {metaFrom && (
                                          <span className="text-xs text-gray-400">From: {metaFrom}</span>
                                        )}
                                        {metaTo && (
                                          <span className="text-xs text-gray-400">To: {metaTo}</span>
                                        )}
                                        {metaChannel && (
                                          <span className="text-xs text-gray-400">#{metaChannel}</span>
                                        )}
                                        {metaLocation && (
                                          <span className="text-xs text-gray-400 flex items-center gap-0.5">
                                            <MapPin className="w-3 h-3" />{metaLocation}
                                          </span>
                                        )}
                                        {topicId && (
                                          <Link
                                            href={`/topics/${topicId}`}
                                            className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5"
                                          >
                                            <ExternalLink className="w-3 h-3" /> Topic
                                          </Link>
                                        )}
                                      </div>
                                    </div>
                                    <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
                                      {formatRelativeDate(itemDate)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {totalCount > maxDisplay && (
                    <button
                      onClick={() => setTimelineDisplayCount(prev => prev + 20)}
                      className="w-full py-2.5 text-sm text-blue-600 font-medium hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors text-center"
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
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4 text-gray-500" />
              Extended Info
            </h2>
            <div className="space-y-2.5">
              {extPhone && (
                <div className="flex items-center gap-2.5 text-sm text-gray-700">
                  <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span>{extPhone}</span>
                </div>
              )}
              {extLinkedin && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <a
                    href={extLinkedin.startsWith('http') ? extLinkedin : `https://${extLinkedin}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {extLinkedin}
                  </a>
                </div>
              )}
              {extTwitter && (
                <div className="flex items-center gap-2.5 text-sm">
                  <MessageSquare className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <a
                    href={extTwitter.startsWith('http') ? extTwitter : `https://x.com/${extTwitter.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {extTwitter}
                  </a>
                </div>
              )}
              {extTimezone && (
                <div className="flex items-center gap-2.5 text-sm text-gray-700">
                  <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span>{extTimezone}</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ============================
          10. Notes Section
          ============================ */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-amber-500" />
          Notes
        </h2>
        {contact.notes ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{contact.notes}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">No notes. Click edit to add some.</p>
        )}
      </div>

      {/* ============================
          Footer info
          ============================ */}
      <div className="text-center text-xs text-gray-400 space-x-3">
        <span>Created {formatShortDate(contact.created_at)}</span>
        <span>&middot;</span>
        <span>Updated {formatRelativeDate(contact.updated_at)}</span>
      </div>
    </div>
  );
}
