'use client';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn, formatRelativeDate, formatSmartDate } from '@/lib/utils';
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
  Flame,
  CalendarDays,
  Star,
  Plus,
  Scroll,
  FileText,
  ChevronRight,
  MessageCircle,
  Briefcase,
  ClipboardList,
  Database,
  BookOpen,
} from 'lucide-react';
import { SourceIconCircle, getSourceLabel, getSourceBorderColor } from '@/components/ui/source-icon';

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
  is_favorite?: boolean;
  last_interaction_at: string | null;
  interaction_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  contact_topic_links?: ContactTopicLink[];
}

interface ContactItemData {
  id: string;
  contact_id: string;
  source: string;
  title: string;
  snippet: string;
  body: string | null;
  url: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface MeetingPrepData {
  relationship_summary?: string;
  suggested_agenda?: string[];
  talking_points?: string[];
  pending_items?: Array<{ item: string; topic: string }>;
  preparation_notes?: string;
  recent_topics?: string[];
}

interface PendingItemData {
  task: string;
  topic: string;
  priority: string;
  source: string;
  status: string;
  context: string;
}

interface ContactDetailProps {
  contact: ContactData;
  relatedItems: Record<string, unknown>[];
  allTopics: Array<{ id: string; title: string; status: string; area: string }>;
  initialContactItems?: ContactItemData[];
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

const getInteractionFrequency = (interactionCount: number, createdAt: string): string | null => {
  if (interactionCount === 0) return null;
  const daysSinceCreated = Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)));
  const monthsSinceCreated = daysSinceCreated / 30;
  if (monthsSinceCreated < 1) {
    // Less than a month old - show weekly rate
    const weeklyRate = interactionCount / (daysSinceCreated / 7);
    if (weeklyRate >= 5) return 'Daily contact';
    if (weeklyRate >= 1) return `~${Math.round(weeklyRate)}/week`;
    return `${interactionCount} so far`;
  }
  const monthlyRate = interactionCount / monthsSinceCreated;
  if (monthlyRate >= 20) return 'Daily contact';
  if (monthlyRate >= 4) return 'Weekly contact';
  if (monthlyRate >= 1) return `~${Math.round(monthlyRate)} interactions/month`;
  return `~${Math.round(interactionCount / Math.max(1, monthsSinceCreated))} interactions/month`;
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

export function ContactDetail({ contact: initialContact, relatedItems, allTopics, initialContactItems = [] }: ContactDetailProps) {
  const router = useRouter();
  const [contact, setContact] = useState(initialContact);

  // Favorite state
  const [isFavorite, setIsFavorite] = useState(initialContact.is_favorite ?? false);
  const [togglingFav, setTogglingFav] = useState(false);

  // Contact items state (direct attachments)
  const [contactItems, setContactItems] = useState<ContactItemData[]>(initialContactItems);
  const [showContactItems, setShowContactItems] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemSource, setAddItemSource] = useState<'manual' | 'document' | 'link' | 'notion'>('manual');
  const [addItemTitle, setAddItemTitle] = useState('');
  const [addItemBody, setAddItemBody] = useState('');
  const [addItemUrl, setAddItemUrl] = useState('');
  const [savingItem, setSavingItem] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemTitle, setEditItemTitle] = useState('');
  const [editItemBody, setEditItemBody] = useState('');

  // Knowledge Base state
  const [showKB, setShowKB] = useState(false);
  const [kbItems, setKbItems] = useState<Array<Record<string, unknown>>>([]);
  const [kbLoading, setKbLoading] = useState(false);
  const [kbLoaded, setKbLoaded] = useState(false);
  const [kbSourceFilter, setKbSourceFilter] = useState('');
  const [kbSearch, setKbSearch] = useState('');
  const [kbStats, setKbStats] = useState<Record<string, unknown> | null>(null);

  // AI Assistant state
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [meetingPrep, setMeetingPrep] = useState<MeetingPrepData | null>(null);
  const [pendingItems, setPendingItems] = useState<PendingItemData[] | null>(null);
  const [dossier, setDossier] = useState<string | null>(null);
  const [deepAnalysis, setDeepAnalysis] = useState<{ analysis_type: string; items: Record<string, unknown>[] } | null>(null);

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
  const [editTags, setEditTags] = useState('');
  const [editContactMethod, setEditContactMethod] = useState('');
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

  // Review Recent Activity state
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewResults, setReviewResults] = useState<Array<{
    external_id: string; source: string; source_account_id: string;
    title: string; snippet: string; url: string; occurred_at: string;
    metadata: Record<string, unknown>;
    ai_confidence?: number | null; ai_reason?: string | null; already_linked?: boolean;
  }>>([]);
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [reviewTimePeriod, setReviewTimePeriod] = useState<'15d' | '1m' | '3m'>('1m');
  const [selectedReviewResults, setSelectedReviewResults] = useState<Set<string>>(new Set());
  const [reviewLinkTopicId, setReviewLinkTopicId] = useState<string | null>(null);
  const [reviewLinking, setReviewLinking] = useState(false);

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

  // Copy email tooltip state
  const [emailCopied, setEmailCopied] = useState(false);

  // Quick note state
  const [quickNote, setQuickNote] = useState('');
  const [savingQuickNote, setSavingQuickNote] = useState(false);

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

  const sortedTopicLinks = useMemo(() => {
    return [...topicLinks].sort((a, b) => {
      // Overdue items first
      const now = new Date();
      const aDue = a.topics?.due_date ? new Date(a.topics.due_date) : null;
      const bDue = b.topics?.due_date ? new Date(b.topics.due_date) : null;
      const aOverdue = aDue && aDue < now ? 1 : 0;
      const bOverdue = bDue && bDue < now ? 1 : 0;
      if (aOverdue !== bOverdue) return bOverdue - aOverdue;
      // Then by priority descending
      const aPriority = a.topics?.priority ?? 0;
      const bPriority = b.topics?.priority ?? 0;
      if (aPriority !== bPriority) return bPriority - aPriority;
      // Then by due date ascending (soonest first)
      if (aDue && bDue) return aDue.getTime() - bDue.getTime();
      if (aDue) return -1;
      if (bDue) return 1;
      return 0;
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
  const interactionFrequency = getInteractionFrequency(contact.interaction_count, contact.created_at);

  // ============================
  // Actions
  // ============================

  const copyEmail = async () => {
    if (!contact.email) return;
    try {
      await navigator.clipboard.writeText(contact.email);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 1500);
      toast.success('Email copied');
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
    const metaTags = meta.tags;
    setEditTags(Array.isArray(metaTags) ? (metaTags as string[]).join(', ') : '');
    setEditContactMethod((meta.preferred_contact_method as string) || '');
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
      const parsedTags = editTags.split(',').map(t => t.trim()).filter(Boolean);
      if (parsedTags.length > 0) metadata.tags = parsedTags;
      else delete metadata.tags;
      if (editContactMethod.trim()) metadata.preferred_contact_method = editContactMethod.trim();
      else delete metadata.preferred_contact_method;

      const payload = {
        name: editName.trim(),
        email: editEmail.trim() || null,
        organization: editOrganization.trim() || null,
        role: editRole.trim() || null,
        area: editArea || null,
        notes: editNotes.trim() || null,
        metadata,
      };
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Contact save failed:', data.error, 'Payload:', payload);
        throw new Error(data.error || 'Save failed');
      }
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
        toast.success('Contact saved');
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

  // Quick note: prepend timestamped note
  const saveQuickNote = useCallback(async () => {
    const text = quickNote.trim();
    if (!text) return;
    setSavingQuickNote(true);
    const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const newNote = `[${timestamp}] ${text}`;
    const updatedNotes = contact.notes ? `${newNote}\n${contact.notes}` : newNote;
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: updatedNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setContact(prev => ({ ...prev, notes: updatedNotes, ...data.contact, contact_topic_links: prev.contact_topic_links }));
      setInlineNotes(updatedNotes);
      setQuickNote('');
      setLastSavedAt(new Date());
      toast.success('Quick note added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save quick note');
    }
    setSavingQuickNote(false);
  }, [quickNote, contact.notes, contact.id]);

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
          toast.success('Contact enriched');
          break;
        case 'contact_intelligence':
          setIntelligence(data.result);
          setShowIntelligence(true);
          toast.success('Intelligence report ready');
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

  // Review Recent Activity
  const handleReviewActivity = async () => {
    setReviewLoading(true);
    setReviewResults([]);
    setShowReviewPanel(true);
    try {
      const res = await fetch('/api/ai/review-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: contact.id,
          time_period: reviewTimePeriod,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReviewResults(data.results ?? []);
      setSelectedReviewResults(new Set());
      const periodLabel = reviewTimePeriod === '15d' ? '15 days' : reviewTimePeriod === '1m' ? 'month' : '3 months';
      toast.success(`Found ${data.results?.length || 0} items from the last ${periodLabel}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Review failed');
    }
    setReviewLoading(false);
  };

  const toggleReviewResult = (key: string) => {
    setSelectedReviewResults(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const selectAllReview = () => {
    const linkable = reviewResults.filter(r => !r.already_linked);
    if (selectedReviewResults.size === linkable.length) {
      setSelectedReviewResults(new Set());
    } else {
      setSelectedReviewResults(new Set(linkable.map(r => r.source + ':' + r.external_id)));
    }
  };

  const linkSelectedReviewToTopic = async () => {
    if (!reviewLinkTopicId || selectedReviewResults.size === 0) return;
    setReviewLinking(true);
    let linked = 0;
    for (const result of reviewResults) {
      const key = result.source + ':' + result.external_id;
      if (!selectedReviewResults.has(key) || result.already_linked) continue;
      try {
        const res = await fetch(`/api/topics/${reviewLinkTopicId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            external_id: result.external_id,
            source: result.source,
            source_account_id: result.source_account_id,
            title: result.title,
            snippet: result.snippet || '',
            url: result.url || '',
            occurred_at: result.occurred_at,
            metadata: result.metadata || {},
            linked_by: 'ai_review',
          }),
        });
        if (res.ok) linked++;
      } catch { /* continue */ }
    }
    if (linked > 0) {
      toast.success(`Linked ${linked} item${linked > 1 ? 's' : ''} to topic`);
      // Mark results as linked
      setReviewResults(prev => prev.map(r => {
        const key = r.source + ':' + r.external_id;
        if (selectedReviewResults.has(key)) return { ...r, already_linked: true };
        return r;
      }));
      setSelectedReviewResults(new Set());
    }
    setReviewLinking(false);
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

  // Favorite toggle
  const toggleFavorite = async () => {
    const newVal = !isFavorite;
    setIsFavorite(newVal);
    setTogglingFav(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorite: newVal }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(newVal ? 'Added to favorites' : 'Removed from favorites');
    } catch {
      setIsFavorite(!newVal);
      toast.error('Failed to update favorite');
    }
    setTogglingFav(false);
  };

  // Contact items CRUD
  const addContactItem = async () => {
    if (!addItemTitle.trim()) { toast.error('Title is required'); return; }
    setSavingItem(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: addItemSource,
          title: addItemTitle.trim(),
          body: addItemBody.trim() || null,
          url: addItemUrl.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setContactItems(prev => [data.item, ...prev]);
      setAddItemTitle('');
      setAddItemBody('');
      setAddItemUrl('');
      setShowAddItem(false);
      toast.success('Item added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add item');
    }
    setSavingItem(false);
  };

  const deleteContactItem = async (itemId: string) => {
    if (!confirm('Delete this item?')) return;
    try {
      const res = await fetch(`/api/contacts/${contact.id}/items/${itemId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      setContactItems(prev => prev.filter(i => i.id !== itemId));
      toast.success('Item deleted');
    } catch { toast.error('Failed to delete item'); }
  };

  const saveEditItem = async (itemId: string) => {
    try {
      const res = await fetch(`/api/contacts/${contact.id}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editItemTitle.trim(), body: editItemBody.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setContactItems(prev => prev.map(i => i.id === itemId ? { ...i, ...data.item } : i));
      setEditingItemId(null);
      toast.success('Item updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  // Knowledge Base loader
  const loadKnowledgeBase = async () => {
    if (kbLoaded) return;
    setKbLoading(true);
    try {
      const params = new URLSearchParams();
      if (kbSourceFilter) params.set('source', kbSourceFilter);
      if (kbSearch) params.set('search', kbSearch);
      const res = await fetch(`/api/contacts/${contact.id}/knowledge-base?${params}`);
      const data = await res.json();
      if (res.ok) {
        setKbItems(data.allItems || []);
        setKbStats(data.stats || null);
        setKbLoaded(true);
      }
    } catch { toast.error('Failed to load knowledge base'); }
    setKbLoading(false);
  };

  // AI Assistant actions
  const askAI = async () => {
    if (!aiQuestion.trim()) return;
    setAiLoading('ask');
    setAiAnswer(null);
    try {
      const res = await fetch('/api/ai/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'contact_ask', context: { contact_id: contact.id, question: aiQuestion } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAiAnswer(data.result.answer);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'AI failed'); }
    setAiLoading(null);
  };

  const runMeetingPrep = async () => {
    setAiLoading('meeting_prep');
    setMeetingPrep(null);
    try {
      const res = await fetch('/api/ai/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'contact_meeting_prep', context: { contact_id: contact.id } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMeetingPrep(data.result as MeetingPrepData);
      toast.success('Meeting prep ready');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'AI failed'); }
    setAiLoading(null);
  };

  const runPendingItems = async () => {
    setAiLoading('pending_items');
    setPendingItems(null);
    try {
      const res = await fetch('/api/ai/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'contact_pending_items', context: { contact_id: contact.id } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPendingItems((data.result.pending_items || []) as PendingItemData[]);
      toast.success(`${data.result.pending_items?.length || 0} pending items found`);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'AI failed'); }
    setAiLoading(null);
  };

  const runDossier = async () => {
    setAiLoading('dossier');
    setDossier(null);
    try {
      const res = await fetch('/api/ai/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'contact_dossier', context: { contact_id: contact.id } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDossier(data.result.dossier);
      toast.success('Dossier generated');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'AI failed'); }
    setAiLoading(null);
  };

  const runDeepAnalysis = async (analysisType: string, timeFilter?: string) => {
    setAiLoading('deep_' + analysisType);
    setDeepAnalysis(null);
    try {
      const res = await fetch('/api/ai/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'contact_deep_analysis', context: { contact_id: contact.id, analysis_type: analysisType, time_filter: timeFilter } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDeepAnalysis(data.result as { analysis_type: string; items: Record<string, unknown>[] });
      toast.success(`Found ${data.result.items?.length || 0} items`);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'AI failed'); }
    setAiLoading(null);
  };

  // Simple markdown renderer for AI responses
  const renderMd = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('## ')) return <h3 key={i} className="font-bold text-gray-900 mt-4 mb-1.5 text-sm">{line.replace('## ', '')}</h3>;
      if (line.startsWith('# ')) return <h2 key={i} className="font-bold text-gray-900 mt-3 mb-1 text-base">{line.replace('# ', '')}</h2>;
      if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 text-sm text-gray-700 mt-0.5 list-disc">{line.slice(2)}</li>;
      if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold text-gray-800 mt-2 text-sm">{line.replace(/\*\*/g, '')}</p>;
      if (line.trim() === '') return <br key={i} />;
      return <p key={i} className="text-sm text-gray-700 mt-1">{line}</p>;
    });
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
                  <div className="relative">
                    <input
                      value={editTags}
                      onChange={e => setEditTags(e.target.value)}
                      className="peer w-full px-3.5 pt-5 pb-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-shadow placeholder-transparent"
                      placeholder="e.g. vip, vendor, mentor"
                      id="edit-tags"
                    />
                    <label
                      htmlFor="edit-tags"
                      className="absolute left-3.5 top-1.5 text-[10px] font-semibold text-blue-600 flex items-center gap-1 pointer-events-none transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-xs peer-placeholder-shown:text-gray-400 peer-placeholder-shown:font-medium peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:text-blue-600"
                    >
                      <Tag className="w-3 h-3" /> Tags (comma-separated)
                    </label>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-blue-600 mb-1 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> Preferred Contact
                    </label>
                    <select
                      value={editContactMethod}
                      onChange={e => setEditContactMethod(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-shadow bg-white"
                    >
                      <option value="">Not set</option>
                      <option value="Email">Email</option>
                      <option value="Phone">Phone</option>
                      <option value="Slack">Slack</option>
                      <option value="LinkedIn">LinkedIn</option>
                      <option value="In Person">In Person</option>
                    </select>
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
                      {interactionFrequency && (
                        <span className="text-xs text-gray-600 flex items-center gap-1.5 bg-gray-50 rounded-full px-3 py-1 border border-gray-100">
                          <TrendingUp className="w-3 h-3 text-gray-400" />
                          {interactionFrequency}
                        </span>
                      )}
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
                          className="group/copy relative p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-all"
                          title="Copy email"
                        >
                          {emailCopied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                          {emailCopied && (
                            <span className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gray-900 text-white text-[10px] rounded-md whitespace-nowrap z-30 animate-fade-in">
                              Copied!
                            </span>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={toggleFavorite}
                      disabled={togglingFav}
                      className={cn(
                        'p-2.5 rounded-xl border transition-all',
                        isFavorite
                          ? 'bg-amber-50 border-amber-200 text-amber-500 hover:bg-amber-100'
                          : 'bg-white border-gray-200 text-gray-300 hover:text-amber-400 hover:border-amber-200 hover:bg-amber-50'
                      )}
                      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Star className={cn('w-4 h-4', isFavorite && 'fill-amber-400')} />
                    </button>
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
            </div>
          )}
        </div>
      </div>

      {/* ============================
          1b. Quick Stats Bar
          ============================ */}
      <div className="grid grid-cols-4 gap-3 animate-fade-in">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
          <p className="text-lg font-bold text-blue-600">{contact.interaction_count}</p>
          <p className="text-[11px] text-gray-500 font-medium mt-0.5">Interactions</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
          <p className="text-lg font-bold text-purple-600">{topicLinks.length}</p>
          <p className="text-[11px] text-gray-500 font-medium mt-0.5">Topics linked</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
          <p className="text-lg font-bold text-amber-600">{daysAgo !== null ? daysAgo : '--'}</p>
          <p className="text-[11px] text-gray-500 font-medium mt-0.5">Days since last</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${engagement.dotColor}`} />
            <p className={`text-sm font-bold ${
              engagement.label === 'Active' ? 'text-green-600' :
              engagement.label === 'Recent' ? 'text-blue-600' :
              engagement.label === 'Idle' ? 'text-amber-600' :
              engagement.label === 'Cold' ? 'text-red-600' :
              'text-gray-500'
            }`}>{engagement.label}</p>
          </div>
          <p className="text-[11px] text-gray-500 font-medium mt-0.5">Activity level</p>
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

            <button
              onClick={handleReviewActivity}
              disabled={!!agentLoading || reviewLoading}
              className="group relative px-3 py-2 text-teal-700 rounded-xl text-xs font-semibold hover:bg-teal-50 disabled:opacity-50 flex items-center gap-1.5 transition-all"
            >
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)' }}>
                {reviewLoading ? <Loader2 className="w-3 h-3 animate-spin text-white" /> : <Activity className="w-3 h-3 text-white" />}
              </div>
              Review
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30">
                Find recent items mentioning this contact
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
          Review Recent Activity Panel
          ============================ */}
      {showReviewPanel && (
        <div className="animate-fade-in bg-white rounded-2xl border border-teal-200 shadow-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-teal-100 bg-gradient-to-r from-teal-50/50 to-cyan-50/30">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)' }}>
                  <Activity className="w-3.5 h-3.5 text-white" />
                </div>
                Review Recent Activity
                {reviewLoading && <Loader2 className="w-4 h-4 animate-spin text-teal-500" />}
              </h3>
              <button onClick={() => setShowReviewPanel(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Find recent items involving {contact.name} that aren&apos;t linked yet</p>
          </div>
          <div className="px-5 py-3 space-y-3 border-b border-teal-100/50">
            {/* Time period + Scan */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Period:</span>
              {(['15d', '1m', '3m'] as const).map(period => (
                <button
                  key={period}
                  onClick={() => setReviewTimePeriod(period)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    reviewTimePeriod === period
                      ? 'bg-teal-50 text-teal-700 border-teal-300 shadow-sm'
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {period === '15d' ? '15 days' : period === '1m' ? '1 month' : '3 months'}
                </button>
              ))}
              <div className="flex-1" />
              <button onClick={handleReviewActivity} disabled={reviewLoading}
                className="px-4 py-1.5 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-lg text-xs font-medium hover:from-teal-700 hover:to-cyan-700 disabled:opacity-50 flex items-center gap-1.5 transition-all shadow-sm">
                {reviewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                {reviewLoading ? 'Scanning...' : 'Scan'}
              </button>
            </div>
          </div>

          {/* Results */}
          {reviewResults.length === 0 && !reviewLoading ? (
            <p className="px-5 py-8 text-center text-sm text-gray-500">
              {reviewResults.length === 0 ? 'Click Scan to search for recent items involving this contact' : 'No unlinked items found — this contact appears up to date!'}
            </p>
          ) : reviewLoading ? (
            <div className="px-5 py-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-teal-500 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Scanning sources for {contact.name}...</p>
            </div>
          ) : (
            <>
              {/* Header with select all + link controls */}
              <div className="px-5 py-2.5 flex items-center justify-between bg-teal-50/30 border-b border-teal-100/50">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-gray-600">{reviewResults.length} results</span>
                  {reviewResults.filter(r => !r.already_linked).length > 0 && (
                    <button onClick={selectAllReview}
                      className="text-xs text-teal-600 hover:text-teal-800 flex items-center gap-1 transition-colors">
                      {selectedReviewResults.size === reviewResults.filter(r => !r.already_linked).length
                        ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </div>
                {selectedReviewResults.size > 0 && (
                  <div className="flex items-center gap-2">
                    <select
                      value={reviewLinkTopicId || ''}
                      onChange={e => setReviewLinkTopicId(e.target.value || null)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 max-w-[200px]"
                    >
                      <option value="">Link to topic...</option>
                      {(topicLinks || []).map((ct: ContactTopicLink) => (
                        <option key={ct.topic_id} value={ct.topic_id}>
                          {ct.topics?.title || ct.topic_id}
                        </option>
                      ))}
                    </select>
                    <button onClick={linkSelectedReviewToTopic} disabled={reviewLinking || !reviewLinkTopicId}
                      className="px-3 py-1.5 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-lg text-xs font-medium hover:from-teal-700 hover:to-cyan-700 disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition-all">
                      {reviewLinking ? <Loader2 className="w-3 h-3 animate-spin" /> : <LinkIcon className="w-3 h-3" />}
                      Link {selectedReviewResults.size}
                    </button>
                  </div>
                )}
              </div>
              {/* Results list */}
              <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
                {reviewResults.map((item) => {
                  const key = item.source + ':' + item.external_id;
                  const confidencePercent = item.ai_confidence != null ? Math.round(item.ai_confidence * 100) : null;
                  return (
                    <div key={key} className={`px-5 py-3.5 flex items-start gap-3 transition-colors ${item.already_linked ? 'opacity-50 bg-gray-50' : 'hover:bg-teal-50/20'}`}>
                      {!item.already_linked ? (
                        <input type="checkbox" checked={selectedReviewResults.has(key)}
                          onChange={() => toggleReviewResult(key)}
                          className="mt-1 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                      ) : (
                        <span className="mt-1 text-green-500 text-xs font-semibold flex items-center gap-0.5">
                          <Check className="w-3 h-3" /> Linked
                        </span>
                      )}
                      <SourceIconCircle source={item.source} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{item.snippet}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
                          <span className="text-[10px] font-medium text-gray-500">{getSourceLabel(item.source)}</span>
                          <span>{formatRelativeDate(item.occurred_at)}</span>
                          {confidencePercent != null && (
                            <span className={`text-[10px] font-bold ${confidencePercent >= 80 ? 'text-green-600' : confidencePercent >= 50 ? 'text-amber-600' : 'text-gray-500'}`}>
                              {confidencePercent}% match
                            </span>
                          )}
                        </div>
                        {item.ai_reason && (
                          <p className="text-xs text-teal-600 mt-1 italic bg-teal-50/50 px-2 py-1 rounded">{item.ai_reason}</p>
                        )}
                      </div>
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors" title="Open in source">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
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
                {sortedTopicLinks.map(link => {
                  const topic = link.topics;
                  if (!topic) return null;
                  const isTopicOverdue = topic.due_date ? new Date(topic.due_date) < new Date() : false;
                  const isTopicActive = topic.status === 'active';
                  const topicPriority = topic.priority ?? 0;
                  const topicDueDate = topic.due_date ? new Date(topic.due_date) : null;
                  const topicDueDaysAway = topicDueDate ? Math.ceil((topicDueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                  const isTopicUpcoming = topicDueDate && !isTopicOverdue && topicDueDaysAway !== null && topicDueDaysAway <= 7;
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
                          {/* Priority indicator */}
                          {topicPriority >= 4 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold flex items-center gap-0.5">
                              <Flame className="w-3 h-3" /> Urgent
                            </span>
                          )}
                          {topicPriority === 3 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center gap-0.5">
                              <Flame className="w-3 h-3" /> High
                            </span>
                          )}
                          {/* Due date indicators */}
                          {isTopicOverdue && topicDueDate && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold flex items-center gap-1 animate-pulse-dot">
                              <AlertTriangle className="w-3 h-3" />
                              {Math.abs(topicDueDaysAway!)}d overdue
                            </span>
                          )}
                          {isTopicUpcoming && topicDueDate && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold flex items-center gap-1">
                              <CalendarDays className="w-3 h-3" />
                              Due {formatShortDate(topic.due_date!)}
                            </span>
                          )}
                          {topicDueDate && !isTopicOverdue && !isTopicUpcoming && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 font-medium flex items-center gap-1">
                              <CalendarDays className="w-3 h-3" />
                              Due {formatShortDate(topic.due_date!)}
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
                                        <div className="flex items-center gap-1.5">
                                          {/* Source-colored inline icon */}
                                          <span
                                            className="inline-flex items-center justify-center w-4 h-4 rounded-full flex-shrink-0"
                                            style={{ background: sourceGradient }}
                                            title={itemSource}
                                          >
                                            <SourceIcon source={itemSource} className="w-2.5 h-2.5 text-white" />
                                          </span>
                                          {itemUrl ? (
                                            <a href={itemUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-gray-900 hover:text-blue-600 truncate transition-colors">
                                              {itemTitle}
                                            </a>
                                          ) : (
                                            <p className="text-sm font-semibold text-gray-900 truncate">{itemTitle}</p>
                                          )}
                                        </div>
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
        {/* Quick Note input */}
        {!editingNotes && (
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <input
                value={quickNote}
                onChange={e => setQuickNote(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && quickNote.trim()) {
                    e.preventDefault();
                    saveQuickNote();
                  }
                }}
                placeholder="Add a quick note..."
                className="flex-1 px-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-shadow placeholder:text-gray-400"
                disabled={savingQuickNote}
              />
              <button
                onClick={saveQuickNote}
                disabled={!quickNote.trim() || savingQuickNote}
                className="px-3.5 py-2 text-white rounded-xl text-xs font-semibold hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5 transition-all shadow-sm"
                style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)' }}
              >
                {savingQuickNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <StickyNote className="w-3 h-3" />}
                Add
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1 ml-1">Press Enter to add a timestamped note</p>
          </div>
        )}
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
          Items & Documents (Direct Contact Attachments)
          ============================ */}
      <div className="animate-fade-in bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowContactItems(!showContactItems)}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
              <Scroll className="w-4 h-4 text-orange-600" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-gray-900">Items & Documents</h3>
              <p className="text-xs text-gray-500">Notes, conversation logs, links & documents</p>
            </div>
            {contactItems.length > 0 && (
              <span className="text-[10px] font-medium bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{contactItems.length}</span>
            )}
          </div>
          {showContactItems ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {showContactItems && (
          <div className="px-4 pb-4 space-y-3">
            {/* Add Item Button & Form */}
            {!showAddItem ? (
              <button
                onClick={() => setShowAddItem(true)}
                className="w-full p-3 border border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:text-orange-600 hover:border-orange-300 hover:bg-orange-50/50 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add note, document, or link
              </button>
            ) : (
              <div className="p-4 border border-orange-200 bg-orange-50/30 rounded-xl space-y-3">
                {/* Source type tabs */}
                <div className="flex gap-1">
                  {([['manual', 'Note', StickyNote], ['document', 'Document', Scroll], ['link', 'Link', LinkIcon], ['notion', 'Notion', BookOpen]] as const).map(([src, label, Icon]) => (
                    <button
                      key={src}
                      onClick={() => setAddItemSource(src as 'manual' | 'document' | 'link' | 'notion')}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all',
                        addItemSource === src ? 'bg-orange-500 text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                      )}
                    >
                      <Icon className="w-3 h-3" />
                      {label}
                    </button>
                  ))}
                </div>

                <input
                  value={addItemTitle}
                  onChange={e => setAddItemTitle(e.target.value)}
                  placeholder={addItemSource === 'document' ? 'Document title (e.g., 1:1 Meeting Notes - Jan 2025)' : addItemSource === 'link' ? 'Link title' : 'Note title'}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400"
                />

                {(addItemSource === 'link' || addItemSource === 'notion') && (
                  <input
                    value={addItemUrl}
                    onChange={e => setAddItemUrl(e.target.value)}
                    placeholder={addItemSource === 'notion' ? 'Notion page URL' : 'URL'}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400"
                  />
                )}

                {(addItemSource === 'manual' || addItemSource === 'document') && (
                  <div>
                    <textarea
                      value={addItemBody}
                      onChange={e => setAddItemBody(e.target.value)}
                      placeholder={addItemSource === 'document'
                        ? 'Paste your conversation history, meeting notes, or any document here.\nMarkdown formatting is supported.\n\nTip: Use ## for headers, - for lists, **bold** for emphasis.'
                        : 'Write your note...'}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400 resize-y leading-relaxed"
                      rows={addItemSource === 'document' ? 10 : 4}
                    />
                    {addItemSource === 'document' && (
                      <p className="text-[10px] text-gray-400 mt-1">Markdown supported. Great for meeting agendas, conversation histories, and long-form notes.</p>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={addContactItem}
                    disabled={savingItem}
                    className="px-4 py-2 brand-gradient text-white rounded-xl text-xs font-semibold hover:opacity-90 flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                  >
                    {savingItem ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Add {addItemSource === 'document' ? 'Document' : addItemSource === 'link' ? 'Link' : addItemSource === 'notion' ? 'Notion Page' : 'Note'}
                  </button>
                  <button onClick={() => { setShowAddItem(false); setAddItemTitle(''); setAddItemBody(''); setAddItemUrl(''); }} className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Item cards */}
            {contactItems.length === 0 && !showAddItem && (
              <p className="text-xs text-gray-400 text-center py-3">No items yet. Add notes, documents, or links directly to this contact.</p>
            )}
            {contactItems.map(item => (
              <div key={item.id} className={cn('border rounded-xl overflow-hidden transition-all', `border-l-[3px] ${getSourceBorderColor(item.source)}`)}>
                <div
                  className="flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50/50"
                  onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                >
                  <SourceIconCircle source={item.source} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">{getSourceLabel(item.source)}</span>
                    </div>
                    {item.snippet && expandedItemId !== item.id && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.snippet}</p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1">{formatRelativeDate(item.occurred_at)}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="p-1.5 text-gray-300 hover:text-blue-500 rounded-lg transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button onClick={e => { e.stopPropagation(); setEditingItemId(item.id); setEditItemTitle(item.title); setEditItemBody(item.body || ''); }} className="p-1.5 text-gray-300 hover:text-blue-500 rounded-lg transition-colors">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={e => { e.stopPropagation(); deleteContactItem(item.id); }} className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded body */}
                {expandedItemId === item.id && item.body && editingItemId !== item.id && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    <div className="prose prose-sm max-w-none mt-3 text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                      {renderMd(item.body)}
                    </div>
                  </div>
                )}

                {/* Inline edit */}
                {editingItemId === item.id && (
                  <div className="px-4 pb-4 border-t border-gray-100 space-y-2 mt-2">
                    <input value={editItemTitle} onChange={e => setEditItemTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                    <textarea value={editItemBody} onChange={e => setEditItemBody(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y" rows={6} />
                    <div className="flex gap-2">
                      <button onClick={() => saveEditItem(item.id)} className="px-3 py-1.5 brand-gradient text-white rounded-lg text-xs font-medium"><Save className="w-3 h-3 inline mr-1" />Save</button>
                      <button onClick={() => setEditingItemId(null)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============================
          Knowledge Base (Unified View)
          ============================ */}
      <div className="animate-fade-in bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
        <button
          onClick={() => { setShowKB(!showKB); if (!kbLoaded && !showKB) loadKnowledgeBase(); }}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
              <Database className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-gray-900">Knowledge Base</h3>
              <p className="text-xs text-gray-500">Everything about this contact in one place</p>
            </div>
          </div>
          {showKB ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {showKB && (
          <div className="px-4 pb-4 space-y-3">
            {kbLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                <span className="ml-2 text-sm text-gray-500">Loading knowledge base...</span>
              </div>
            )}

            {kbLoaded && kbStats && (
              <>
                {/* Stats bar */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2.5 py-1 rounded-full">
                    {(kbStats as Record<string, unknown>).total as number} items
                  </span>
                  <span className="text-xs text-gray-500">
                    {(kbStats as Record<string, unknown>).linkedTopics as number} linked topics
                  </span>
                  {Object.entries((kbStats as Record<string, unknown>).bySource as Record<string, number> || {}).map(([src, count]) => (
                    <span key={src} className="text-[10px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                      {getSourceLabel(src)}: {count}
                    </span>
                  ))}
                </div>

                {/* Source filter chips */}
                <div className="flex gap-1 flex-wrap">
                  <button
                    onClick={() => { setKbSourceFilter(''); setKbLoaded(false); loadKnowledgeBase(); }}
                    className={cn('px-2.5 py-1 rounded-full text-[10px] font-medium transition-all', !kbSourceFilter ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
                  >All</button>
                  {['gmail', 'calendar', 'slack', 'drive', 'notion', 'document', 'manual', 'link'].map(src => (
                    <button
                      key={src}
                      onClick={() => { setKbSourceFilter(src); setKbLoaded(false); setTimeout(loadKnowledgeBase, 0); }}
                      className={cn('px-2.5 py-1 rounded-full text-[10px] font-medium transition-all', kbSourceFilter === src ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
                    >{getSourceLabel(src)}</button>
                  ))}
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    value={kbSearch}
                    onChange={e => setKbSearch(e.target.value)}
                    placeholder="Search knowledge base..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    onKeyDown={e => { if (e.key === 'Enter') { setKbLoaded(false); loadKnowledgeBase(); }}}
                  />
                </div>

                {/* Items timeline */}
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {kbItems.filter(item => {
                    if (!kbSearch) return true;
                    const q = kbSearch.toLowerCase();
                    return `${item.title || ''} ${item.snippet || ''}`.toLowerCase().includes(q);
                  }).map((item, i) => (
                    <div key={`kb-${i}`} className={cn('flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50/50 transition-colors', `border-l-[3px] ${getSourceBorderColor(item.source as string)}`)}>
                      <SourceIconCircle source={item.source as string} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.title as string}</p>
                          <span className={cn(
                            'text-[9px] px-1.5 py-0.5 rounded-full font-medium',
                            item._origin === 'direct' ? 'bg-orange-100 text-orange-700' :
                            item._origin === 'topic' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          )}>
                            {item._originLabel as string || getSourceLabel(item.source as string)}
                          </span>
                        </div>
                        {(item.snippet as string) && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.snippet as string}</p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-1">{formatRelativeDate((item.occurred_at || item.created_at) as string)}</p>
                      </div>
                      {(item.url as string) && (
                        <a href={item.url as string} target="_blank" rel="noopener noreferrer" className="p-1 text-gray-300 hover:text-blue-500 rounded transition-colors flex-shrink-0">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  ))}
                  {kbItems.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-6">No items found. Link topics and add items to build this contact&apos;s knowledge base.</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ============================
          AI Assistant
          ============================ */}
      <div className="animate-fade-in bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowAIAssistant(!showAIAssistant)}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}>
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-gray-900">AI Assistant</h3>
              <p className="text-xs text-gray-500">Ask questions, prepare meetings, find pending items</p>
            </div>
          </div>
          {showAIAssistant ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {showAIAssistant && (
          <div className="px-4 pb-4 space-y-4">
            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={runMeetingPrep}
                disabled={!!aiLoading}
                className="px-3.5 py-2 text-xs font-medium rounded-xl border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {aiLoading === 'meeting_prep' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Briefcase className="w-3.5 h-3.5" />}
                Prepare Meeting
              </button>
              <button
                onClick={runPendingItems}
                disabled={!!aiLoading}
                className="px-3.5 py-2 text-xs font-medium rounded-xl border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {aiLoading === 'pending_items' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardList className="w-3.5 h-3.5" />}
                Pending Items
              </button>
              <button
                onClick={runDossier}
                disabled={!!aiLoading}
                className="px-3.5 py-2 text-xs font-medium rounded-xl border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {aiLoading === 'dossier' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                Full Dossier
              </button>
            </div>

            {/* Deep Analysis Presets */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Deep Analysis</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { type: 'pending_decisions', label: 'Pending Decisions', icon: '🤔', color: 'border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100' },
                  { type: 'blockers', label: 'Blockers', icon: '🚧', color: 'border-red-200 text-red-700 bg-red-50 hover:bg-red-100' },
                  { type: 'hot_projects', label: 'Hot Projects', icon: '🔥', color: 'border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100' },
                  { type: 'concerns_shared', label: 'Concerns I Shared', icon: '💬', color: 'border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100' },
                  { type: 'concerns_received', label: 'Their Concerns', icon: '👂', color: 'border-teal-200 text-teal-700 bg-teal-50 hover:bg-teal-100' },
                  { type: 'feedback_given', label: 'Feedback I Gave', icon: '📝', color: 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100' },
                  { type: 'feedback_received', label: 'Feedback Received', icon: '📨', color: 'border-cyan-200 text-cyan-700 bg-cyan-50 hover:bg-cyan-100' },
                ].map(preset => (
                  <button
                    key={preset.type}
                    onClick={() => runDeepAnalysis(preset.type)}
                    disabled={!!aiLoading}
                    className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg border flex items-center gap-1 transition-all disabled:opacity-50 ${preset.color}`}
                  >
                    {aiLoading === 'deep_' + preset.type ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>{preset.icon}</span>}
                    {preset.label}
                  </button>
                ))}
              </div>
              {/* Time filter for presets */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400">Time scope:</span>
                {['past week', 'past month', 'past 3 months', 'past 6 months', 'all time'].map(tf => (
                  <button
                    key={tf}
                    onClick={() => {
                      const activeType = deepAnalysis?.analysis_type;
                      if (activeType) runDeepAnalysis(activeType, tf);
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Ask AI - free form */}
            <div className="flex gap-2">
              <input
                value={aiQuestion}
                onChange={e => setAiQuestion(e.target.value)}
                placeholder={`Ask anything about ${contact.name}...`}
                className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-400"
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askAI(); }}}
              />
              <button
                onClick={askAI}
                disabled={!!aiLoading || !aiQuestion.trim()}
                className="px-4 py-2.5 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}
              >
                {aiLoading === 'ask' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Ask
              </button>
            </div>

            {/* AI Answer */}
            {aiAnswer && (
              <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span className="text-xs font-semibold text-purple-800">AI Answer</span>
                </div>
                <div className="prose prose-sm max-w-none">{renderMd(aiAnswer)}</div>
              </div>
            )}

            {/* Meeting Prep */}
            {meetingPrep && (
              <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-200 space-y-3">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-semibold text-purple-800">Meeting Preparation</span>
                  <button onClick={() => setMeetingPrep(null)} className="ml-auto p-1 text-purple-400 hover:text-purple-600"><X className="w-3.5 h-3.5" /></button>
                </div>
                {meetingPrep.relationship_summary && (
                  <p className="text-sm text-gray-700">{meetingPrep.relationship_summary}</p>
                )}
                {(meetingPrep.suggested_agenda ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-purple-700 mb-1">Suggested Agenda</p>
                    <ul className="space-y-1">
                      {meetingPrep.suggested_agenda!.map((item, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-purple-400 font-bold">{i + 1}.</span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(meetingPrep.talking_points ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-purple-700 mb-1">Talking Points</p>
                    <ul className="space-y-1">
                      {meetingPrep.talking_points!.map((item, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                          <ChevronRight className="w-3 h-3 text-purple-400 mt-0.5 flex-shrink-0" /> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(meetingPrep.pending_items ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-purple-700 mb-1">Pending Items</p>
                    {meetingPrep.pending_items!.map((item, i) => (
                      <div key={i} className="text-sm text-gray-700 flex items-start gap-1.5 mt-1">
                        <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                        <span>{item.item} <span className="text-xs text-gray-400">({item.topic})</span></span>
                      </div>
                    ))}
                  </div>
                )}
                {meetingPrep.preparation_notes && (
                  <div className="p-3 bg-white/60 rounded-lg">
                    <p className="text-xs font-semibold text-purple-700 mb-1">Notes</p>
                    <p className="text-sm text-gray-700">{meetingPrep.preparation_notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Pending Items */}
            {pendingItems && (
              <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 space-y-2">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-800">Pending Items ({pendingItems.length})</span>
                  <button onClick={() => setPendingItems(null)} className="ml-auto p-1 text-amber-400 hover:text-amber-600"><X className="w-3.5 h-3.5" /></button>
                </div>
                {pendingItems.length === 0 && <p className="text-sm text-gray-500">No pending items found.</p>}
                {pendingItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 bg-white/70 rounded-lg">
                    <div className={cn(
                      'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                      item.priority === 'high' ? 'bg-red-500' : item.priority === 'medium' ? 'bg-amber-500' : 'bg-gray-400'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{item.task}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-500">{item.topic}</span>
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                          item.status === 'blocked' ? 'bg-red-100 text-red-700' :
                          item.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        )}>{item.status}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Dossier */}
            {dossier && (
              <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-800">Contact Dossier</span>
                  <button onClick={() => setDossier(null)} className="ml-auto p-1 text-blue-400 hover:text-blue-600"><X className="w-3.5 h-3.5" /></button>
                </div>
                <div className="prose prose-sm max-w-none max-h-[500px] overflow-y-auto">{renderMd(dossier)}</div>
              </div>
            )}

            {/* Deep Analysis Results */}
            {deepAnalysis && deepAnalysis.items && deepAnalysis.items.length > 0 && (
              <div className="p-4 bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl border border-gray-200 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">
                    {deepAnalysis.analysis_type === 'pending_decisions' ? '🤔' :
                     deepAnalysis.analysis_type === 'blockers' ? '🚧' :
                     deepAnalysis.analysis_type === 'hot_projects' ? '🔥' :
                     deepAnalysis.analysis_type === 'concerns_shared' ? '💬' :
                     deepAnalysis.analysis_type === 'concerns_received' ? '👂' :
                     deepAnalysis.analysis_type === 'feedback_given' ? '📝' :
                     deepAnalysis.analysis_type === 'feedback_received' ? '📨' : '🔍'}
                  </span>
                  <span className="text-sm font-semibold text-gray-800">
                    {deepAnalysis.analysis_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} ({deepAnalysis.items.length})
                  </span>
                  <button onClick={() => setDeepAnalysis(null)} className="ml-auto p-1 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                </div>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {deepAnalysis.items.map((item, i) => {
                    const keys = Object.keys(item).filter(k => k !== 'type');
                    const mainKey = keys[0] || '';
                    const mainValue = String(item[mainKey] || '');
                    const meta = keys.slice(1).map(k => ({ key: k, value: String(item[k] || '') })).filter(m => m.value && m.value !== 'undefined');

                    return (
                      <div key={i} className="p-3 bg-white rounded-lg border border-gray-100 space-y-1">
                        <p className="text-sm text-gray-900 font-medium">{mainValue}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {meta.map(m => (
                            <span key={m.key} className="text-[11px] text-gray-500">
                              <span className="font-medium text-gray-600">{m.key.replace(/_/g, ' ')}:</span> {m.value.length > 120 ? m.value.substring(0, 120) + '...' : m.value}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {deepAnalysis && deepAnalysis.items && deepAnalysis.items.length === 0 && (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-center">
                <p className="text-sm text-gray-500">No items found for this analysis type.</p>
                <button onClick={() => setDeepAnalysis(null)} className="mt-2 text-xs text-gray-400 hover:text-gray-600">Dismiss</button>
              </div>
            )}

            {/* Loading indicator */}
            {aiLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                <span className="ml-2 text-sm text-gray-500">
                  {aiLoading === 'meeting_prep' ? 'Preparing meeting briefing...' :
                   aiLoading === 'pending_items' ? 'Scanning for pending items...' :
                   aiLoading === 'dossier' ? 'Generating full dossier...' :
                   aiLoading?.startsWith('deep_') ? `Analyzing ${aiLoading.replace('deep_', '').replace(/_/g, ' ')}... (this may take a moment for large documents)` :
                   'Thinking...'}
                </span>
              </div>
            )}
          </div>
        )}
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
