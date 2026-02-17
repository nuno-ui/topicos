'use client';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Plus, X, Users, Mail, Building, StickyNote, ChevronRight, Loader2, Search,
  Edit3, Save, Trash2, Sparkles, Brain, UserPlus, Network, Wand2, ExternalLink,
  Clock, TrendingUp, TrendingDown, Activity,
  Upload, LayoutList, Building2, CheckSquare, Square, Filter, ArrowRight,
  ChevronDown, Download, Hash, ArrowUp, ArrowDown, AlertCircle
} from 'lucide-react';

interface Contact {
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
  contact_topic_links?: Array<{
    topic_id: string;
    role: string | null;
    topics: { title: string } | null;
  }>;
}

interface ExtractedContact {
  name: string;
  email: string;
  role: string;
}

interface EnrichedProfile {
  organization: string;
  role: string;
  relationship_summary: string;
  interaction_frequency: string;
  key_topics: string[];
}

// ========== GRADIENT AVATAR HELPER ==========

const avatarGradients = [
  'from-blue-500 to-cyan-400',
  'from-green-500 to-emerald-400',
  'from-purple-500 to-violet-400',
  'from-amber-500 to-orange-400',
  'from-pink-500 to-rose-400',
  'from-cyan-500 to-teal-400',
  'from-indigo-500 to-blue-400',
  'from-red-500 to-pink-400',
  'from-emerald-500 to-green-400',
  'from-violet-500 to-purple-400',
];

function getAvatarGradient(name: string): string {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return avatarGradients[hash % avatarGradients.length];
}

// ========== ACTIVITY LEVEL DOT COLOR ==========

function getActivityDotColor(label: string): string {
  switch (label) {
    case 'Active': return 'bg-green-500';
    case 'Recent': return 'bg-green-400';
    case 'Idle': return 'bg-amber-400';
    case 'Cold': return 'bg-red-400';
    case 'New':
    default:
      return 'bg-gray-400';
  }
}

// ========== AREA BADGE COLORS ==========

function getAreaBadgeStyle(area: string | null): string {
  switch (area) {
    case 'work': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'personal': return 'bg-green-100 text-green-700 border-green-200';
    case 'career': return 'bg-purple-100 text-purple-700 border-purple-200';
    default: return 'bg-gray-100 text-gray-500 border-gray-200';
  }
}

// ========== EMAIL VALIDATION ==========

function isValidEmail(email: string): boolean {
  if (!email) return true; // empty is fine (optional field)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ========== HIGHLIGHT MATCHING TEXT ==========

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim() || !text) return <>{text}</>;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export function ContactsList({ initialContacts }: { initialContacts: Contact[] }) {
  const router = useRouter();
  const [contacts, setContacts] = useState(initialContacts);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Create form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newOrganization, setNewOrganization] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newArea, setNewArea] = useState('');
  const [creating, setCreating] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Edit state
  const [editingContact, setEditingContact] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editOrganization, setEditOrganization] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editArea, setEditArea] = useState('');
  const [saving, setSaving] = useState(false);

  // AI Agent state
  const [agentLoading, setAgentLoading] = useState<string | null>(null);
  const [enrichedProfile, setEnrichedProfile] = useState<EnrichedProfile | null>(null);
  const [enrichedContactId, setEnrichedContactId] = useState<string | null>(null);
  const [extractedContacts, setExtractedContacts] = useState<ExtractedContact[]>([]);
  const [showExtracted, setShowExtracted] = useState(false);
  const [dedupeResults, setDedupeResults] = useState<string | null>(null);
  const [showDedupe, setShowDedupe] = useState(false);

  // Organization Grouping View
  const [viewMode, setViewMode] = useState<'list' | 'organizations'>('list');
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());

  // Bulk Actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  // Filters
  const [filterArea, setFilterArea] = useState<string>('');
  const [filterOrg, setFilterOrg] = useState<string>('');
  const [filterActivity, setFilterActivity] = useState<string>('');
  const [filterHasEmail, setFilterHasEmail] = useState(false);
  const [filterHasTopics, setFilterHasTopics] = useState<string>('');

  // Sort Options (persisted in localStorage)
  const [sortBy, setSortByState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('contacts-sort') || 'name-asc';
    }
    return 'name-asc';
  });
  const setSortBy = useCallback((value: string) => {
    setSortByState(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('contacts-sort', value);
    }
  }, []);

  // Import modal state
  const [showImport, setShowImport] = useState(false);

  // Dashboard card filter
  const [dashboardFilter, setDashboardFilter] = useState<string>('');

  // Keyboard shortcuts
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Create form animation
  const [createFormVisible, setCreateFormVisible] = useState(false);
  useEffect(() => {
    if (showCreate) {
      requestAnimationFrame(() => setCreateFormVisible(true));
    } else {
      setCreateFormVisible(false);
    }
  }, [showCreate]);

  // ========== HELPER FUNCTIONS ==========

  const getInteractionScore = (c: Contact) => {
    const lastAt = c.last_interaction_at;
    const count = c.interaction_count || 0;

    if (!lastAt || count === 0) {
      return { label: 'New', color: 'text-gray-500 bg-gray-50', score: 0 };
    }

    const daysSince = Math.floor((Date.now() - new Date(lastAt).getTime()) / (1000 * 60 * 60 * 24));

    if (daysSince <= 7) return { label: 'Active', color: 'text-green-600 bg-green-50', score: 5 };
    if (daysSince <= 30) return { label: 'Recent', color: 'text-blue-600 bg-blue-50', score: 3 };
    if (daysSince <= 90) return { label: 'Idle', color: 'text-amber-600 bg-amber-50', score: 1 };
    return { label: 'Cold', color: 'text-red-600 bg-red-50', score: 0 };
  };

  const initials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    if (days < 14) return '1 week ago';
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 60) return '1 month ago';
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)}y ago`;
  };

  // ========== UNIQUE VALUES FOR FILTERS ==========

  const uniqueOrganizations = useMemo(() => {
    const orgs = new Set<string>();
    contacts.forEach(c => { if (c.organization) orgs.add(c.organization); });
    return Array.from(orgs).sort();
  }, [contacts]);

  // Top 5 organizations by contact count for quick filter chips
  const topOrganizations = useMemo(() => {
    const orgCounts: Record<string, number> = {};
    contacts.forEach(c => {
      if (c.organization) {
        orgCounts[c.organization] = (orgCounts[c.organization] || 0) + 1;
      }
    });
    return Object.entries(orgCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }, [contacts]);

  // ========== ACTIVE FILTER COUNT ==========

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterArea) count++;
    if (filterOrg) count++;
    if (filterActivity) count++;
    if (filterHasEmail) count++;
    if (filterHasTopics) count++;
    if (dashboardFilter) count++;
    return count;
  }, [filterArea, filterOrg, filterActivity, filterHasEmail, filterHasTopics, dashboardFilter]);

  // ========== FILTERED + SORTED CONTACTS ==========

  const filteredContacts = useMemo(() => {
    let result = contacts;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.organization || '').toLowerCase().includes(q) ||
        (c.role || '').toLowerCase().includes(q)
      );
    }

    // Filter: Area
    if (filterArea) {
      result = result.filter(c => c.area === filterArea);
    }

    // Filter: Organization
    if (filterOrg) {
      if (filterOrg === '__none__') {
        result = result.filter(c => !c.organization);
      } else {
        result = result.filter(c => c.organization === filterOrg);
      }
    }

    // Filter: Activity
    if (filterActivity) {
      result = result.filter(c => {
        const score = getInteractionScore(c);
        if (filterActivity === 'All') return true;
        return score.label === filterActivity;
      });
    }

    // Filter: Has Email
    if (filterHasEmail) {
      result = result.filter(c => !!c.email);
    }

    // Filter: Has Topics
    if (filterHasTopics === 'yes') {
      result = result.filter(c => c.contact_topic_links && c.contact_topic_links.length > 0);
    } else if (filterHasTopics === 'no') {
      result = result.filter(c => !c.contact_topic_links || c.contact_topic_links.length === 0);
    }

    // Dashboard filter
    if (dashboardFilter) {
      const now = Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      if (dashboardFilter === 'total') {
        // no additional filter
      } else if (dashboardFilter === 'organizations') {
        result = result.filter(c => !!c.organization);
      } else if (dashboardFilter === 'active7') {
        result = result.filter(c => c.last_interaction_at && (now - new Date(c.last_interaction_at).getTime()) <= sevenDays);
      } else if (dashboardFilter === 'active30') {
        result = result.filter(c => c.last_interaction_at && (now - new Date(c.last_interaction_at).getTime()) <= thirtyDays);
      } else if (dashboardFilter === 'needsFollowUp') {
        result = result.filter(c => c.interaction_count > 0 && c.last_interaction_at && (now - new Date(c.last_interaction_at).getTime()) > thirtyDays);
      } else if (dashboardFilter === 'avgInteractions') {
        // show all for avg interactions, just highlight the stat
      }
    }

    // Sort
    const sorted = [...result];
    switch (sortBy) {
      case 'name-asc':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'most-active':
        sorted.sort((a, b) => getInteractionScore(b).score - getInteractionScore(a).score);
        break;
      case 'least-active':
        sorted.sort((a, b) => getInteractionScore(a).score - getInteractionScore(b).score);
        break;
      case 'recently-added':
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'most-topics':
        sorted.sort((a, b) => (b.contact_topic_links?.length || 0) - (a.contact_topic_links?.length || 0));
        break;
      case 'organization':
        sorted.sort((a, b) => (a.organization || 'zzz').localeCompare(b.organization || 'zzz'));
        break;
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name));
    }

    return sorted;
  }, [contacts, searchQuery, filterArea, filterOrg, filterActivity, filterHasEmail, filterHasTopics, sortBy, dashboardFilter]);

  // ========== DASHBOARD STATS ==========

  const dashboardStats = useMemo(() => {
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const orgs = new Set<string>();
    let active7 = 0;
    let active30 = 0;
    let needsFollowUp = 0;
    let totalInteractions = 0;

    contacts.forEach(c => {
      if (c.organization) orgs.add(c.organization);
      totalInteractions += c.interaction_count || 0;
      if (c.last_interaction_at) {
        const timeSince = now - new Date(c.last_interaction_at).getTime();
        if (timeSince <= sevenDays) active7++;
        if (timeSince <= thirtyDays) active30++;
        // Needs follow-up: had interactions but last one was > 30 days ago
        if (c.interaction_count > 0 && timeSince > thirtyDays) needsFollowUp++;
      }
    });

    const avgInteractions = contacts.length > 0 ? Math.round((totalInteractions / contacts.length) * 10) / 10 : 0;

    return {
      total: contacts.length,
      organizations: orgs.size,
      active7,
      active30,
      avgInteractions,
      needsFollowUp,
    };
  }, [contacts]);

  // ========== FOLLOW-UP CONTACTS ==========

  const followUpContacts = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return contacts.filter(c =>
      c.interaction_count > 0 &&
      c.last_interaction_at &&
      new Date(c.last_interaction_at).getTime() < thirtyDaysAgo
    );
  }, [contacts]);

  // ========== KEYBOARD SHORTCUTS ==========

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    // Escape works even in inputs
    if (e.key === 'Escape') {
      e.preventDefault();
      if (showCreate) { setShowCreate(false); return; }
      if (editingContact) { setEditingContact(null); return; }
      if (selectedContact) { setSelectedContact(null); return; }
      if (searchQuery) { setSearchQuery(''); searchInputRef.current?.blur(); return; }
      if (selectedIds.size > 0) { deselectAll(); setSelectMode(false); return; }
      setSelectedIndex(-1);
      return;
    }

    // '/' focuses search even from non-input
    if (e.key === '/' && !isInput) {
      e.preventDefault();
      searchInputRef.current?.focus();
      return;
    }

    if (isInput) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    switch (e.key) {
      case 'n':
      case 'N':
        e.preventDefault();
        setShowCreate(true);
        break;
      case 'j':
        setSelectedIndex(prev => Math.min(prev + 1, filteredContacts.length - 1));
        break;
      case 'k':
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        if (selectedIndex >= 0 && selectedIndex < filteredContacts.length) {
          router.push(`/contacts/${filteredContacts[selectedIndex].id}`);
        }
        break;
      case 'e':
        if (selectedIndex >= 0 && selectedIndex < filteredContacts.length) {
          const c = filteredContacts[selectedIndex];
          setSelectedContact(c.id);
          startEdit(c);
        }
        break;
    }
  }, [selectedIndex, filteredContacts, showCreate, editingContact, selectedContact, searchQuery, selectedIds, router]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Scroll selected card into view
  useEffect(() => {
    if (selectedIndex >= 0) {
      const el = document.getElementById(`contact-card-${selectedIndex}`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  // ========== ORGANIZATION GROUPING ==========

  const organizationGroups = useMemo(() => {
    const groups: Record<string, Contact[]> = {};
    filteredContacts.forEach(c => {
      const key = c.organization || '__no_org__';
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === '__no_org__') return 1;
      if (b === '__no_org__') return -1;
      return a.localeCompare(b);
    });
    return sortedKeys.map(key => ({
      name: key === '__no_org__' ? 'No Organization' : key,
      key,
      contacts: groups[key],
      totalTopics: groups[key].reduce((sum, c) => sum + (c.contact_topic_links?.length || 0), 0),
      sharedTopics: Array.from(new Set(
        groups[key].flatMap(c => c.contact_topic_links?.map(l => l.topics?.title || 'Unknown') || [])
      )),
    }));
  }, [filteredContacts]);

  const toggleOrgExpanded = (key: string) => {
    setExpandedOrgs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // ========== BULK ACTIONS ==========

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredContacts.map(c => c.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected contact(s)? This cannot be undone.`)) return;
    const ids = Array.from(selectedIds);
    let deleted = 0;
    const failedIds = new Set<string>();
    for (const id of ids) {
      try {
        const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
        if (res.ok) deleted++;
        else failedIds.add(id);
      } catch { failedIds.add(id); }
    }
    setContacts(prev => prev.filter(c => !selectedIds.has(c.id) || failedIds.has(c.id)));
    setSelectedIds(new Set());
    setSelectMode(false);
    if (failedIds.size > 0) toast.error(`Failed to delete ${failedIds.size} contact(s)`);
    else toast.success(`Deleted ${deleted} contact(s)`);
  };

  const bulkSetArea = async (area: string) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    let updated = 0;
    const succeededIds = new Set<string>();
    for (const id of ids) {
      try {
        const res = await fetch(`/api/contacts/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ area: area || null }),
        });
        if (res.ok) { updated++; succeededIds.add(id); }
      } catch { /* skip */ }
    }
    setContacts(prev => prev.map(c => succeededIds.has(c.id) ? { ...c, area: area || null } : c));
    if (updated < ids.length) toast.error(`Failed to update ${ids.length - updated} contact(s)`);
    else toast.success(`Updated area for ${updated} contact(s)`);
  };

  // ========== FILTER HELPERS ==========

  const hasActiveFilters = filterArea || filterOrg || filterActivity || filterHasEmail || filterHasTopics || dashboardFilter;

  const clearAllFilters = () => {
    setFilterArea('');
    setFilterOrg('');
    setFilterActivity('');
    setFilterHasEmail(false);
    setFilterHasTopics('');
    setDashboardFilter('');
  };

  // ========== SORT DIRECTION HELPERS ==========

  const getSortIcon = () => {
    if (sortBy.includes('desc') || sortBy === 'most-active' || sortBy === 'recently-added' || sortBy === 'most-topics') {
      return <ArrowDown className="w-3.5 h-3.5 text-blue-500" />;
    }
    return <ArrowUp className="w-3.5 h-3.5 text-blue-500" />;
  };

  // ========== CRUD HANDLERS ==========

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error('Name is required'); return; }
    if (newEmail && !isValidEmail(newEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim() || null,
          organization: newOrganization.trim() || null,
          role: newRole.trim() || null,
          notes: newNotes.trim() || null,
          area: newArea || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setContacts(prev => [...prev, data.contact].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName(''); setNewEmail(''); setNewOrganization(''); setNewRole(''); setNewNotes(''); setNewArea('');
      setEmailError('');
      setShowCreate(false);
      toast.success('Contact added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Create failed');
    }
    setCreating(false);
  };

  const startEdit = (c: Contact) => {
    setEditingContact(c.id);
    setEditName(c.name);
    setEditEmail(c.email || '');
    setEditOrganization(c.organization || '');
    setEditRole(c.role || '');
    setEditNotes(c.notes || '');
    setEditArea(c.area || '');
    setSelectedContact(c.id);
  };

  const saveEdit = async (contactId: string) => {
    if (!editName.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim() || null,
          organization: editOrganization.trim() || null,
          role: editRole.trim() || null,
          notes: editNotes.trim() || null,
          area: editArea || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setContacts(prev => prev.map(c => c.id === contactId ? { ...c, ...data.contact } : c));
      setEditingContact(null);
      toast.success('Contact updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
    setSaving(false);
  };

  const deleteContact = async (contactId: string) => {
    if (!confirm('Delete this contact? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/contacts/${contactId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setContacts(prev => prev.filter(c => c.id !== contactId));
      setSelectedContact(null);
      toast.success('Contact deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  // ========== AI AGENT FUNCTIONS ==========

  const runEnrichContact = async (contactId: string) => {
    setAgentLoading(`enrich_${contactId}`);
    try {
      const res = await fetch('/api/ai/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'enrich_contact', context: { contact_id: contactId } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEnrichedProfile(data.result);
      setEnrichedContactId(contactId);
      const enriched = data.result;
      setContacts(prev => prev.map(c => c.id === contactId ? {
        ...c,
        organization: enriched.organization || c.organization,
        notes: enriched.relationship_summary || c.notes,
      } : c));
      toast.success('Contact profile enriched');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Enrich failed');
    }
    setAgentLoading(null);
  };

  const runExtractContacts = async () => {
    setAgentLoading('extract');
    try {
      const topicsRes = await fetch('/api/topics');
      const topicsData = await topicsRes.json();
      const topics = topicsData.topics || [];
      if (topics.length === 0) {
        toast.error('No topics found - create topics with linked items first');
        setAgentLoading(null);
        return;
      }
      const allExtracted: ExtractedContact[] = [];
      const batchSize = 5;
      for (let i = 0; i < topics.length; i += batchSize) {
        const batch = topics.slice(i, i + batchSize);
        toast.info(`Scanning topics... (${Math.min(i + batchSize, topics.length)}/${topics.length})`);
        const batchResults = await Promise.all(batch.map(async (topic: Record<string, unknown>) => {
          try {
            const res = await fetch('/api/ai/agents', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ agent: 'find_contacts', context: { topic_id: topic.id } }),
            });
            const data = await res.json();
            if (res.ok && data.result.contacts) {
              return data.result.contacts;
            }
          } catch { /* skip failed topics */ }
          return [];
        }));
        allExtracted.push(...batchResults.flat());
      }
      const seen = new Set<string>();
      const unique = allExtracted.filter(c => {
        const key = c.email?.toLowerCase() || c.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        const existingEmails = new Set(contacts.map(ec => ec.email?.toLowerCase()).filter(Boolean));
        return !existingEmails.has(c.email?.toLowerCase());
      });
      setExtractedContacts(unique);
      setShowExtracted(true);
      toast.success(`Found ${unique.length} new contacts across topics`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Extract failed');
    }
    setAgentLoading(null);
  };

  const addExtractedContact = async (ec: ExtractedContact) => {
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ec.name,
          email: ec.email || null,
          role: ec.role || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setContacts(prev => [...prev, data.contact].sort((a, b) => a.name.localeCompare(b.name)));
      setExtractedContacts(prev => prev.filter(c => c.email !== ec.email));
      toast.success(`Added ${ec.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Add failed');
    }
  };

  const runDedupeAnalysis = async () => {
    if (contacts.length < 2) { toast.error('Need at least 2 contacts to check for duplicates'); return; }
    setAgentLoading('dedupe');
    try {
      const res = await fetch('/api/ai/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'dedupe_contacts',
          context: {
            contacts: contacts.map(c => ({ name: c.name, email: c.email, organization: c.organization })),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDedupeResults(data.result.analysis || data.result.insights || 'No duplicates found');
      setShowDedupe(true);
      toast.success('Duplicate analysis complete');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed');
    }
    setAgentLoading(null);
  };

  // ========== RENDER: Contact Card ==========

  const renderContactCard = (c: Contact, index: number = -1) => {
    const interaction = getInteractionScore(c);
    const isSelected = selectedIds.has(c.id);
    const isKeyboardSelected = index === selectedIndex && index >= 0;
    const topicCount = c.contact_topic_links?.length || 0;
    const activityDotColor = getActivityDotColor(interaction.label);

    return (
      <div key={c.id} id={`contact-card-${index}`}>
        <div
          onClick={() => router.push(`/contacts/${c.id}`)}
          className={`w-full bg-white rounded-xl border transition-all duration-200 text-left cursor-pointer group relative overflow-hidden ${
            isSelected
              ? 'border-blue-400 bg-blue-50/30 shadow-sm'
              : isKeyboardSelected
                ? 'border-indigo-300 bg-indigo-50/20 shadow-md ring-1 ring-indigo-200'
                : 'border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 hover:-translate-y-px'
          }`}
          style={{ borderLeftWidth: '3px', borderLeftColor: isSelected ? undefined : 'transparent' }}
          onMouseEnter={(e) => {
            if (!isSelected) {
              const el = e.currentTarget;
              const grad = getAvatarGradient(c.name);
              // Map gradient class to a simple color for the left border
              if (grad.includes('blue')) el.style.borderLeftColor = '#3b82f6';
              else if (grad.includes('green') || grad.includes('emerald')) el.style.borderLeftColor = '#10b981';
              else if (grad.includes('purple') || grad.includes('violet')) el.style.borderLeftColor = '#8b5cf6';
              else if (grad.includes('amber') || grad.includes('orange')) el.style.borderLeftColor = '#f59e0b';
              else if (grad.includes('pink') || grad.includes('rose')) el.style.borderLeftColor = '#ec4899';
              else if (grad.includes('cyan') || grad.includes('teal')) el.style.borderLeftColor = '#06b6d4';
              else if (grad.includes('indigo')) el.style.borderLeftColor = '#6366f1';
              else if (grad.includes('red')) el.style.borderLeftColor = '#ef4444';
              else el.style.borderLeftColor = '#3b82f6';
            }
          }}
          onMouseLeave={(e) => {
            if (!isSelected) {
              e.currentTarget.style.borderLeftColor = 'transparent';
            }
          }}
        >
          <div className="flex items-center gap-3 py-3 pr-4 pl-4">
            {/* Checkbox for bulk select */}
            {(selectMode || isSelected) && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleSelect(c.id); }}
                className="flex-shrink-0 text-gray-400 hover:text-blue-600 transition-colors"
              >
                {isSelected
                  ? <CheckSquare className="w-5 h-5 text-blue-600" />
                  : <Square className="w-5 h-5" />
                }
              </button>
            )}
            {!selectMode && !isSelected && (
              <button
                onClick={(e) => { e.stopPropagation(); setSelectMode(true); toggleSelect(c.id); }}
                className="flex-shrink-0 text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Square className="w-5 h-5" />
              </button>
            )}

            {/* Avatar with gradient background and activity dot */}
            <div className="relative flex-shrink-0">
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarGradient(c.name)} font-semibold text-xs text-white flex items-center justify-center shadow-sm`}>
                {initials(c.name)}
              </div>
              {/* Activity level indicator dot */}
              <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${activityDotColor}`}
                title={`${interaction.label}`}
              />
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0">
              {/* Row 1: Name + Area badge + Activity trend */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                  <HighlightText text={c.name} query={searchQuery} />
                </span>
                {c.area && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide border ${getAreaBadgeStyle(c.area)}`}>
                    {c.area}
                  </span>
                )}
                {topicCount > 0 && (
                  <>
                    {c.contact_topic_links!.slice(0, 2).map((link) => (
                      <span key={link.topic_id} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium border border-indigo-100 truncate max-w-[100px]" title={link.topics?.title || 'Unknown'}>
                        <Hash className="w-2.5 h-2.5 flex-shrink-0" />
                        {link.topics?.title || 'Unknown'}
                      </span>
                    ))}
                    {topicCount > 2 && (
                      <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50/60 text-indigo-400 font-medium border border-indigo-100">
                        +{topicCount - 2}
                      </span>
                    )}
                  </>
                )}
                {c.interaction_count > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-500 font-medium border border-gray-100">
                    {c.interaction_count} interaction{c.interaction_count !== 1 ? 's' : ''}
                  </span>
                )}
                {interaction.score >= 3
                  ? <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                  : interaction.score >= 1
                    ? <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                    : <TrendingDown className="w-3.5 h-3.5 text-gray-300" />
                }
              </div>

              {/* Row 2: Organization + Role + Last interaction */}
              <div className="flex items-center gap-2.5 text-xs text-gray-500 mt-0.5 flex-wrap">
                {c.organization && (
                  <span className="flex items-center gap-1 text-gray-600">
                    <Building className="w-3 h-3 text-gray-400" />
                    <HighlightText text={c.organization} query={searchQuery} />
                  </span>
                )}
                {c.role && (
                  <span className="text-gray-400 italic">
                    <HighlightText text={c.role} query={searchQuery} />
                  </span>
                )}
                {c.email && (
                  <span className="text-gray-400 truncate max-w-[180px]">
                    <HighlightText text={c.email} query={searchQuery} />
                  </span>
                )}
                <span className="flex items-center gap-1 text-gray-400 ml-auto whitespace-nowrap">
                  <Clock className="w-3 h-3" /> {getRelativeTime(c.last_interaction_at)}
                </span>
              </div>
              {/* Recent interaction preview */}
              {c.notes && (
                <p className="text-[10px] text-gray-400 mt-1 truncate italic max-w-[300px]" title={c.notes}>
                  {c.notes.length > 60 ? c.notes.slice(0, 60) + '...' : c.notes}
                </p>
              )}
            </div>

            {/* Quick action overlay on hover */}
            <div className="flex items-center gap-0.5">
              {c.email && (
                <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()}
                  className="p-1.5 text-gray-300 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all opacity-0 group-hover:opacity-100" title="Send email">
                  <Mail className="w-3.5 h-3.5" />
                </a>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); router.push(`/contacts/${c.id}`); }}
                className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100" title="View contact"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); startEdit(c); }}
                className="p-1.5 text-gray-300 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all opacity-0 group-hover:opacity-100" title="Edit contact"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedContact(selectedContact === c.id ? null : c.id); }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
              >
                <ChevronRight className={`w-4 h-4 transition-transform ${selectedContact === c.id ? 'rotate-90' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Expanded detail */}
        {selectedContact === c.id && (
          <div className="mt-1 ml-4 p-4 bg-gray-50 rounded-xl border border-gray-100" onClick={(e) => e.stopPropagation()}>
            {editingContact === c.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Name *"
                    className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="Email"
                    className="px-3 py-2 border rounded-lg text-sm" type="email" />
                  <input value={editOrganization} onChange={e => setEditOrganization(e.target.value)} placeholder="Organization"
                    className="px-3 py-2 border rounded-lg text-sm" />
                  <input value={editRole} onChange={e => setEditRole(e.target.value)} placeholder="Role"
                    className="px-3 py-2 border rounded-lg text-sm" />
                  <select value={editArea} onChange={e => setEditArea(e.target.value)}
                    className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">Area (optional)</option>
                    <option value="work">Work</option>
                    <option value="personal">Personal</option>
                    <option value="career">Career</option>
                  </select>
                </div>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Notes"
                  className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(c.id)} disabled={saving}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                  </button>
                  <button onClick={() => setEditingContact(null)}
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-300 flex items-center gap-1">
                    <X className="w-3 h-3" /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(c)}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                      <Edit3 className="w-3 h-3" /> Edit
                    </button>
                    <button onClick={() => runEnrichContact(c.id)}
                      disabled={agentLoading === `enrich_${c.id}`}
                      className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1 disabled:opacity-50">
                      {agentLoading === `enrich_${c.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                      AI Enrich
                    </button>
                    {c.email && (
                      <a href={`mailto:${c.email}`}
                        className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Quick Email
                      </a>
                    )}
                    <button onClick={() => deleteContact(c.id)}
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getInteractionScore(c).color}`}>
                    <Activity className="w-3 h-3 inline mr-0.5" />
                    {getInteractionScore(c).label}
                  </span>
                </div>

                {/* Enriched profile banner */}
                {enrichedContactId === c.id && enrichedProfile && (
                  <div className="mb-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <h4 className="text-xs font-semibold text-purple-700 mb-2 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> AI Enriched Profile
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Organization:</span>
                        <span className="ml-1 text-gray-800">{enrichedProfile.organization}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Role:</span>
                        <span className="ml-1 text-gray-800">{enrichedProfile.role}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Frequency:</span>
                        <span className="ml-1 text-gray-800">{enrichedProfile.interaction_frequency}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Key Topics:</span>
                        <span className="ml-1 text-gray-800">{enrichedProfile.key_topics?.join(', ') || 'None'}</span>
                      </div>
                    </div>
                    {enrichedProfile.relationship_summary && (
                      <p className="mt-2 text-xs text-gray-700 italic">{enrichedProfile.relationship_summary}</p>
                    )}
                  </div>
                )}

                {c.notes && (
                  <div className="mb-3">
                    <h4 className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                      <StickyNote className="w-3 h-3" /> Notes
                    </h4>
                    <p className="text-sm text-gray-700">{c.notes}</p>
                  </div>
                )}
                {c.contact_topic_links && c.contact_topic_links.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 mb-1">Related Topics</h4>
                    <div className="flex gap-2 flex-wrap">
                      {c.contact_topic_links.map((link) => (
                        <a key={link.topic_id} href={`/topics/${link.topic_id}`}
                          className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors">
                          {link.topics?.title || 'Unknown'}
                          {link.role && ` (${link.role})`}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {!c.notes && (!c.contact_topic_links || c.contact_topic_links.length === 0) && (
                  <div className="text-center py-2">
                    <p className="text-xs text-gray-400">No additional details yet.</p>
                    <button onClick={() => runEnrichContact(c.id)}
                      disabled={agentLoading === `enrich_${c.id}`}
                      className="mt-1 text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1 mx-auto disabled:opacity-50">
                      {agentLoading === `enrich_${c.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Use AI to enrich this profile
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  // ========== MAIN RENDER ==========

  return (
    <div>
      {/* ===== Stats Dashboard ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {([
          { key: 'total', value: dashboardStats.total, label: 'Total Contacts', icon: Users, colors: { border: 'border-blue-400', bg: 'bg-blue-50', iconBg: 'bg-blue-100', iconText: 'text-blue-600', hoverBorder: 'hover:border-blue-200' } },
          { key: 'active7', value: dashboardStats.active7, label: 'Active (7 days)', icon: Activity, colors: { border: 'border-green-400', bg: 'bg-green-50', iconBg: 'bg-green-100', iconText: 'text-green-600', hoverBorder: 'hover:border-green-200' } },
          { key: 'organizations', value: dashboardStats.organizations, label: 'Organizations', icon: Building2, colors: { border: 'border-purple-400', bg: 'bg-purple-50', iconBg: 'bg-purple-100', iconText: 'text-purple-600', hoverBorder: 'hover:border-purple-200' } },
          { key: 'needsFollowUp', value: dashboardStats.needsFollowUp, label: 'Needs Follow-up', icon: Clock, colors: { border: 'border-amber-400', bg: 'bg-amber-50', iconBg: 'bg-amber-100', iconText: 'text-amber-600', hoverBorder: 'hover:border-amber-200' } },
        ] as const).map(stat => {
          const Icon = stat.icon;
          const isActive = dashboardFilter === stat.key;
          return (
            <button
              key={stat.key}
              onClick={() => setDashboardFilter(isActive ? '' : stat.key)}
              className={`p-4 rounded-xl border transition-all text-left group/stat ${
                isActive
                  ? `${stat.colors.border} ${stat.colors.bg} shadow-md ring-1 ring-inset ${stat.colors.border.replace('border-', 'ring-')}/30`
                  : `border-gray-100 bg-white ${stat.colors.hoverBorder} hover:shadow-sm`
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`w-8 h-8 rounded-lg ${stat.colors.iconBg} flex items-center justify-center transition-transform group-hover/stat:scale-110`}>
                  <Icon className={`w-4 h-4 ${stat.colors.iconText}`} />
                </div>
                {isActive && (
                  <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Filtered</span>
                )}
              </div>
              <p className="text-2xl font-bold text-gray-900 tabular-nums">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
            </button>
          );
        })}
      </div>

      {/* Organization Quick Filter Chips */}
      {topOrganizations.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs text-gray-400 font-medium flex items-center gap-1 flex-shrink-0">
            <Building2 className="w-3 h-3" /> Top orgs:
          </span>
          {topOrganizations.map(org => {
            const isActive = filterOrg === org.name;
            return (
              <button
                key={org.name}
                onClick={() => setFilterOrg(isActive ? '' : org.name)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700'
                }`}
              >
                <Building className="w-3 h-3" />
                <span className="truncate max-w-[120px]">{org.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${
                  isActive ? 'bg-purple-500 text-purple-100' : 'bg-gray-100 text-gray-500'
                }`}>
                  {org.count}
                </span>
              </button>
            );
          })}
          {filterOrg && topOrganizations.some(o => o.name === filterOrg) && (
            <button
              onClick={() => setFilterOrg('')}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      )}

      {/* AI Assistants Panel */}
      <div className="mb-6 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-purple-500" />
          AI Contact Assistants
        </h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={runExtractContacts} disabled={!!agentLoading}
            className="px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-medium hover:bg-purple-100 disabled:opacity-50 flex items-center gap-1.5">
            {agentLoading === 'extract' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
            Extract from Topics
          </button>
          <button onClick={runDedupeAnalysis} disabled={!!agentLoading || contacts.length < 2}
            className="px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium hover:bg-blue-100 disabled:opacity-50 flex items-center gap-1.5">
            {agentLoading === 'dedupe' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Network className="w-3.5 h-3.5" />}
            Find Duplicates
          </button>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Wand2 className="w-3 h-3" /> Enrich individual contacts from their expanded view
          </span>
        </div>
      </div>

      {/* ===== Search + Sort + View Mode + Select Toggle ===== */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, org, or role..."
            className="w-full pl-10 pr-20 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 focus:bg-white transition-colors"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {searchQuery && (
              <>
                <span className="text-[10px] text-gray-400 tabular-nums">{filteredContacts.length} result{filteredContacts.length !== 1 ? 's' : ''}</span>
                <button onClick={() => setSearchQuery('')}
                  className="text-gray-400 hover:text-gray-600 p-0.5 hover:bg-gray-100 rounded transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
            {!searchQuery && (
              <kbd className="text-[10px] font-mono text-gray-400 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 pointer-events-none">/</kbd>
            )}
          </div>
        </div>

        {/* Sort dropdown with direction indicator */}
        <div className="relative flex items-center">
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-0.5">
            {getSortIcon()}
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="appearance-none pl-8 pr-6 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
            <option value="most-active">Most Active</option>
            <option value="least-active">Least Active</option>
            <option value="recently-added">Recently Added</option>
            <option value="most-topics">Most Topics</option>
            <option value="organization">Organization</option>
          </select>
        </div>

        {/* View mode toggle */}
        <div className="flex border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-2 text-xs font-medium flex items-center gap-1 transition-colors ${
              viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <LayoutList className="w-3.5 h-3.5" /> List
          </button>
          <button
            onClick={() => setViewMode('organizations')}
            className={`px-3 py-2 text-xs font-medium flex items-center gap-1 transition-colors ${
              viewMode === 'organizations' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" /> Orgs
          </button>
        </div>

        {/* Select toggle */}
        <button
          onClick={() => { setSelectMode(!selectMode); if (selectMode) deselectAll(); }}
          className={`px-3 py-2.5 border rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
            selectMode ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" /> Select
        </button>

        <button onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 transition-colors flex-shrink-0">
          {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showCreate ? 'Cancel' : 'Add Contact'}
        </button>
      </div>

      {/* ===== Filter Bar ===== */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-1 flex-shrink-0">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </div>

        {/* Area filter */}
        <select
          value={filterArea}
          onChange={e => setFilterArea(e.target.value)}
          className={`px-2.5 py-1.5 border rounded-full text-xs bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            filterArea ? 'border-blue-300 text-blue-700 bg-blue-50' : 'border-gray-200 text-gray-600'
          }`}
        >
          <option value="">All Areas</option>
          <option value="work">Work</option>
          <option value="personal">Personal</option>
          <option value="career">Career</option>
        </select>

        {/* Activity filter */}
        <select
          value={filterActivity}
          onChange={e => setFilterActivity(e.target.value)}
          className={`px-2.5 py-1.5 border rounded-full text-xs bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            filterActivity ? 'border-green-300 text-green-700 bg-green-50' : 'border-gray-200 text-gray-600'
          }`}
        >
          <option value="">All Activity</option>
          <option value="Active">Active</option>
          <option value="Recent">Recent</option>
          <option value="Idle">Idle</option>
          <option value="Cold">Cold</option>
          <option value="New">New</option>
        </select>

        {/* Has Topics filter */}
        <select
          value={filterHasTopics}
          onChange={e => setFilterHasTopics(e.target.value)}
          className={`px-2.5 py-1.5 border rounded-full text-xs bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            filterHasTopics ? 'border-indigo-300 text-indigo-700 bg-indigo-50' : 'border-gray-200 text-gray-600'
          }`}
        >
          <option value="">Topics: Any</option>
          <option value="yes">Has Topics</option>
          <option value="no">No Topics</option>
        </select>

        {/* Organization filter */}
        <select
          value={filterOrg}
          onChange={e => setFilterOrg(e.target.value)}
          className={`px-2.5 py-1.5 border rounded-full text-xs bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[180px] ${
            filterOrg ? 'border-purple-300 text-purple-700 bg-purple-50' : 'border-gray-200 text-gray-600'
          }`}
        >
          <option value="">All Organizations</option>
          <option value="__none__">No Organization</option>
          {uniqueOrganizations.map(org => (
            <option key={org} value={org}>{org}</option>
          ))}
        </select>

        {/* Has Email toggle */}
        <button
          onClick={() => setFilterHasEmail(!filterHasEmail)}
          className={`px-2.5 py-1.5 border rounded-full text-xs font-medium flex items-center gap-1 transition-colors ${
            filterHasEmail ? 'border-green-300 text-green-700 bg-green-50' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Mail className="w-3 h-3" /> Has Email
        </button>

        {/* Active filter pills + clear all */}
        {hasActiveFilters && (
          <>
            <span className="text-xs text-gray-400 mx-1">|</span>
            {filterArea && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs flex items-center gap-1">
                Area: {filterArea}
                <button onClick={() => setFilterArea('')} className="hover:text-blue-900"><X className="w-3 h-3" /></button>
              </span>
            )}
            {filterOrg && (
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs flex items-center gap-1">
                Org: {filterOrg === '__none__' ? 'None' : filterOrg}
                <button onClick={() => setFilterOrg('')} className="hover:text-purple-900"><X className="w-3 h-3" /></button>
              </span>
            )}
            {filterActivity && (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs flex items-center gap-1">
                {filterActivity}
                <button onClick={() => setFilterActivity('')} className="hover:text-green-900"><X className="w-3 h-3" /></button>
              </span>
            )}
            {filterHasEmail && (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs flex items-center gap-1">
                Has Email
                <button onClick={() => setFilterHasEmail(false)} className="hover:text-green-900"><X className="w-3 h-3" /></button>
              </span>
            )}
            {filterHasTopics && (
              <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs flex items-center gap-1">
                {filterHasTopics === 'yes' ? 'Has Topics' : 'No Topics'}
                <button onClick={() => setFilterHasTopics('')} className="hover:text-indigo-900"><X className="w-3 h-3" /></button>
              </span>
            )}
            {dashboardFilter && (
              <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs flex items-center gap-1">
                Dashboard: {dashboardFilter}
                <button onClick={() => setDashboardFilter('')} className="hover:text-amber-900"><X className="w-3 h-3" /></button>
              </span>
            )}
            <button onClick={clearAllFilters}
              className="text-xs text-red-500 hover:text-red-700 font-medium ml-1">
              Clear all filters
            </button>
          </>
        )}
      </div>

      {/* Showing X of Y + Select All/Deselect All */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-gray-500">
          Showing {filteredContacts.length} of {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
          {searchQuery && (
            <span className="ml-1 text-gray-400">
              for &ldquo;{searchQuery}&rdquo;
            </span>
          )}
        </span>
        {selectMode && (
          <div className="flex items-center gap-2">
            <button onClick={selectAll} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              Select All ({filteredContacts.length})
            </button>
            <span className="text-gray-300">|</span>
            <button onClick={deselectAll} className="text-xs text-gray-500 hover:text-gray-700 font-medium">
              Deselect All
            </button>
          </div>
        )}
      </div>

      {/* Extracted Contacts Panel */}
      {showExtracted && extractedContacts.length > 0 && (
        <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-purple-800 flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Discovered Contacts ({extractedContacts.length})
            </h3>
            <button onClick={() => setShowExtracted(false)} className="p-1 text-purple-400 hover:text-purple-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {extractedContacts.map((ec, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-purple-100">
                <div className={`w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center bg-gradient-to-br ${getAvatarGradient(ec.name)} text-white`}>
                  {initials(ec.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{ec.name}</p>
                  <div className="flex gap-2 text-xs text-gray-500">
                    {ec.email && <span>{ec.email}</span>}
                    {ec.role && <span className="text-gray-400">{ec.role}</span>}
                  </div>
                </div>
                <button onClick={() => addExtractedContact(ec)}
                  className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700 flex-shrink-0">
                  Add
                </button>
              </div>
            ))}
            <button onClick={() => {
              extractedContacts.forEach(ec => addExtractedContact(ec));
            }} className="w-full py-2 text-xs text-purple-600 font-medium hover:text-purple-800 text-center">
              Add All ({extractedContacts.length})
            </button>
          </div>
        </div>
      )}

      {/* Dedupe Results Panel */}
      {showDedupe && dedupeResults && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
              <Network className="w-4 h-4" /> Duplicate Analysis
            </h3>
            <button onClick={() => setShowDedupe(false)} className="p-1 text-blue-400 hover:text-blue-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="text-sm text-gray-700 prose prose-sm max-w-none">
            {dedupeResults.split('\n').map((line, i) => {
              if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 text-sm text-gray-700 mt-0.5">{line.slice(2)}</li>;
              if (line.trim() === '') return <br key={i} />;
              return <p key={i} className="text-sm text-gray-700 mt-1">{line}</p>;
            })}
          </div>
        </div>
      )}

      {/* ===== Create Form with animation ===== */}
      {showCreate && (
        <div
          className={`mb-6 p-5 bg-white rounded-xl border border-blue-200 shadow-sm transition-all duration-300 ease-out overflow-hidden ${
            createFormVisible ? 'opacity-100 max-h-[500px] translate-y-0' : 'opacity-0 max-h-0 -translate-y-2'
          }`}
        >
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Add New Contact</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Full Name *</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. John Smith"
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <input value={newEmail}
                onChange={e => {
                  setNewEmail(e.target.value);
                  if (emailError && isValidEmail(e.target.value)) setEmailError('');
                }}
                onBlur={() => {
                  if (newEmail && !isValidEmail(newEmail)) {
                    setEmailError('Please enter a valid email address');
                  } else {
                    setEmailError('');
                  }
                }}
                placeholder="e.g. john@company.com"
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${emailError ? 'border-red-300 focus:ring-red-500' : 'focus:ring-blue-500'}`}
                type="email" />
              {emailError && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {emailError}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Organization</label>
              <input value={newOrganization} onChange={e => setNewOrganization(e.target.value)} placeholder="e.g. Acme Corp"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
              <input value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="e.g. Engineering Manager"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Area</label>
              <select value={newArea} onChange={e => setNewArea(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">Select an area (optional)</option>
                <option value="work">Work</option>
                <option value="personal">Personal</option>
                <option value="career">Career</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Any additional notes about this contact..."
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={handleCreate} disabled={creating || !newName.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Contact
            </button>
            <button onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium transition-colors">
              Cancel
            </button>
            <span className="text-[11px] text-gray-400 ml-auto">
              Press <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px] font-mono">Esc</kbd> to close
            </span>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" /> Import Contacts
              </h3>
              <button onClick={() => setShowImport(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
              <Upload className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-600 font-medium">Drag & drop a CSV or vCard file</p>
              <p className="text-xs text-gray-400 mt-1">Or click to browse files</p>
              <p className="text-xs text-gray-400 mt-3">Import functionality coming soon</p>
            </div>
            <button onClick={() => setShowImport(false)}
              className="mt-4 w-full py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">
              Close
            </button>
          </div>
        </div>
      )}

      {/* ===== Needs Follow-up Section ===== */}
      {followUpContacts.length > 0 && !dashboardFilter && (
        <div className="mb-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Needs Follow-up ({followUpContacts.length})
            </h3>
            <button onClick={() => setDashboardFilter('followup')} className="text-xs text-amber-600 hover:text-amber-800 font-medium">
              View all
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {followUpContacts.slice(0, 5).map(c => (
              <button key={c.id} onClick={() => router.push(`/contacts/${c.id}`)}
                className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-amber-100 hover:border-amber-300 transition-colors flex-shrink-0">
                <div className={`w-7 h-7 rounded-full text-xs font-medium flex items-center justify-center bg-gradient-to-br ${getAvatarGradient(c.name)} text-white`}>
                  {initials(c.name)}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-amber-600">{getRelativeTime(c.last_interaction_at)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== MAIN CONTENT ===== */}
      {contacts.length === 0 && !searchQuery ? (
        /* ===== Empty State with Onboarding ===== */
        <div className="text-center py-16">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-purple-50 to-green-100 rounded-3xl rotate-6" />
            <div className="absolute inset-0 bg-white rounded-3xl shadow-sm flex items-center justify-center">
              <Users className="w-10 h-10 text-blue-400" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-purple-500" />
            </div>
          </div>

          <h2 className="text-xl font-bold text-gray-800 mb-2">No contacts yet</h2>
          <p className="text-sm text-gray-500 mb-2 max-w-lg mx-auto">
            Build your relationship network by adding contacts. Track interactions, link them to topics, and let AI help you stay on top of important connections.
          </p>
          <p className="text-xs text-gray-400 mb-10">Choose how you want to get started:</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
            {/* Card 1: Extract from Topics (AI) */}
            <button
              onClick={runExtractContacts}
              disabled={!!agentLoading}
              className="p-6 bg-white rounded-xl border-2 border-purple-100 hover:border-purple-300 hover:shadow-lg transition-all text-left group relative overflow-hidden"
            >
              <div className="absolute top-2 right-2">
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded-full">AI</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <UserPlus className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-1">Extract from Topics</h3>
              <p className="text-xs text-gray-500 leading-relaxed">AI scans your emails, docs, and linked items to automatically discover contacts</p>
            </button>

            {/* Card 2: Import Contacts (CSV) */}
            <button
              onClick={() => setShowImport(true)}
              className="p-6 bg-white rounded-xl border-2 border-blue-100 hover:border-blue-300 hover:shadow-lg transition-all text-left group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-1">Import Contacts</h3>
              <p className="text-xs text-gray-500 leading-relaxed">Upload a CSV or vCard file from your existing address book or CRM</p>
            </button>

            {/* Card 3: Add Manually */}
            <button
              onClick={() => setShowCreate(true)}
              className="p-6 bg-white rounded-xl border-2 border-green-100 hover:border-green-300 hover:shadow-lg transition-all text-left group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-100 to-green-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-1">Add Manually</h3>
              <p className="text-xs text-gray-500 leading-relaxed">Create a contact by hand with name, email, organization, and custom notes</p>
            </button>
          </div>

          <p className="text-[11px] text-gray-400 mt-8">
            Keyboard shortcut: press <kbd className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-mono border border-gray-200">N</kbd> to add a new contact
          </p>
        </div>
      ) : filteredContacts.length === 0 ? (
        /* ===== No Results State ===== */
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
          <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No contacts match your filters</p>
          <p className="text-sm text-gray-400 mt-1">
            {searchQuery && <>No results for &ldquo;{searchQuery}&rdquo;. </>}
            Try adjusting your search or filters.
          </p>
          <button onClick={() => { clearAllFilters(); setSearchQuery(''); }}
            className="mt-4 px-4 py-2 text-sm text-blue-600 hover:text-blue-800 font-medium bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
            Clear all filters
          </button>
        </div>
      ) : viewMode === 'organizations' ? (
        /* ===== Organization Grouping View ===== */
        <div className="space-y-3">
          {organizationGroups.map(group => {
            const isExpanded = expandedOrgs.has(group.key);
            return (
              <div key={group.key} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Org card header */}
                <button
                  onClick={() => toggleOrgExpanded(group.key)}
                  className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      group.key === '__no_org__' ? 'bg-gray-100' : 'bg-purple-100'
                    }`}>
                      <Building2 className={`w-5 h-5 ${
                        group.key === '__no_org__' ? 'text-gray-400' : 'text-purple-600'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{group.name}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {group.contacts.length} member{group.contacts.length !== 1 ? 's' : ''}
                        </span>
                        {group.totalTopics > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                            {group.totalTopics} topic{group.totalTopics !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {/* Avatar row: first 5 members */}
                      <div className="flex items-center gap-1 mt-1.5">
                        {group.contacts.slice(0, 5).map(c => (
                          <div key={c.id} className={`w-6 h-6 rounded-full text-[9px] font-medium flex items-center justify-center bg-gradient-to-br ${getAvatarGradient(c.name)} text-white`}>
                            {initials(c.name)}
                          </div>
                        ))}
                        {group.contacts.length > 5 && (
                          <span className="text-xs text-gray-400 ml-1">+{group.contacts.length - 5} more</span>
                        )}
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Expanded: Organization Detail Panel */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {/* Quick stats */}
                    <div className="px-4 py-3 bg-gray-50 flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {group.contacts.length} contact{group.contacts.length !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <StickyNote className="w-3 h-3" /> {group.totalTopics} topic{group.totalTopics !== 1 ? 's' : ''}
                      </span>
                      {group.sharedTopics.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-gray-400">Topics:</span>
                          {group.sharedTopics.slice(0, 5).map((t, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">{t}</span>
                          ))}
                          {group.sharedTopics.length > 5 && (
                            <span className="text-gray-400">+{group.sharedTopics.length - 5} more</span>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Contact list within org */}
                    <div className="p-3 space-y-2">
                      {group.contacts.map((c, i) => renderContactCard(c, i))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ===== List View (default) ===== */
        <div className="space-y-2">
          {filteredContacts.map((c, i) => renderContactCard(c, i))}
        </div>
      )}

      {/* ===== Floating Bulk Actions Bar ===== */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white rounded-2xl shadow-2xl border border-gray-200 px-6 py-3 flex items-center gap-3 animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2 pr-3 border-r border-gray-200">
            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center tabular-nums">
              {selectedIds.size}
            </div>
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
              contact{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
          </div>

          {/* Delete Selected */}
          <button onClick={bulkDelete}
            className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100 flex items-center gap-1.5 transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>

          {/* Assign Area dropdown */}
          <div className="relative">
            <select
              onChange={e => { if (e.target.value !== '__placeholder__') bulkSetArea(e.target.value); e.target.value = '__placeholder__'; }}
              defaultValue="__placeholder__"
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="__placeholder__" disabled>Assign Area</option>
              <option value="work">Work</option>
              <option value="personal">Personal</option>
              <option value="career">Career</option>
              <option value="">Clear Area</option>
            </select>
          </div>

          {/* AI Enrich All */}
          <button
            onClick={async () => {
              const ids = Array.from(selectedIds);
              toast.info(`Enriching ${ids.length} contact(s)...`);
              let enriched = 0;
              for (const id of ids) {
                try {
                  await runEnrichContact(id);
                  enriched++;
                } catch { /* skip */ }
              }
              toast.success(`Enriched ${enriched} of ${ids.length} contact(s)`);
            }}
            disabled={!!agentLoading}
            className="px-3 py-1.5 bg-purple-50 text-purple-600 border border-purple-200 rounded-lg text-xs font-medium hover:bg-purple-100 flex items-center gap-1.5 transition-colors disabled:opacity-50">
            {agentLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />} AI Enrich
          </button>

          {/* Export Selected */}
          <button
            onClick={() => {
              const selected = contacts.filter(c => selectedIds.has(c.id));
              const csv = [
                ['Name', 'Email', 'Organization', 'Role', 'Area', 'Notes'].join(','),
                ...selected.map(c =>
                  [c.name, c.email || '', c.organization || '', c.role || '', c.area || '', (c.notes || '').replace(/,/g, ';')].map(v => `"${v}"`).join(',')
                ),
              ].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `contacts-export-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success(`Exported ${selected.length} contact(s) as CSV`);
            }}
            className="px-3 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-100 flex items-center gap-1.5 transition-colors">
            <Download className="w-3.5 h-3.5" /> Export
          </button>

          <div className="w-px h-6 bg-gray-200" />

          <button onClick={() => { deselectAll(); setSelectMode(false); }}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors" title="Deselect all">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mobile Floating Action Button */}
      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 flex items-center justify-center z-30 md:hidden transition-colors"
        aria-label="Add contact"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
