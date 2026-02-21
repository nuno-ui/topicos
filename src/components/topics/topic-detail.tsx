'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { sourceLabel, formatRelativeDate, sourceBorderClass, sourceIconBgClass, formatSmartDate, AREA_COLORS, decodeHtmlEntities } from '@/lib/utils';
import { SourceIcon } from '@/components/ui/source-icon';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NoteEditor } from './note-editor';
import { NoteCard } from './note-card';
import { TopicTimeline } from './topic-timeline';
import { Search, Sparkles, Link2, Unlink, ExternalLink, ChevronDown, ChevronUp, Edit3, Archive, Trash2, Save, X, Bot, RefreshCw, StickyNote, Loader2, CheckSquare, Square, MessageSquare, Tag, Wand2, ListChecks, Users, Clock, FileText, Brain, Zap, Heart, AlertTriangle, TrendingUp, Eye, EyeOff, Pin, ArrowUp, ArrowDown, ArrowRight, ArrowLeft, Layers, GitBranch, Compass, Award, Target, MoreHorizontal, ChevronRight, Info, Calendar, FolderOpen, Check, CircleDot, Keyboard, Activity } from 'lucide-react';
import { HierarchyPicker, buildFolderPickerItems, buildTopicPickerItems } from '@/components/ui/hierarchy-picker';
import { ContactPicker, type ContactOption } from '@/components/ui/contact-picker';

interface TopicItem {
  id: string;
  topic_id: string;
  source: string;
  external_id: string;
  source_account_id: string | null;
  title: string;
  snippet: string;
  body?: string | null;
  url: string;
  occurred_at: string;
  created_at: string;
  metadata: Record<string, unknown>;
  linked_by?: string;
  confidence?: number;
  link_reason?: string;
}

interface SearchResult {
  external_id: string;
  source: string;
  source_account_id: string;
  title: string;
  snippet: string;
  url: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
  already_linked?: boolean;
  ai_confidence?: number;
  ai_reason?: string;
}

interface Topic {
  id: string;
  title: string;
  description: string | null;
  status: string;
  area: string;
  due_date: string | null;
  start_date: string | null;
  priority: number;
  tags: string[];
  summary: string | null;
  next_steps: Array<{ action: string; priority: string; rationale: string }> | null;
  urgency_score: number | null;
  notes: string | null;
  owner: string | null;
  owner_contact_id: string | null;
  stakeholders: string[];
  progress_percent: number | null;
  risk_level: string | null;
  client: string | null;
  company: string | null;
  goal: string | null;
  folder_id: string | null;
  parent_topic_id: string | null;
  is_ongoing?: boolean;
  created_at: string;
  updated_at: string;
}

interface LinkedContact {
  id: string;
  contact_id: string;
  topic_id: string;
  role: string | null;
  created_at: string;
  contacts: {
    id: string;
    name: string;
    email: string | null;
    organization: string | null;
    role: string | null;
  } | null;
}

type SectionTab = 'items' | 'tasks' | 'intelligence' | 'search' | 'details' | 'contacts' | 'notes' | 'timeline';

interface TopicTask {
  id: string;
  topic_id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'archived';
  priority: 'high' | 'medium' | 'low';
  due_date: string | null;
  assignee: string | null;
  assignee_contact_id: string | null;
  source: 'manual' | 'ai_extracted';
  source_item_ref: string | null;
  position: number;
  completed_at: string | null;
  archived_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const SOURCES = ['gmail', 'calendar', 'drive', 'slack', 'notion', 'manual', 'link'] as const;

interface ChildTopic {
  id: string;
  title: string;
  status: string;
  area: string;
  priority: number;
  updated_at: string;
  progress_percent: number | null;
  description: string | null;
  tags: string[];
  parent_topic_id: string | null;
}

interface ParentTopic {
  id: string;
  title: string;
  area: string;
  parent_topic_id: string | null;
}

export function TopicDetail({ topic: initialTopic, initialItems, initialContacts = [], childTopics = [], parentTopic = null, initialTasks = [] }: { topic: Topic; initialItems: TopicItem[]; initialContacts?: LinkedContact[]; childTopics?: ChildTopic[]; parentTopic?: ParentTopic | null; initialTasks?: TopicTask[] }) {
  const router = useRouter();
  const [topic, setTopic] = useState(initialTopic);
  const [items, setItems] = useState(initialItems);

  // Tab navigation
  const [activeSection, setActiveSection] = useState<SectionTab>('items');

  // Contacts management
  const [linkedContacts, setLinkedContacts] = useState<LinkedContact[]>(initialContacts);
  const [showLinkContactForm, setShowLinkContactForm] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [allContacts, setAllContacts] = useState<Array<{id: string; name: string; email: string | null}>>([]);
  const [contactSearchLoading, setContactSearchLoading] = useState(false);
  const [linkingContact, setLinkingContact] = useState(false);
  const [savingExtractedContacts, setSavingExtractedContacts] = useState<Set<number>>(new Set());

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchSources, setSearchSources] = useState<Set<string>>(new Set(SOURCES));
  // Search advanced options
  const [searchMaxResults, setSearchMaxResults] = useState(20);
  const [searchAccounts, setSearchAccounts] = useState<{ google: Array<{ id: string; email: string }>; slack: Array<{ id: string; name: string }>; notion: Array<{ id: string; name: string }> }>({ google: [], slack: [], notion: [] });
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [showSearchOptions, setShowSearchOptions] = useState(false);

  // AI Find state
  const [aiFindLoading, setAiFindLoading] = useState(false);
  const [aiFindResults, setAiFindResults] = useState<SearchResult[]>([]);
  const [selectedAiResults, setSelectedAiResults] = useState<Set<string>>(new Set());
  const [showAiResults, setShowAiResults] = useState(false);

  // Review Recent Activity state
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewResults, setReviewResults] = useState<SearchResult[]>([]);
  const [selectedReviewResults, setSelectedReviewResults] = useState<Set<string>>(new Set());
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [reviewTimePeriod, setReviewTimePeriod] = useState<'15d' | '1m' | '3m'>('1m');
  const [reviewSources, setReviewSources] = useState<Set<string>>(new Set(['gmail', 'calendar', 'drive', 'slack', 'notion']));

  // AI Analysis state
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(topic.summary || null);
  const [showAnalysis, setShowAnalysis] = useState(!!topic.summary);

  // Linked items filter
  const [activeTab, setActiveTab] = useState<string>('all');

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(topic.title);
  const [editDescription, setEditDescription] = useState(topic.description || '');
  const [editArea, setEditArea] = useState(topic.area);
  const [editStatus, setEditStatus] = useState(topic.status);
  const [editDueDate, setEditDueDate] = useState(topic.due_date || '');
  const [editPriority, setEditPriority] = useState(topic.priority ?? 0);
  const [editTags, setEditTags] = useState(topic.tags?.join(', ') || '');
  const [editStartDate, setEditStartDate] = useState(topic.start_date || '');
  const [editProgress, setEditProgress] = useState(topic.progress_percent ?? 0);
  const [editFolderId, setEditFolderId] = useState(topic.folder_id || '');
  const [editParentTopicId, setEditParentTopicId] = useState(topic.parent_topic_id || '');
  const [editOwner, setEditOwner] = useState(topic.owner || '');
  const [editOwnerContactId, setEditOwnerContactId] = useState(topic.owner_contact_id || null);
  const [editGoal, setEditGoal] = useState(topic.goal || '');
  const [pickerContacts, setPickerContacts] = useState<ContactOption[]>([]);
  const [editIsOngoing, setEditIsOngoing] = useState(topic.is_ongoing || false);

  // Folders for folder picker (full data for hierarchy display)
  const [folders, setFolders] = useState<Array<{ id: string; name: string; parent_id: string | null; color: string | null; area: string | null; position: number }>>([]);
  // All topics for parent topic picker
  const [allTopics, setAllTopics] = useState<Array<{ id: string; title: string; parent_topic_id: string | null; area?: string; status?: string }>>([]);
  useEffect(() => {
    fetch('/api/folders').then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(d => setFolders((d.folders || []).map((f: Record<string, unknown>) => ({ id: f.id, name: f.name, parent_id: f.parent_id || null, color: f.color || null, area: f.area || null, position: f.position || 0 })))).catch(() => {});
    fetch('/api/topics?limit=200&status=all').then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(d => {
      setAllTopics((d.topics || []).map((t: Record<string, unknown>) => ({ id: t.id as string, title: t.title as string, parent_topic_id: (t.parent_topic_id as string | null) || null, area: t.area as string | undefined, status: t.status as string | undefined })));
    }).catch(() => {});
    // Fetch connected accounts for search filters (lightweight: empty source search just to get accounts list)
    fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: '_', sources: [] }) })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.accounts) setSearchAccounts(d.accounts); })
      .catch(() => {});
    // Always refresh items from DB on mount to avoid stale SSR cache
    fetch(`/api/topics/${initialTopic.id}/items`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.items) setItems(d.items); })
      .catch(() => {});
    // Also refresh topic data (notes, status, etc.) in case SSR cache is stale
    fetch(`/api/topics/${initialTopic.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.topic) { setTopic(d.topic); setNotes(d.topic.notes || ''); } })
      .catch(() => {});
    // Refresh tasks on mount
    fetch(`/api/topics/${initialTopic.id}/tasks`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.tasks) setTasks(d.tasks); })
      .catch(() => {});
    // Fetch all contacts for pickers (assignee, owner)
    fetch('/api/contacts?limit=200')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.contacts) {
          setPickerContacts(d.contacts.map((c: { id: string; name: string; email: string | null; organization: string | null; area: string | null }) => ({
            id: c.id, name: c.name, email: c.email, organization: c.organization, area: c.area,
          })));
        }
      })
      .catch(() => {});
  }, []);

  // Notes state
  const [notes, setNotes] = useState(topic.notes || '');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesFocused, setNotesFocused] = useState(false);
  const notesAutoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Linking state
  const [linkingItems, setLinkingItems] = useState(false);

  // AI Question state
  const [aiQuestion, setAiQuestion] = useState('');

  // AI Agent state
  const [agentLoading, setAgentLoading] = useState<string | null>(null);
  const [actionItems, setActionItems] = useState<Array<{ task: string; assignee: string; due: string; priority: string }>>([]);
  const [showActionItems, setShowActionItems] = useState(false);
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);
  const [extractedContacts, setExtractedContacts] = useState<Array<{ name: string; email: string; role: string }>>([]);
  const [showExtractedContacts, setShowExtractedContacts] = useState(false);
  const [threadSummary, setThreadSummary] = useState<string | null>(null);
  const [showThreadSummary, setShowThreadSummary] = useState(false);
  const [goalProposal, setGoalProposal] = useState<{ proposed_goal: string; reasoning: string; is_improvement: boolean; current_goal: string | null; alternatives: string[] } | null>(null);

  // Note editor state
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [editingNote, setEditingNote] = useState<Record<string, unknown> | null>(null);

  // Link form state
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkSaving, setLinkSaving] = useState(false);
  const [itemsRefreshing, setItemsRefreshing] = useState(false);

  // Tasks state
  const [tasks, setTasks] = useState<TopicTask[]>(initialTasks);
  const [taskFilter, setTaskFilter] = useState<'active' | 'completed' | 'archived' | 'all'>('active');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskSaving, setTaskSaving] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskFormData, setTaskFormData] = useState<{
    title: string; description: string; assignee: string; assignee_contact_id: string | null; priority: 'high' | 'medium' | 'low'; due_date: string;
  }>({ title: '', description: '', assignee: '', assignee_contact_id: null, priority: 'medium', due_date: '' });
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskData, setEditingTaskData] = useState<{
    title: string; description: string; assignee: string; assignee_contact_id: string | null; priority: 'high' | 'medium' | 'low'; due_date: string; status: string;
  }>({ title: '', description: '', assignee: '', assignee_contact_id: null, priority: 'medium', due_date: '', status: 'pending' });
  const [taskRecommendations, setTaskRecommendations] = useState<Array<{
    title: string; description: string; priority: string; assignee: string; due: string; rationale: string;
  }>>([]);

  // Content expand state
  const [expandedContent, setExpandedContent] = useState<Record<string, string>>({});
  const [loadingContent, setLoadingContent] = useState<Set<string>>(new Set());

  // Deep dive and recommend agent state
  const [deepDiveReport, setDeepDiveReport] = useState<string | null>(null);
  const [showDeepDive, setShowDeepDive] = useState(false);
  const [recommendations, setRecommendations] = useState<Array<{ source: string; query: string; reason: string; expected_type: string }>>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [entities, setEntities] = useState<Record<string, unknown> | null>(null);
  const [showEntities, setShowEntities] = useState(false);
  const [relatedTopics, setRelatedTopics] = useState<Array<{ topic_id: string; title: string; reason: string; confidence: number; relationship: string }>>([]);
  const [showRelatedTopics, setShowRelatedTopics] = useState(false);
  const [completenessScore, setCompletenessScore] = useState<Record<string, unknown> | null>(null);
  const [showCompleteness, setShowCompleteness] = useState(false);

  // UX improvement state
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showAgentMenu, setShowAgentMenu] = useState(false);

  // Quick progress update state
  const [showProgressPicker, setShowProgressPicker] = useState(false);
  const [progressUpdating, setProgressUpdating] = useState(false);

  // Keyboard shortcuts hint state
  const [showKeyboardHints, setShowKeyboardHints] = useState(false);

  // AI Summary collapse state
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);

  // AI Agent success animation and last run tracking
  const [agentSuccess, setAgentSuccess] = useState<string | null>(null);
  const [agentLastRun, setAgentLastRun] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`agent-runs-${initialTopic.id}`);
        return stored ? JSON.parse(stored) : {};
      } catch { return {}; }
    }
    return {};
  });

  // Listen for command palette "add note" event
  useEffect(() => {
    const handler = () => setShowNoteEditor(true);
    window.addEventListener('topicos:add-note', handler);
    return () => window.removeEventListener('topicos:add-note', handler);
  }, []);

  // Keyboard navigation shortcuts
  const sectionTabOrder: SectionTab[] = ['items', 'tasks', 'intelligence', 'search', 'details', 'contacts', 'notes', 'timeline'];
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;
      // Tab key cycles between section tabs (only when not in input)
      if (e.key === 'Tab' && !isInputFocused && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setActiveSection(prev => {
          const idx = sectionTabOrder.indexOf(prev);
          if (e.shiftKey) {
            return sectionTabOrder[(idx - 1 + sectionTabOrder.length) % sectionTabOrder.length];
          }
          return sectionTabOrder[(idx + 1) % sectionTabOrder.length];
        });
      }
      // 'n' key opens note editor (when not in input)
      if (e.key === 'n' && !isInputFocused && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setShowNoteEditor(true);
      }
      // '?' key toggles keyboard hints
      if (e.key === '?' && !isInputFocused) {
        e.preventDefault();
        setShowKeyboardHints(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Quick progress update function
  const updateProgressQuick = async (value: number) => {
    setProgressUpdating(true);
    try {
      const res = await fetch(`/api/topics/${topic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress_percent: value }),
      });
      if (!res.ok) throw new Error('Failed to update progress');
      const data = await res.json();
      setTopic(prev => ({ ...prev, ...data.topic }));
      setShowProgressPicker(false);
      toast.success(`Progress updated to ${value}%`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update progress');
    }
    setProgressUpdating(false);
  };

  // Health score calculation
  const healthScore = (() => {
    let score = 0;
    if (topic.description) score += 20;
    if (items.length > 0) score += 20;
    const daysSinceUpdate = Math.floor((Date.now() - new Date(topic.updated_at).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceUpdate <= 7) score += 20;
    if (topic.due_date) score += 20;
    if (topic.tags && topic.tags.length > 0) score += 20;
    return score;
  })();
  const healthLabel = healthScore >= 80 ? 'Excellent' : healthScore >= 50 ? 'Good' : 'Needs Attention';
  const healthColor = healthScore >= 80 ? 'text-green-600' : healthScore >= 50 ? 'text-amber-600' : 'text-red-600';
  const healthBg = healthScore >= 80 ? 'bg-green-500' : healthScore >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const healthRingColor = healthScore >= 80 ? '#22c55e' : healthScore >= 50 ? '#f59e0b' : '#ef4444';

  // Contact search effects
  useEffect(() => {
    if (showLinkContactForm && allContacts.length === 0) searchContacts('');
  }, [showLinkContactForm, allContacts.length]);

  useEffect(() => {
    if (!showLinkContactForm) return;
    const timer = setTimeout(() => searchContacts(contactSearchQuery), 300);
    return () => clearTimeout(timer);
  }, [contactSearchQuery, showLinkContactForm]);

  // Contact management functions
  const searchContacts = useCallback(async (query: string) => {
    setContactSearchLoading(true);
    try {
      const res = await fetch(`/api/contacts?search=${encodeURIComponent(query)}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setAllContacts(data.contacts || []);
      }
    } catch {}
    setContactSearchLoading(false);
  }, []);

  const linkContact = async (contactId: string, role?: string) => {
    setLinkingContact(true);
    try {
      const res = await fetch(`/api/topics/${topic.id}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contactId, role: role || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      const data = await res.json();
      setLinkedContacts(prev => [...prev.filter(c => c.contact_id !== contactId), data.link]);
      setShowLinkContactForm(false);
      setContactSearchQuery('');
      toast.success('Contact linked');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
    setLinkingContact(false);
  };

  const unlinkContact = async (contactId: string) => {
    try {
      const res = await fetch(`/api/topics/${topic.id}/contacts?contact_id=${contactId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      setLinkedContacts(prev => prev.filter(c => c.contact_id !== contactId));
      toast.success('Contact unlinked');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  // Save an extracted contact to the contacts DB and link to this topic
  const saveAndLinkExtractedContact = async (contact: { name: string; email: string; role: string }, index: number) => {
    setSavingExtractedContacts(prev => new Set(prev).add(index));
    try {
      // 1. Create or upsert the contact
      const createRes = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contact.name,
          email: contact.email || null,
          role: contact.role || null,
          area: topic.area || 'work',
        }),
      });
      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create contact');
      }
      const contactData = await createRes.json();
      const contactId = contactData.contact?.id;
      if (!contactId) throw new Error('No contact ID returned');

      // 2. Link the contact to this topic
      const linkRes = await fetch(`/api/topics/${topic.id}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contactId, role: contact.role || null }),
      });
      if (!linkRes.ok) {
        const errData = await linkRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to link contact');
      }
      const linkData = await linkRes.json();

      // 3. Update local state
      setLinkedContacts(prev => [...prev.filter(c => c.contact_id !== contactId), linkData.link]);
      toast.success(`${contact.name} saved & linked to topic`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save contact');
    }
    setSavingExtractedContacts(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  // Save ALL extracted contacts and link them to this topic
  const saveAllExtractedContacts = async () => {
    let saved = 0;
    let failed = 0;
    for (let i = 0; i < extractedContacts.length; i++) {
      const c = extractedContacts[i];
      // Skip if already linked (check by email)
      const alreadyLinked = linkedContacts.some(lc =>
        lc.contacts?.email && c.email && lc.contacts.email.toLowerCase() === c.email.toLowerCase()
      );
      if (alreadyLinked) continue;

      setSavingExtractedContacts(prev => new Set(prev).add(i));
      try {
        const createRes = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: c.name,
            email: c.email || null,
            role: c.role || null,
            area: topic.area || 'work',
          }),
        });
        if (!createRes.ok) throw new Error('Create failed');
        const contactData = await createRes.json();
        const contactId = contactData.contact?.id;
        if (!contactId) throw new Error('No ID');

        const linkRes = await fetch(`/api/topics/${topic.id}/contacts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contact_id: contactId, role: c.role || null }),
        });
        if (linkRes.ok) {
          const linkData = await linkRes.json();
          setLinkedContacts(prev => [...prev.filter(lc => lc.contact_id !== contactId), linkData.link]);
          saved++;
        } else { failed++; }
      } catch { failed++; }
      setSavingExtractedContacts(prev => {
        const next = new Set(prev);
        next.delete(i);
        return next;
      });
    }
    if (saved > 0) toast.success(`Saved & linked ${saved} contact${saved !== 1 ? 's' : ''}`);
    if (failed > 0) toast.error(`${failed} contact${failed !== 1 ? 's' : ''} failed`);
  };

  // Refresh topic data from server
  const refreshTopic = useCallback(async () => {
    try {
      const res = await fetch(`/api/topics/${topic.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.topic) {
          setTopic(data.topic);
        }
      }
    } catch {
      // silent fail - data is still updated locally
    }
  }, [topic.id]);
  // Run an AI agent
  const runAgent = async (agent: string) => {
    setAgentLoading(agent);
    try {
      const res = await fetch('/api/ai/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent, context: { topic_id: topic.id } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      switch (agent) {
        case 'auto_tag':
          setTopic(prev => ({ ...prev, tags: data.result.tags, area: data.result.area, priority: data.result.priority }));
          toast.success(`Added ${data.result.tags.length} tags, area: ${data.result.area}, priority: ${data.result.priority}`);
          // Refresh from server to get latest persisted state
          await refreshTopic();
          break;
        case 'suggest_title':
          setTitleSuggestions(data.result.suggestions);
          setShowTitleSuggestions(true);
          break;
        case 'generate_description':
          setTopic(prev => ({ ...prev, description: data.result.description }));
          toast.success('Description generated');
          // Also save to DB
          await fetch(`/api/topics/${topic.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: data.result.description }),
          });
          // Refresh from server to get latest persisted state
          await refreshTopic();
          break;
        case 'extract_action_items':
          setActionItems(data.result.action_items || []);
          setShowActionItems(true);
          toast.success(`Found ${data.result.action_items?.length || 0} action items`);
          break;
        case 'summarize_thread':
          setThreadSummary(data.result.summary);
          setShowThreadSummary(true);
          toast.success('Thread summarized');
          break;
        case 'find_contacts':
          setExtractedContacts(data.result.contacts || []);
          setShowExtractedContacts(true);
          toast.success(`Found ${data.result.contacts?.length || 0} contacts`);
          break;
        case 'deep_dive':
          setDeepDiveReport(data.result.report);
          setShowDeepDive(true);
          toast.success(`Deep Dive done, ${data.result.enriched_count} items enriched`);
          break;
        case 'recommend_content':
          setRecommendations(data.result.recommendations || []);
          setShowRecommendations(true);
          toast.success(`${data.result.recommendations?.length || 0} recommendations found`);
          break;
        case 'extract_entities':
          setEntities(data.result);
          setShowEntities(true);
          toast.success('Entities extracted');
          break;
        case 'cross_topic_links':
          setRelatedTopics(data.result.related_topics || []);
          setShowRelatedTopics(true);
          toast.success(`Found ${data.result.related_topics?.length || 0} related topics`);
          break;
        case 'completeness_check':
          setCompletenessScore(data.result);
          setShowCompleteness(true);
          toast.success(`Completeness score: ${data.result.score}%`);
          break;
        case 'propose_goal':
          setGoalProposal(data.result);
          toast.success('Goal proposed!');
          break;
      }
      // Track success animation and last run time
      setAgentSuccess(agent);
      setTimeout(() => setAgentSuccess(null), 2000);
      const now = new Date().toISOString();
      setAgentLastRun(prev => {
        const next = { ...prev, [agent]: now };
        try { localStorage.setItem(`agent-runs-${topic.id}`, JSON.stringify(next)); } catch {}
        return next;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Agent failed');
    }
    setAgentLoading(null);
  };

  // Format agent last run time
  const formatAgentLastRun = (agent: string): string | null => {
    const ts = agentLastRun[agent];
    if (!ts) return null;
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Apply title suggestion
  const applyTitle = async (newTitle: string) => {
    const res = await fetch(`/api/topics/${topic.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    });
    if (res.ok) {
      setTopic(prev => ({ ...prev, title: newTitle }));
      setShowTitleSuggestions(false);
      toast.success('Title updated');
    }
  };

  // --- SEARCH ---
  const handleSearch = async (overrideMaxResults?: number) => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    if (!overrideMaxResults) setSearchResults([]);
    try {
      const effectiveMax = overrideMaxResults || searchMaxResults;
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          sources: Array.from(searchSources),
          topic_id: topic.id,
          max_results: effectiveMax,
          ...(selectedAccountIds.size > 0 ? { account_ids: Array.from(selectedAccountIds) } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const allItems: SearchResult[] = [];
      for (const src of data.results ?? []) {
        allItems.push(...(src.items ?? []));
      }
      // Mark already linked
      const linkedIds = new Set(items.map(i => i.source + ':' + i.external_id));
      allItems.forEach(item => {
        item.already_linked = linkedIds.has(item.source + ':' + item.external_id);
      });
      setSearchResults(allItems);
      if (!overrideMaxResults) setSelectedResults(new Set());
      // Save available accounts for the UI
      if (data.accounts) setSearchAccounts(data.accounts);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
    }
    setSearchLoading(false);
  };

  // --- AI FIND ---
  const handleAiFind = async () => {
    setAiFindLoading(true);
    setAiFindResults([]);
    setShowAiResults(true);
    try {
      const res = await fetch('/api/ai/find', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topic.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Mark already linked
      const linkedIds = new Set(items.map(i => i.source + ':' + i.external_id));
      const results = (data.results ?? []).map((r: SearchResult) => ({
        ...r,
        already_linked: linkedIds.has(r.source + ':' + r.external_id),
      }));
      setAiFindResults(results);
      setSelectedAiResults(new Set());
      toast.success(`Found ${results.length} relevant item${results.length !== 1 ? 's' : ''}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI Find failed');
    }
    setAiFindLoading(false);
  };

  // --- REVIEW RECENT ACTIVITY ---
  const handleReviewActivity = async () => {
    setReviewLoading(true);
    setReviewResults([]);
    setShowReviewPanel(true);
    try {
      const res = await fetch('/api/ai/review-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: topic.id,
          time_period: reviewTimePeriod,
          sources: Array.from(reviewSources),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Mark already linked (defensive, server already filters)
      const linkedIds = new Set(items.map(i => i.source + ':' + i.external_id));
      const results = (data.results ?? []).map((r: SearchResult) => ({
        ...r,
        already_linked: linkedIds.has(r.source + ':' + r.external_id),
      }));
      setReviewResults(results);
      setSelectedReviewResults(new Set());
      const periodLabel = reviewTimePeriod === '15d' ? '15 days' : reviewTimePeriod === '1m' ? 'month' : '3 months';
      toast.success(`Found ${results.length} item${results.length !== 1 ? 's' : ''} from the last ${periodLabel}`);
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

  const linkSelectedReview = () => {
    const toLink = reviewResults.filter(r =>
      selectedReviewResults.has(r.source + ':' + r.external_id) && !r.already_linked
    );
    if (toLink.length > 0) linkItems(toLink, 'ai_review');
  };

  // --- LINK ITEMS ---
  const linkItems = useCallback(async (resultsToLink: SearchResult[], linkedBy: string = 'user') => {
    setLinkingItems(true);
    let linked = 0;
    let alreadyLinked = 0;
    const successKeys = new Set<string>(); // Track successfully linked items
    for (const result of resultsToLink) {
      try {
        const res = await fetch(`/api/topics/${topic.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            external_id: result.external_id,
            source: result.source,
            source_account_id: result.source_account_id,
            title: result.title,
            snippet: result.snippet,
            url: result.url,
            occurred_at: result.occurred_at,
            metadata: result.metadata,
            linked_by: linkedBy,
            confidence: result.ai_confidence,
            link_reason: result.ai_reason,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setItems(prev => [data.item, ...prev]);
          linked++;
          successKeys.add(`${result.source}:${result.external_id}`);
        } else if (res.status === 409) {
          // Item already linked to this topic — make sure it's in local state
          const dupeData = await res.json();
          if (dupeData.same_topic) {
            alreadyLinked++;
            successKeys.add(`${result.source}:${result.external_id}`);
            // Check if it's already in local items state
            const alreadyInState = items.some(i => i.source === result.source && i.external_id === result.external_id);
            if (!alreadyInState) {
              // Item is in DB but not in local state — add a synthetic entry
              // so the user can see it in the linked items list
              setItems(prev => [{
                id: `existing-${result.source}-${result.external_id}`,
                topic_id: topic.id,
                source: result.source,
                external_id: result.external_id,
                source_account_id: result.source_account_id || null,
                title: result.title,
                snippet: result.snippet || '',
                url: result.url || '',
                occurred_at: result.occurred_at || new Date().toISOString(),
                created_at: new Date().toISOString(),
                metadata: result.metadata || {},
                linked_by: linkedBy,
              }, ...prev]);
            }
          } else {
            // Different topic — still link it (the API allows this)
            const forceRes = await fetch(`/api/topics/${topic.id}/items`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                external_id: result.external_id,
                source: result.source,
                source_account_id: result.source_account_id,
                title: result.title,
                snippet: result.snippet,
                url: result.url,
                occurred_at: result.occurred_at,
                metadata: result.metadata,
                linked_by: linkedBy,
                confidence: result.ai_confidence,
                link_reason: result.ai_reason,
                force: true,
              }),
            });
            if (forceRes.ok) {
              const data = await forceRes.json();
              setItems(prev => [data.item, ...prev]);
              linked++;
              successKeys.add(`${result.source}:${result.external_id}`);
            }
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          console.error('Link item failed:', res.status, errData);
          if (errData.constraint_error) {
            toast.error(`Database needs updating: run migration 009 in Supabase SQL Editor to enable ${result.source} linking`);
          }
        }
      } catch (err) {
        console.error('Link failed:', err);
      }
    }
    // Mark ONLY successfully linked items in search results (not failed ones)
    setSearchResults(prev => prev.map(r =>
      successKeys.has(`${r.source}:${r.external_id}`)
        ? { ...r, already_linked: true } : r
    ));
    setAiFindResults(prev => prev.map(r =>
      successKeys.has(`${r.source}:${r.external_id}`)
        ? { ...r, already_linked: true } : r
    ));
    setSelectedResults(new Set());
    setSelectedAiResults(new Set());
    setLinkingItems(false);
    // Refresh items from server to ensure state consistency
    try {
      const refreshRes = await fetch(`/api/topics/${topic.id}/items`);
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        setItems(refreshData.items || []);
      }
    } catch { /* silent */ }
    if (linked > 0 && alreadyLinked > 0) {
      toast.success(`Linked ${linked} new item${linked !== 1 ? 's' : ''}, ${alreadyLinked} already linked`);
    } else if (linked > 0) {
      toast.success(`Linked ${linked} item${linked !== 1 ? 's' : ''} to topic`);
    } else if (alreadyLinked > 0) {
      toast.info(`${alreadyLinked} item${alreadyLinked !== 1 ? 's were' : ' was'} already linked to this topic`);
    } else {
      toast.error('Failed to link items');
    }
    // Auto-refresh AI analysis when new items are linked so Notion/new content is included
    if (linked > 0) {
      // First enrich the newly linked items, then run AI analysis
      setAnalysisLoading(true);
      // Enrich first (fetches full content from Notion, Gmail, etc.), then analyze
      (async () => {
        try {
          await fetch(`/api/topics/${topic.id}/enrich`, { method: 'POST' }).catch(() => {});
          await refreshItems();
          const res = await fetch('/api/ai/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic_id: topic.id }),
          });
          if (res.ok) {
            const data = await res.json();
            setAnalysis(data.analysis);
            setShowAnalysis(true);
          }
        } catch { /* silent — user can manually refresh */ }
        finally { setAnalysisLoading(false); }
      })();
    }
  }, [topic.id, items]);

  const linkSelectedSearch = () => {
    const toLink = searchResults.filter(r =>
      selectedResults.has(r.source + ':' + r.external_id) && !r.already_linked
    );
    if (toLink.length === 0) { toast.error('No new items selected'); return; }
    linkItems(toLink, 'user');
  };

  const linkSelectedAi = () => {
    const toLink = aiFindResults.filter(r =>
      selectedAiResults.has(r.source + ':' + r.external_id) && !r.already_linked
    );
    if (toLink.length === 0) { toast.error('No new items selected'); return; }
    linkItems(toLink, 'ai');
  };

  // --- UNLINK ---
  const unlinkItem = async (itemId: string) => {
    if (!confirm('Unlink this item from the topic?')) return;
    try {
      const res = await fetch(`/api/topics/${topic.id}/items/${itemId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to unlink');
      setItems(prev => prev.filter(i => i.id !== itemId));
      toast.success('Item unlinked');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unlink failed');
    }
  };

  // --- EDIT TOPIC ---
  const saveTopic = async () => {
    try {
      const res = await fetch(`/api/topics/${topic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          area: editArea,
          status: editStatus,
          due_date: editIsOngoing ? null : (editDueDate || null),
          start_date: editIsOngoing ? null : (editStartDate || null),
          priority: editPriority,
          tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
          progress_percent: editProgress,
          folder_id: editFolderId || null,
          parent_topic_id: editParentTopicId || null,
          owner: editOwner.trim() || null,
          owner_contact_id: editOwnerContactId || null,
          goal: editGoal.trim() || null,
          is_ongoing: editIsOngoing,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTopic(prev => ({ ...prev, ...data.topic }));
      setEditing(false);
      toast.success('Topic updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  // --- DELETE TOPIC ---
  const deleteTopic = async () => {
    if (!confirm('Delete this topic and all linked items? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/topics/${topic.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Topic deleted');
      router.push('/topics');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  // --- ARCHIVE TOPIC ---
  const archiveTopic = async () => {
    const action = topic.status === 'archived' ? 'reactivate' : 'archive';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} this topic?`)) return;
    try {
      const newStatus = topic.status === 'archived' ? 'active' : 'archived';
      const res = await fetch(`/api/topics/${topic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTopic(data.topic);
      toast.success(newStatus === 'archived' ? 'Topic archived' : 'Topic reactivated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Archive failed');
    }
  };

  // --- SAVE NOTES ---
  const saveNotes = useCallback(async () => {
    setNotesSaving(true);
    setNotesSaved(false);
    try {
      const res = await fetch(`/api/topics/${topic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes || null }),
      });
      if (!res.ok) throw new Error('Failed to save notes');
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    }
    setNotesSaving(false);
  }, [topic.id, notes]);

  // Auto-save notes after 2 seconds of inactivity
  const handleNotesChange = (value: string) => {
    setNotes(value);
    setNotesSaved(false);
    if (notesAutoSaveRef.current) clearTimeout(notesAutoSaveRef.current);
    notesAutoSaveRef.current = setTimeout(() => {
      saveNotes();
    }, 2000);
  };

  // Cleanup auto-save on unmount
  useEffect(() => {
    return () => {
      if (notesAutoSaveRef.current) clearTimeout(notesAutoSaveRef.current);
    };
  }, []);

  // Word count helper
  const noteWordCount = notes.trim() ? notes.trim().split(/\s+/).length : 0;

  // --- FETCH ITEM CONTENT ---
  const fetchItemContent = async (itemId: string) => {
    setLoadingContent(prev => new Set(prev).add(itemId));
    try {
      const res = await fetch(`/api/topics/${topic.id}/items/${itemId}/content`);
      const data = await res.json();
      if (res.ok && data.body) {
        setExpandedContent(prev => ({ ...prev, [itemId]: data.body }));
      } else {
        setExpandedContent(prev => ({ ...prev, [itemId]: '[No content available]' }));
      }
    } catch {
      setExpandedContent(prev => ({ ...prev, [itemId]: '[Error fetching content]' }));
    }
    setLoadingContent(prev => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  };

  const toggleContent = (itemId: string) => {
    if (expandedContent[itemId] !== undefined) {
      setExpandedContent(prev => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    } else {
      fetchItemContent(itemId);
    }
  };

  // --- ADD LINK ---
  const addLink = async () => {
    const trimmed = linkUrl.trim();
    if (!trimmed) {
      toast.error('Please enter a URL');
      return;
    }
    // Basic URL validation
    let finalUrl = trimmed;
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    }
    try {
      new URL(finalUrl);
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }
    setLinkSaving(true);
    try {
      const res = await fetch(`/api/topics/${topic.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          external_id: finalUrl,
          source: 'link',
          source_account_id: '',
          title: linkTitle.trim() || finalUrl,
          snippet: '',
          url: finalUrl,
          occurred_at: new Date().toISOString(),
          metadata: {},
          linked_by: 'user',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add link');
      }
      const data = await res.json();
      setItems(prev => [data.item, ...prev]);
      setLinkUrl('');
      setLinkTitle('');
      setShowLinkForm(false);
      toast.success('Link added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add link');
    }
    setLinkSaving(false);
  };

  // --- REFRESH ITEMS FROM SERVER ---
  const refreshItems = useCallback(async () => {
    setItemsRefreshing(true);
    try {
      const res = await fetch(`/api/topics/${topic.id}/items`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error('Failed to refresh items:', err);
    }
    setItemsRefreshing(false);
  }, [topic.id]);

  // --- TASK FUNCTIONS ---
  const refreshTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const res = await fetch(`/api/topics/${topic.id}/tasks`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error('Failed to refresh tasks:', err);
    }
    setTasksLoading(false);
  }, [topic.id]);

  const createTask = async (titleOrData: string | { title: string; description?: string; assignee?: string; assignee_contact_id?: string | null; priority?: string; due_date?: string }) => {
    const payload = typeof titleOrData === 'string'
      ? { title: titleOrData.trim() }
      : {
          title: titleOrData.title.trim(),
          ...(titleOrData.description && { description: titleOrData.description.trim() }),
          ...(titleOrData.assignee && { assignee: titleOrData.assignee.trim() }),
          ...(titleOrData.assignee_contact_id && { assignee_contact_id: titleOrData.assignee_contact_id }),
          ...(titleOrData.priority && { priority: titleOrData.priority }),
          ...(titleOrData.due_date && { due_date: new Date(titleOrData.due_date).toISOString() }),
        };
    if (!payload.title) return;
    setTaskSaving(true);
    try {
      const res = await fetch(`/api/topics/${topic.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create task');
      const data = await res.json();
      setTasks(prev => [data.task, ...prev]);
      setNewTaskTitle('');
      setTaskFormData({ title: '', description: '', assignee: '', assignee_contact_id: null, priority: 'medium', due_date: '' });
      setShowTaskForm(false);
      toast.success('Task created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create task');
    }
    setTaskSaving(false);
  };

  const startEditingTask = (task: TopicTask) => {
    setEditingTaskId(task.id);
    setEditingTaskData({
      title: task.title,
      description: task.description || '',
      assignee: task.assignee || '',
      assignee_contact_id: task.assignee_contact_id || null,
      priority: task.priority,
      due_date: task.due_date ? task.due_date.split('T')[0] : '',
      status: task.status,
    });
  };

  const saveEditingTask = async () => {
    if (!editingTaskId || !editingTaskData.title.trim()) return;
    const updates: Record<string, unknown> = {
      title: editingTaskData.title.trim(),
      description: editingTaskData.description.trim(),
      assignee: editingTaskData.assignee.trim() || null,
      assignee_contact_id: editingTaskData.assignee_contact_id || null,
      priority: editingTaskData.priority,
      due_date: editingTaskData.due_date ? new Date(editingTaskData.due_date).toISOString() : null,
      status: editingTaskData.status,
    };
    await updateTask(editingTaskId, updates as Partial<TopicTask>);
    setEditingTaskId(null);
    toast.success('Task updated');
  };

  const cancelEditingTask = () => {
    setEditingTaskId(null);
  };

  const recommendTasks = async () => {
    setAgentLoading('recommend_tasks');
    setTaskRecommendations([]);
    try {
      const res = await fetch('/api/ai/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'recommend_tasks',
          context: {
            topic_id: topic.id,
            topic_title: topic.title,
            topic_description: topic.description,
          },
        }),
      });
      if (!res.ok) throw new Error('AI recommendation failed');
      const data = await res.json();
      if (data.result?.recommended_tasks?.length) {
        setTaskRecommendations(data.result.recommended_tasks);
        toast.success(`AI recommended ${data.result.recommended_tasks.length} tasks`);
      } else {
        toast.info('No additional tasks recommended — topic looks well-covered!');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to get recommendations');
    }
    setAgentLoading(null);
  };

  const acceptRecommendedTask = async (rec: { title: string; description: string; priority: string; assignee: string; due: string }) => {
    const payload = {
      title: rec.title,
      description: rec.description || '',
      priority: rec.priority || 'medium',
      assignee: rec.assignee || '',
      due_date: rec.due && rec.due !== 'No deadline' && rec.due !== 'N/A' ? rec.due : '',
    };
    await createTask(payload);
    setTaskRecommendations(prev => prev.filter(r => r.title !== rec.title));
  };

  const acceptAllRecommendedTasks = async () => {
    setTaskSaving(true);
    try {
      const res = await fetch('/api/ai/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'recommend_tasks',
          context: {
            topic_id: topic.id,
            topic_title: topic.title,
            topic_description: topic.description,
            persist_tasks: true,
          },
        }),
      });
      if (!res.ok) throw new Error('Failed to persist tasks');
      const data = await res.json();
      if (data.result?.tasks?.length) {
        setTasks(prev => [...data.result.tasks, ...prev]);
        setTaskRecommendations([]);
        toast.success(`Added ${data.result.persisted_count || data.result.tasks.length} recommended tasks`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add tasks');
    }
    setTaskSaving(false);
  };

  const updateTask = async (taskId: string, updates: Partial<TopicTask>) => {
    try {
      const res = await fetch(`/api/topics/${topic.id}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update task');
      const data = await res.json();
      setTasks(prev => prev.map(t => t.id === taskId ? data.task : t));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update task');
    }
  };

  const toggleTaskComplete = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await updateTask(taskId, { status: newStatus } as Partial<TopicTask>);
    toast.success(newStatus === 'completed' ? 'Task completed!' : 'Task reopened');
  };

  const archiveTask = async (taskId: string) => {
    await updateTask(taskId, { status: 'archived' } as Partial<TopicTask>);
    toast.success('Task archived');
  };

  const deleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/topics/${topic.id}/tasks/${taskId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete task');
      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast.success('Task deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete task');
    }
  };

  const extractAndPersistTasks = async () => {
    if (items.length === 0) {
      toast.error('Link some items first before extracting tasks');
      return;
    }
    setAgentLoading('extract_tasks');
    try {
      const res = await fetch('/api/ai/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'extract_action_items',
          context: {
            topic_id: topic.id,
            topic_title: topic.title,
            topic_description: topic.description,
            items: items.slice(0, 20).map(i => ({
              title: i.title,
              snippet: i.snippet,
              source: i.source,
              occurred_at: i.occurred_at,
            })),
            persist_tasks: true,
          },
        }),
      });
      if (!res.ok) throw new Error('AI extraction failed');
      const data = await res.json();
      if (data.result?.tasks?.length) {
        setTasks(prev => [...data.result.tasks, ...prev]);
        toast.success(`Extracted ${data.result.persisted_count || data.result.tasks.length} tasks with AI`);
      } else if (data.result?.action_items?.length) {
        // Fallback: AI returned items but didn't persist (API key issue, etc.)
        toast.info(`AI found ${data.result.action_items.length} potential tasks but couldn't persist them`);
      } else {
        toast.info('No actionable tasks found in linked items');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to extract tasks');
    }
    setAgentLoading(null);
  };

  // --- PIN ITEM ---
  const togglePinItem = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const isPinned = !!(item.metadata?.pinned);
    try {
      const res = await fetch(`/api/topics/${topic.id}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: { ...item.metadata, pinned: !isPinned } }),
      });
      if (res.ok) {
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, metadata: { ...i.metadata, pinned: !isPinned } } : i));
        toast.success(isPinned ? 'Item unpinned' : 'Item pinned to top');
      }
    } catch {
      toast.error('Failed to update pin');
    }
  };

  // --- AI ANALYSIS ---
  const runAnalysis = async (question?: string) => {
    if (items.length === 0) {
      toast.error('Link some items first to run AI analysis');
      return;
    }
    setAnalysisLoading(true);
    setShowAnalysis(true);
    try {
      // First, enrich items that don't have body content yet (fetches from Notion, Gmail, etc.)
      // This ensures AI has full content, not just snippets
      const hasUnenriched = items.some(i => !i.body && ['notion', 'gmail', 'drive', 'slack', 'link'].includes(i.source));
      if (hasUnenriched) {
        try {
          await fetch(`/api/topics/${topic.id}/enrich`, { method: 'POST' });
          // Refresh items so body fields are updated in React state — prevents re-enriching next time
          await refreshItems();
        } catch { /* non-blocking — continue with analysis even if enrich fails */ }
      }

      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topic.id, question: question || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAnalysis(data.analysis);
      setAiQuestion('');
      toast.success(question ? 'AI answered your question' : 'AI analysis complete');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed');
    }
    setAnalysisLoading(false);
  };

  // --- SELECT ALL ---
  const selectAllSearch = () => {
    const linkable = searchResults.filter(r => !r.already_linked);
    if (selectedResults.size === linkable.length) {
      setSelectedResults(new Set());
    } else {
      setSelectedResults(new Set(linkable.map(r => r.source + ':' + r.external_id)));
    }
  };

  const selectAllAi = () => {
    const linkable = aiFindResults.filter(r => !r.already_linked);
    if (selectedAiResults.size === linkable.length) {
      setSelectedAiResults(new Set());
    } else {
      setSelectedAiResults(new Set(linkable.map(r => r.source + ':' + r.external_id)));
    }
  };

  // Filtered items by tab
  const filteredItems = (activeTab === 'all' ? items : items.filter(i => i.source === activeTab))
    .sort((a, b) => {
      // Pinned items first
      const aPinned = a.metadata?.pinned ? 1 : 0;
      const bPinned = b.metadata?.pinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return 0; // preserve original order otherwise
    });
  const sourceCounts = items.reduce((acc, item) => {
    acc[item.source] = (acc[item.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Helper: check if item was linked to this topic in last 2 hours
  // Uses created_at (when item was added) not occurred_at (when event happened)
  const isNewItem = (createdAt: string) => {
    return (Date.now() - new Date(createdAt).getTime()) < 2 * 60 * 60 * 1000;
  };

  // Area badge gradient class
  const areaBadgeClass = topic.area === 'work' ? 'area-badge-work' : topic.area === 'personal' ? 'area-badge-personal' : 'area-badge-career';

  const toggleSource = (source: string) => {
    setSearchSources(prev => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };

  const toggleSearchResult = (key: string) => {
    setSelectedResults(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAiResult = (key: string) => {
    setSelectedAiResults(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in p-4 md:p-8">
      {/* AI Agents Bar - compact, above title */}
      <div className="-mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 md:px-8 py-2 bg-gradient-to-r from-blue-50/60 to-purple-50/60 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          <span className="font-medium text-gray-600">AI Agents</span>
          {agentLoading && <Loader2 className="w-3 h-3 animate-spin text-purple-500" />}
          {agentSuccess && !agentLoading && (
            <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium animate-fade-in">
              <Check className="w-3 h-3" /> Done
            </span>
          )}
        </div>
        <div className="relative">
          <button onClick={() => setShowAgentMenu(!showAgentMenu)} disabled={!!agentLoading}
            className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-xs font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 flex items-center gap-1.5 transition-all shadow-sm">
            {agentLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            Run Agent
            <ChevronDown className="w-3 h-3" />
          </button>
          {showAgentMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowAgentMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-60 bg-white rounded-xl border border-gray-200 shadow-xl py-1.5 max-h-80 overflow-y-auto">
                <p className="px-3 py-1 text-[10px] text-gray-400 uppercase tracking-wider font-semibold">General</p>
                <button onClick={() => { runAgent('auto_tag'); setShowAgentMenu(false); }} disabled={!!agentLoading}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 flex items-center gap-2.5 disabled:opacity-50 transition-colors">
                  {agentLoading === 'auto_tag' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" /> : <Tag className="w-3.5 h-3.5 text-blue-500" />}
                  <span className="flex-1">Auto-Tag</span>
                  {formatAgentLastRun('auto_tag') && <span className="text-[9px] text-gray-400">{formatAgentLastRun('auto_tag')}</span>}
                </button>
                <button onClick={() => { runAgent('suggest_title'); setShowAgentMenu(false); }} disabled={!!agentLoading}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-purple-50 flex items-center gap-2.5 disabled:opacity-50 transition-colors">
                  {agentLoading === 'suggest_title' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" /> : <Wand2 className="w-3.5 h-3.5 text-purple-500" />} Suggest Title
                </button>
                <button onClick={() => { runAgent('generate_description'); setShowAgentMenu(false); }} disabled={!!agentLoading}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-green-50 flex items-center gap-2.5 disabled:opacity-50 transition-colors">
                  {agentLoading === 'generate_description' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-green-500" /> : <FileText className="w-3.5 h-3.5 text-green-500" />} Generate Description
                </button>
                <button onClick={() => { runAgent('propose_goal'); setShowAgentMenu(false); }} disabled={!!agentLoading}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 flex items-center gap-2.5 disabled:opacity-50 transition-colors">
                  {agentLoading === 'propose_goal' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" /> : <Target className="w-3.5 h-3.5 text-blue-500" />}
                  <span className="flex-1">Propose Goal</span>
                  {formatAgentLastRun('propose_goal') && <span className="text-[9px] text-gray-400">{formatAgentLastRun('propose_goal')}</span>}
                </button>
                <div className="border-t border-gray-100 my-1.5" />
                <p className="px-3 py-1 text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Requires linked items</p>
                <button onClick={() => { runAgent('extract_action_items'); setShowAgentMenu(false); }} disabled={!!agentLoading || items.length === 0}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-amber-50 flex items-center gap-2.5 disabled:opacity-50 transition-colors">
                  {agentLoading === 'extract_action_items' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" /> : <ListChecks className="w-3.5 h-3.5 text-amber-500" />} Extract Actions
                </button>
                <button onClick={() => { runAgent('summarize_thread'); setShowAgentMenu(false); }} disabled={!!agentLoading || items.length === 0}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-indigo-50 flex items-center gap-2.5 disabled:opacity-50 transition-colors">
                  {agentLoading === 'summarize_thread' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" /> : <Brain className="w-3.5 h-3.5 text-indigo-500" />} Summarize Thread
                </button>
                <button onClick={() => { runAgent('find_contacts'); setShowAgentMenu(false); }} disabled={!!agentLoading || items.length === 0}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-teal-50 flex items-center gap-2.5 disabled:opacity-50 transition-colors">
                  {agentLoading === 'find_contacts' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-500" /> : <Users className="w-3.5 h-3.5 text-teal-500" />} Find Contacts
                </button>
                <button onClick={() => { runAgent('deep_dive'); setShowAgentMenu(false); }} disabled={!!agentLoading || items.length === 0}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-purple-50 flex items-center gap-2.5 disabled:opacity-50 transition-colors">
                  {agentLoading === 'deep_dive' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" /> : <Eye className="w-3.5 h-3.5 text-purple-500" />} Deep Dive
                </button>
                <button onClick={() => { runAgent('recommend_content'); setShowAgentMenu(false); }} disabled={!!agentLoading || items.length === 0}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 flex items-center gap-2.5 disabled:opacity-50 transition-colors">
                  {agentLoading === 'recommend_content' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" /> : <Compass className="w-3.5 h-3.5 text-blue-500" />} Find More Content
                </button>
                <button onClick={() => { runAgent('extract_entities'); setShowAgentMenu(false); }} disabled={!!agentLoading || items.length === 0}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-emerald-50 flex items-center gap-2.5 disabled:opacity-50 transition-colors">
                  {agentLoading === 'extract_entities' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" /> : <Target className="w-3.5 h-3.5 text-emerald-500" />} Extract Entities
                </button>
                <div className="border-t border-gray-100 my-1.5" />
                <p className="px-3 py-1 text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Cross-topic</p>
                <button onClick={() => { runAgent('cross_topic_links'); setShowAgentMenu(false); }} disabled={!!agentLoading}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-orange-50 flex items-center gap-2.5 disabled:opacity-50 transition-colors">
                  {agentLoading === 'cross_topic_links' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" /> : <GitBranch className="w-3.5 h-3.5 text-orange-500" />} Related Topics
                </button>
                <button onClick={() => { runAgent('completeness_check'); setShowAgentMenu(false); }} disabled={!!agentLoading}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-rose-50 flex items-center gap-2.5 disabled:opacity-50 transition-colors">
                  {agentLoading === 'completeness_check' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" /> : <Award className="w-3.5 h-3.5 text-rose-500" />} Completeness Check
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Header with gradient strip */}
      <div className="topic-header-strip -mx-4 md:-mx-8 px-4 md:px-8 pt-5 pb-6 mb-2 rounded-b-2xl relative">
        {/* Decorative dots */}
        <div className="absolute inset-0 dot-pattern opacity-30 pointer-events-none" />
        <div className="relative">
          {/* Breadcrumb */}
          <nav className="mb-4 inline-flex items-center gap-1.5 text-xs">
            <Link href={`/topics?area=${topic.area}`} className="text-gray-400 hover:text-blue-600 inline-flex items-center gap-1 transition-all duration-200 group">
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span className="group-hover:underline underline-offset-2">Topics</span>
            </Link>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <Link href={`/topics?area=${topic.area}`} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              AREA_COLORS[topic.area]
                ? `${AREA_COLORS[topic.area].bg} ${AREA_COLORS[topic.area].text}`
                : 'bg-gray-100 text-gray-600'
            } hover:opacity-80 transition-opacity`}>
              {topic.area.charAt(0).toUpperCase() + topic.area.slice(1)}
            </Link>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-gray-500 font-medium truncate max-w-[200px]">{topic.title}</span>
          </nav>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="space-y-3 mt-2">
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    className="text-2xl font-bold text-gray-900 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80" />
                  <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)}
                    placeholder="Description..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80" rows={2} />
                  <div className="flex gap-3 flex-wrap">
                    <select value={editArea} onChange={e => setEditArea(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      <option value="work">Work</option>
                      <option value="personal">Personal</option>
                      <option value="career">Career</option>
                    </select>
                    <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="completed">Completed</option>
                      <option value="archived">Archived</option>
                    </select>
                    {!editIsOngoing && (
                      <input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    )}
                    {/* Ongoing toggle */}
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => { setEditIsOngoing(!editIsOngoing); if (!editIsOngoing) { setEditDueDate(''); setEditStartDate(''); } }}
                        className={`relative w-9 h-5 rounded-full transition-colors ${editIsOngoing ? 'bg-cyan-500' : 'bg-gray-300'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${editIsOngoing ? 'translate-x-4' : ''}`} />
                      </button>
                      <span className="text-xs font-medium text-gray-600 flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 text-cyan-600" /> Ongoing
                      </span>
                    </div>
                  </div>
                  {/* Dates row */}
                  <div className="grid grid-cols-2 gap-3">
                    {!editIsOngoing && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                      <input type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Progress ({editProgress}%)</label>
                      <input type="range" min={0} max={100} value={editProgress} onChange={e => setEditProgress(Number(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 mt-2" />
                    </div>
                  </div>
                  {/* Priority buttons */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
                    <div className="flex gap-1">
                      {[0, 1, 2, 3, 4, 5].map(p => (
                        <button key={p} type="button" onClick={() => setEditPriority(p)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                            editPriority === p
                              ? p === 0 ? 'bg-gray-100 text-gray-700 border-gray-400 ring-1 ring-gray-400'
                                : p >= 4 ? 'bg-red-100 text-red-700 border-red-400 ring-1 ring-red-400'
                                : p === 3 ? 'bg-orange-100 text-orange-700 border-orange-400 ring-1 ring-orange-400'
                                : 'bg-amber-100 text-amber-700 border-amber-400 ring-1 ring-amber-400'
                              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                          }`}>
                          {p === 0 ? 'None' : `P${p}`}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Tags input */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Tags (comma-separated)</label>
                    <input value={editTags} onChange={e => setEditTags(e.target.value)}
                      placeholder="e.g. urgent, frontend, review"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/80" />
                  </div>
                  {/* Folder, Owner, Goal row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Folder</label>
                      <HierarchyPicker
                        items={buildFolderPickerItems(folders)}
                        value={editFolderId || null}
                        onChange={(id) => setEditFolderId(id || '')}
                        placeholder="Select folder..."
                        noneLabel="No folder"
                        searchPlaceholder="Search folders..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Owner</label>
                      <ContactPicker
                        contacts={pickerContacts}
                        value={editOwnerContactId}
                        onChange={(contactId, contactName) => { setEditOwnerContactId(contactId); setEditOwner(contactName); }}
                        placeholder="Select owner contact..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Goal</label>
                      <input value={editGoal} onChange={e => setEditGoal(e.target.value)}
                        placeholder="e.g. Launch by Q2"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/80" />
                    </div>
                  </div>
                  {/* Parent topic selector */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                      <Layers className="w-3 h-3 text-indigo-500" /> Parent Topic <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <HierarchyPicker
                      items={buildTopicPickerItems(allTopics, topic.id)}
                      value={editParentTopicId || null}
                      onChange={(id) => setEditParentTopicId(id || '')}
                      placeholder="Select parent topic..."
                      noneLabel="No parent (root topic)"
                      searchPlaceholder="Search topics..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveTopic} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 transition-colors shadow-sm">
                      <Save className="w-4 h-4" /> Save
                    </button>
                    <button onClick={() => setEditing(false)} className="px-4 py-2 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2 transition-colors border border-gray-200">
                      <X className="w-4 h-4" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Parent topic badge */}
                  {parentTopic && (
                    <Link href={`/topics/${parentTopic.id}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-100 transition-colors border border-indigo-100 mt-1 mb-1">
                      <Layers className="w-3 h-3" />
                      Sub-topic of <span className="font-semibold">{parentTopic.title}</span>
                      <ChevronRight className="w-3 h-3 opacity-50" />
                    </Link>
                  )}
                  <div className="flex items-start gap-2 mt-1">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight tracking-tight">{topic.title}</h1>
                    <button
                      onClick={() => runAgent('suggest_title')}
                      disabled={!!agentLoading}
                      className="mt-1 p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all flex-shrink-0 disabled:opacity-50"
                      title="AI: Suggest better titles"
                    >
                      {agentLoading === 'suggest_title' ? <Loader2 className="w-4 h-4 animate-spin text-purple-500" /> : <Wand2 className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Title suggestions inline */}
                  {showTitleSuggestions && titleSuggestions.length > 0 && (
                    <div className="mt-2 p-3 bg-purple-50/70 rounded-xl border border-purple-100 animate-slide-up">
                      <p className="text-xs text-purple-700 font-medium mb-2 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3" /> Suggested Titles
                      </p>
                      <div className="space-y-1">
                        {titleSuggestions.map((s, i) => (
                          <button key={i} onClick={() => applyTitle(s)}
                            className="block w-full text-left px-3 py-2 text-sm bg-white rounded-lg border border-purple-100 hover:border-purple-300 hover:bg-purple-50 transition-colors font-medium text-gray-800">
                            {s}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setShowTitleSuggestions(false)} className="text-xs text-purple-500 hover:text-purple-700 hover:underline mt-2">Dismiss</button>
                    </div>
                  )}

                  {/* Badges row */}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {/* Status badge with colored dot */}
                    <span className={`text-xs font-semibold px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 ${
                      topic.status === 'active' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' :
                      topic.status === 'completed' ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' :
                      'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                    }`}>
                      <CircleDot className="w-3 h-3" />
                      {topic.status.charAt(0).toUpperCase() + topic.status.slice(1)}
                    </span>

                    {/* Area badge with gradient */}
                    <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${areaBadgeClass}`}>
                      {topic.area.charAt(0).toUpperCase() + topic.area.slice(1)}
                    </span>

                    {/* Ongoing badge */}
                    {topic.is_ongoing && (
                      <span className="text-xs font-semibold px-3 py-1.5 rounded-full inline-flex items-center gap-1 bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200">
                        <RefreshCw className="w-3 h-3" /> Ongoing
                      </span>
                    )}

                    {/* Priority badge */}
                    {topic.priority > 0 && (
                      <span className={`text-xs font-semibold px-3 py-1.5 rounded-full inline-flex items-center gap-1 ${
                        topic.priority >= 4 ? 'bg-red-50 text-red-700 ring-1 ring-red-200' :
                        topic.priority === 3 ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-200' :
                        topic.priority === 2 ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' :
                        'bg-gray-50 text-gray-600 ring-1 ring-gray-200'
                      }`}>
                        <AlertTriangle className="w-3 h-3" />
                        P{topic.priority}
                      </span>
                    )}

                    {/* Due date with color coding */}
                    {topic.due_date && (() => {
                      const daysLeft = Math.ceil((new Date(topic.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      const isOverdue = daysLeft < 0;
                      const isUrgent = daysLeft >= 0 && daysLeft <= 3;
                      const isSoon = daysLeft > 3 && daysLeft <= 7;
                      const colorClass = isOverdue
                        ? 'bg-red-50 text-red-700 ring-1 ring-red-300'
                        : isUrgent
                        ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-300'
                        : isSoon
                        ? 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200'
                        : 'bg-green-50 text-green-700 ring-1 ring-green-200';
                      const label = isOverdue ? `Overdue by ${Math.abs(daysLeft)}d` : daysLeft === 0 ? 'Due today' : daysLeft === 1 ? 'Due tomorrow' : `${daysLeft}d left`;
                      return (
                        <span className={`text-xs font-semibold px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 ${colorClass}`}>
                          <Calendar className="w-3 h-3" />
                          {label}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Quick Progress Update - clickable progress bar */}
                  {topic.progress_percent != null && (
                    <div className="mt-4 max-w-lg relative">
                      <div className="flex items-center gap-4">
                        {/* Progress ring */}
                        <button
                          onClick={() => setShowProgressPicker(prev => !prev)}
                          className="relative flex-shrink-0 group cursor-pointer"
                          title="Click to update progress"
                        >
                          <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
                            <circle cx="28" cy="28" r="24" fill="none" stroke="#e5e7eb" strokeWidth="5" />
                            <circle
                              cx="28" cy="28" r="24" fill="none"
                              strokeWidth="5"
                              strokeLinecap="round"
                              strokeDasharray={`${2 * Math.PI * 24}`}
                              strokeDashoffset={`${2 * Math.PI * 24 * (1 - (topic.progress_percent || 0) / 100)}`}
                              stroke={`url(#progress-gradient-${topic.id})`}
                              className="transition-all duration-500"
                            />
                            <defs>
                              <linearGradient id={`progress-gradient-${topic.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#3b82f6" />
                                <stop offset="100%" stopColor={(topic.progress_percent || 0) >= 80 ? '#22c55e' : (topic.progress_percent || 0) >= 50 ? '#06b6d4' : '#3b82f6'} />
                              </linearGradient>
                            </defs>
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700 group-hover:text-blue-600 transition-colors">
                            {topic.progress_percent || 0}%
                          </span>
                          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                            <Edit3 className="w-2.5 h-2.5 text-white" />
                          </span>
                        </button>
                        {/* Progress bar alongside - also clickable */}
                        <div className="flex-1 cursor-pointer" onClick={() => setShowProgressPicker(prev => !prev)}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-500">Progress</span>
                            <span className={`text-xs font-semibold ${
                              (topic.progress_percent || 0) >= 100 ? 'text-green-600' : (topic.progress_percent || 0) >= 60 ? 'text-blue-600' : 'text-amber-600'
                            }`}>
                              {(topic.progress_percent || 0) >= 100 ? 'Complete' : (topic.progress_percent || 0) >= 75 ? 'Almost there' : (topic.progress_percent || 0) >= 50 ? 'Halfway' : 'In progress'}
                            </span>
                          </div>
                          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(topic.progress_percent || 0, 100)}%`,
                                background: `linear-gradient(90deg, #3b82f6 0%, ${(topic.progress_percent || 0) >= 80 ? '#22c55e' : (topic.progress_percent || 0) >= 50 ? '#06b6d4' : '#3b82f6'} 100%)`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      {/* Quick progress picker dropdown */}
                      {showProgressPicker && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowProgressPicker(false)} />
                          <div className="absolute left-0 top-full mt-2 z-50 bg-white rounded-xl border border-gray-200 shadow-xl p-3 animate-scale-in w-72">
                            <p className="text-xs font-semibold text-gray-600 mb-2">Quick Update Progress</p>
                            <div className="flex gap-1.5 mb-3">
                              {[0, 25, 50, 75, 100].map(val => (
                                <button key={val} onClick={() => updateProgressQuick(val)} disabled={progressUpdating}
                                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border disabled:opacity-50 ${
                                    (topic.progress_percent || 0) === val
                                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700'
                                  }`}>
                                  {val}%
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="range" min={0} max={100} step={5} value={topic.progress_percent || 0}
                                onChange={e => {
                                  const val = Number(e.target.value);
                                  setTopic(prev => ({ ...prev, progress_percent: val }));
                                }}
                                onMouseUp={e => updateProgressQuick(Number((e.target as HTMLInputElement).value))}
                                onTouchEnd={e => updateProgressQuick(Number((e.target as HTMLInputElement).value))}
                                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                disabled={progressUpdating}
                              />
                              <span className="text-xs font-bold text-gray-600 w-10 text-right">{topic.progress_percent || 0}%</span>
                            </div>
                            {progressUpdating && (
                              <div className="flex items-center gap-1.5 mt-2 text-xs text-blue-500">
                                <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Compact dates row with health score and keyboard hint */}
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                    <span className="inline-flex items-center gap-1 hover:text-gray-600 transition-colors">
                      <Clock className="w-3 h-3" /> Created {formatSmartDate(topic.created_at)}
                    </span>
                    <span className="inline-flex items-center gap-1 hover:text-gray-600 transition-colors">
                      <RefreshCw className="w-3 h-3" /> Updated {formatSmartDate(topic.updated_at)}
                    </span>
                    {topic.due_date && (
                      <span className="inline-flex items-center gap-1 hover:text-gray-600 transition-colors">
                        <Calendar className="w-3 h-3" /> Due {new Date(topic.due_date).toLocaleDateString()}
                      </span>
                    )}
                    {/* Health Score Indicator */}
                    <span className="inline-flex items-center gap-2 ml-auto" title={`Health: ${healthScore}% - ${healthLabel}`}>
                      <span className="relative w-6 h-6 flex-shrink-0">
                        <svg width="24" height="24" viewBox="0 0 24 24" className="-rotate-90">
                          <circle cx="12" cy="12" r="10" fill="none" stroke="#e5e7eb" strokeWidth="2.5" />
                          <circle cx="12" cy="12" r="10" fill="none" stroke={healthRingColor} strokeWidth="2.5" strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 10}`} strokeDashoffset={`${2 * Math.PI * 10 * (1 - healthScore / 100)}`}
                            className="transition-all duration-500" />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-gray-600">{healthScore}</span>
                      </span>
                      <span className={`text-[10px] font-semibold ${healthColor}`}>{healthLabel}</span>
                    </span>
                    {/* Keyboard shortcuts hint */}
                    <div className="relative">
                      <button onClick={() => setShowKeyboardHints(prev => !prev)}
                        className="p-1 text-gray-300 hover:text-gray-500 hover:bg-white/50 rounded transition-colors" title="Keyboard shortcuts (?)">
                        <Keyboard className="w-3.5 h-3.5" />
                      </button>
                      {showKeyboardHints && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowKeyboardHints(false)} />
                          <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-white rounded-xl border border-gray-200 shadow-xl p-3 animate-scale-in">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">Keyboard Shortcuts</p>
                            <div className="space-y-1.5 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-gray-600">Next tab</span>
                                <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono text-gray-500 border border-gray-200">Tab</kbd>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-gray-600">Previous tab</span>
                                <span className="flex gap-0.5">
                                  <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono text-gray-500 border border-gray-200">Shift</kbd>
                                  <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono text-gray-500 border border-gray-200">Tab</kbd>
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-gray-600">New note</span>
                                <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono text-gray-500 border border-gray-200">n</kbd>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-gray-600">This panel</span>
                                <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono text-gray-500 border border-gray-200">?</kbd>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            {!editing && (
              <div className="flex gap-1 items-center flex-shrink-0">
                <button onClick={() => { setEditing(true); setEditTitle(topic.title); setEditDescription(topic.description || ''); setEditArea(topic.area); setEditStatus(topic.status); setEditDueDate(topic.due_date || ''); setEditPriority(topic.priority ?? 0); setEditTags(topic.tags?.join(', ') || ''); setEditStartDate(topic.start_date || ''); setEditProgress(topic.progress_percent ?? 0); setEditFolderId(topic.folder_id || ''); setEditParentTopicId(topic.parent_topic_id || ''); setEditOwner(topic.owner || ''); setEditGoal(topic.goal || ''); }}
                  className="px-3 py-1.5 text-gray-500 hover:text-blue-600 hover:bg-white/80 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all border border-transparent hover:border-gray-200 hover:shadow-sm" title="Edit">
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
                <div className="relative">
                  <button onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white/80 rounded-lg transition-all hover:shadow-sm" title="More actions">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  {showMoreMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                      <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-white rounded-xl border border-gray-200 shadow-xl py-1 animate-scale-in">
                        <button onClick={() => { setShowNoteEditor(true); setShowMoreMenu(false); }}
                          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
                          <StickyNote className="w-3.5 h-3.5 text-green-500" /> Add Note
                        </button>
                        <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copied'); setShowMoreMenu(false); }}
                          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
                          <Link2 className="w-3.5 h-3.5 text-blue-500" /> Copy Link
                        </button>
                        <button onClick={() => { archiveTopic(); setShowMoreMenu(false); }}
                          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
                          <Archive className="w-3.5 h-3.5 text-amber-500" /> {topic.status === 'archived' ? 'Reactivate' : 'Archive'}
                        </button>
                        <div className="border-t border-gray-100 my-1" />
                        <button onClick={() => { deleteTopic(); setShowMoreMenu(false); }}
                          className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Topic Info Card - description, tags */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3 hover-lift">
        {/* Description with AI refresh button */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            {topic.description ? (
              <p className="text-sm text-gray-600 leading-relaxed">{topic.description}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">No description yet</p>
            )}
          </div>
          <button
            onClick={() => runAgent('generate_description')}
            disabled={!!agentLoading}
            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all flex-shrink-0 disabled:opacity-50"
            title="AI: Generate description"
          >
            {agentLoading === 'generate_description' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-green-500" /> : <Wand2 className="w-3.5 h-3.5" />}
          </button>
        </div>
        {/* Goal row with inline propose button */}
        <div className="flex items-start gap-2.5">
          {topic.goal ? (
            <div className="flex-1 flex items-start gap-2.5 p-3 bg-blue-50/50 rounded-lg border border-blue-100/50">
              <Target className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-700 flex-1"><span className="font-semibold text-gray-800">Goal:</span> {topic.goal}</p>
            </div>
          ) : (
            <div className="flex-1 flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <Target className="w-4 h-4 text-gray-300 flex-shrink-0" />
              <p className="text-sm text-gray-400 italic">No goal set</p>
            </div>
          )}
          <button
            onClick={() => runAgent('propose_goal')}
            disabled={!!agentLoading}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all flex-shrink-0 disabled:opacity-50"
            title="AI: Propose goal"
          >
            {agentLoading === 'propose_goal' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" /> : <Target className="w-3.5 h-3.5" />}
          </button>
        </div>
        {/* Goal proposal card */}
        {goalProposal && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-xs font-semibold text-blue-800">AI Goal Proposal</span>
              {goalProposal.is_improvement && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">improvement</span>
              )}
            </div>
            {goalProposal.is_improvement && goalProposal.current_goal && (
              <p className="text-xs text-gray-400 line-through">{goalProposal.current_goal}</p>
            )}
            <p className="text-sm font-medium text-blue-900">{goalProposal.proposed_goal}</p>
            <p className="text-xs text-blue-600 italic">{goalProposal.reasoning}</p>
            {goalProposal.alternatives.length > 0 && (
              <div className="pt-1 border-t border-blue-100">
                <p className="text-[10px] text-blue-500 font-medium mb-1">Alternatives:</p>
                <div className="space-y-1">
                  {goalProposal.alternatives.map((alt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-gray-700 flex-1">{alt}</span>
                      <button
                        onClick={async () => {
                          await fetch(`/api/topics/${topic.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goal: alt }) });
                          setTopic(prev => ({ ...prev, goal: alt }));
                          setGoalProposal(null);
                          toast.success('Goal updated!');
                        }}
                        className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 font-medium flex-shrink-0"
                      >Use</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={async () => {
                  await fetch(`/api/topics/${topic.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goal: goalProposal.proposed_goal }) });
                  setTopic(prev => ({ ...prev, goal: goalProposal.proposed_goal }));
                  setGoalProposal(null);
                  toast.success('Goal updated!');
                }}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
              >Accept Goal</button>
              <button onClick={() => setGoalProposal(null)} className="px-3 py-1.5 text-gray-500 hover:text-gray-700 text-xs">
                Dismiss
              </button>
            </div>
          </div>
        )}
        {topic.tags && topic.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            {topic.tags.map((tag, i) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-gradient-to-r from-gray-50 to-gray-100 text-gray-600 font-medium border border-gray-200/60">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Sticky Tab Bar */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-200 -mx-4 md:-mx-8 px-4 md:px-8 shadow-sm">
        <div className="flex gap-1 overflow-x-auto py-1">
          {([
            { key: 'items' as SectionTab, label: 'Items', icon: <Layers className="w-3.5 h-3.5" />, count: items.length },
            { key: 'tasks' as SectionTab, label: 'Tasks', icon: <ListChecks className="w-3.5 h-3.5" />, count: tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length },
            { key: 'intelligence' as SectionTab, label: 'Intelligence', icon: <Bot className="w-3.5 h-3.5" />, count: analysis ? 1 : 0 },
            { key: 'search' as SectionTab, label: 'Search', icon: <Search className="w-3.5 h-3.5" />, count: searchResults.length + aiFindResults.length },
            { key: 'details' as SectionTab, label: 'Details', icon: <Info className="w-3.5 h-3.5" />, count: 0 },
            { key: 'contacts' as SectionTab, label: 'Contacts', icon: <Users className="w-3.5 h-3.5" />, count: linkedContacts.length },
            { key: 'notes' as SectionTab, label: 'Notes', icon: <StickyNote className="w-3.5 h-3.5" />, count: notes.trim() ? 1 : 0 },
            { key: 'timeline' as SectionTab, label: 'Timeline', icon: <Clock className="w-3.5 h-3.5" />, count: items.length + linkedContacts.length },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all relative whitespace-nowrap ${
                activeSection === tab.key ? 'text-gray-900 tab-active' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeSection === tab.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>
      {/* ===== ITEMS TAB ===== */}
      {activeSection === 'items' && (
        <div id="section-items" className="scroll-mt-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                <Layers className="w-3.5 h-3.5 text-white" />
              </span>
              <h2 className="text-base font-bold text-gray-900">Linked Items</h2>
              <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{items.length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={refreshItems} disabled={itemsRefreshing}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Refresh items">
                <RefreshCw className={`w-3.5 h-3.5 ${itemsRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={() => { setShowLinkForm(v => !v); setShowNoteEditor(false); }}
                className="px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 border border-transparent hover:border-blue-200">
                <Link2 className="w-3.5 h-3.5" /> Add Link
              </button>
              <button onClick={() => { setShowNoteEditor(true); setShowLinkForm(false); }}
                className="px-3 py-1.5 text-green-600 hover:bg-green-50 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 border border-transparent hover:border-green-200">
                <StickyNote className="w-3.5 h-3.5" /> Add Note
              </button>
              <button onClick={() => { setActiveSection('search'); setTimeout(() => handleReviewActivity(), 100); }}
                disabled={reviewLoading}
                className="px-3 py-1.5 text-teal-600 hover:bg-teal-50 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 border border-transparent hover:border-teal-200 disabled:opacity-50"
                title="Scan recent activity for items to link">
                {reviewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />} Review Activity
              </button>
            </div>
          </div>
          {/* Add Link Form */}
          {showLinkForm && (
            <div className="mb-4 p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">URL <span className="text-red-500">*</span></label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addLink(); } }}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Title <span className="text-gray-400">(optional)</span></label>
                <input
                  type="text"
                  value={linkTitle}
                  onChange={e => setLinkTitle(e.target.value)}
                  placeholder="Will use URL if left empty"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addLink(); } }}
                />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={addLink} disabled={linkSaving || !linkUrl.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors">
                  {linkSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                  {linkSaving ? 'Adding...' : 'Add Link'}
                </button>
                <button onClick={() => { setShowLinkForm(false); setLinkUrl(''); setLinkTitle(''); }}
                  className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
          {/* Source Distribution Bar - stacked horizontal bar chart */}
          {items.length >= 2 && Object.keys(sourceCounts).length >= 2 && (() => {
            const sourceColors: Record<string, { bg: string; text: string }> = {
              gmail: { bg: 'bg-red-500', text: 'text-red-700' },
              calendar: { bg: 'bg-blue-500', text: 'text-blue-700' },
              drive: { bg: 'bg-amber-500', text: 'text-amber-700' },
              slack: { bg: 'bg-purple-500', text: 'text-purple-700' },
              notion: { bg: 'bg-gray-500', text: 'text-gray-700' },
              manual: { bg: 'bg-green-500', text: 'text-green-700' },
              link: { bg: 'bg-cyan-500', text: 'text-cyan-700' },
            };
            const total = items.length;
            return (
              <div className="mb-4 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Source Distribution</span>
                </div>
                {/* Stacked bar */}
                <div className="flex h-3 rounded-full overflow-hidden shadow-inner bg-gray-200">
                  {Object.entries(sourceCounts).map(([src, count]) => (
                    <div
                      key={src}
                      className={`${sourceColors[src]?.bg || 'bg-gray-400'} transition-all duration-300 first:rounded-l-full last:rounded-r-full`}
                      style={{ width: `${(count / total) * 100}%` }}
                      title={`${sourceLabel(src)}: ${count} (${Math.round((count / total) * 100)}%)`}
                    />
                  ))}
                </div>
                {/* Legend */}
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {Object.entries(sourceCounts).map(([src, count]) => (
                    <button key={src} onClick={() => setActiveTab(src)}
                      className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors cursor-pointer">
                      <span className={`w-2.5 h-2.5 rounded-full ${sourceColors[src]?.bg || 'bg-gray-400'} flex-shrink-0`} />
                      <SourceIcon source={src} className="w-3 h-3" />
                      <span className="font-medium">{count}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Source tabs - polished with active indicator */}
          <div className="flex gap-1 mb-4 border-b border-gray-100 -mx-1 px-1 overflow-x-auto">
            <button onClick={() => setActiveTab('all')}
              className={`px-4 py-2.5 text-xs font-medium transition-all relative whitespace-nowrap ${
                activeTab === 'all' ? 'text-gray-900 tab-active' : 'text-gray-500 hover:text-gray-700'
              }`}>
              All
              <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
              }`}>{items.length}</span>
            </button>
            {Object.entries(sourceCounts).map(([src, count]) => (
              <button key={src} onClick={() => setActiveTab(src)}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all relative whitespace-nowrap ${
                  activeTab === src ? 'text-gray-900 tab-active' : 'text-gray-500 hover:text-gray-700'
                }`}>
                <SourceIcon source={src} className="w-3.5 h-3.5" />
                {sourceLabel(src)}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === src ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
                }`}>{count}</span>
              </button>
            ))}
          </div>
          {filteredItems.length === 0 ? (
            <div className="py-12 bg-gradient-to-b from-white to-gray-50/50 rounded-xl border border-dashed border-gray-200">
              {/* Illustration-style icon composition */}
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Search className="w-5 h-5 text-blue-400" />
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center -ml-2 mt-3">
                  <Layers className="w-5 h-5 text-purple-400" />
                </div>
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center -ml-2 -mt-1">
                  <StickyNote className="w-5 h-5 text-green-400" />
                </div>
              </div>
              <h3 className="text-gray-700 text-sm font-semibold text-center mb-1">Start building this topic</h3>
              <p className="text-gray-400 text-xs text-center mb-5 max-w-xs mx-auto">Link content, add notes, or save links to organize everything in one place.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto px-6">
                <button onClick={() => setActiveSection('search')}
                  className="p-3 bg-white rounded-xl border border-blue-200 hover:border-blue-300 hover:shadow-md transition-all text-center group">
                  <Search className="w-5 h-5 text-blue-500 mx-auto mb-1.5 group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-semibold text-gray-700">Search & Link</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Find content to link</p>
                </button>
                <button onClick={() => setShowNoteEditor(true)}
                  className="p-3 bg-white rounded-xl border border-green-200 hover:border-green-300 hover:shadow-md transition-all text-center group">
                  <StickyNote className="w-5 h-5 text-green-500 mx-auto mb-1.5 group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-semibold text-gray-700">Add a Note</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Write a quick note</p>
                </button>
                <button onClick={() => setShowLinkForm(true)}
                  className="p-3 bg-white rounded-xl border border-purple-200 hover:border-purple-300 hover:shadow-md transition-all text-center group">
                  <Link2 className="w-5 h-5 text-purple-500 mx-auto mb-1.5 group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-semibold text-gray-700">Add a Link</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Save a URL reference</p>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 animate-stagger">
              {filteredItems.map((item) => (
                item.source === 'manual' ? (
                  <NoteCard
                    key={item.id}
                    item={item as any}
                    onEdit={(note) => setEditingNote(note as any)}
                    onDelete={(itemId) => unlinkItem(itemId)}
                  />
                ) : (
                  <div key={item.id} className={`p-3.5 bg-white rounded-xl border-l-[3px] border border-gray-100 transition-all group item-card-hover ${sourceBorderClass(item.source)} ${
                    item.metadata?.pinned ? 'ring-1 ring-amber-200 bg-amber-50/20' : ''
                  }`}>
                    <div className="flex items-start gap-3">
                      {/* Source icon with colored background circle */}
                      <span className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${sourceIconBgClass(item.source)}`}>
                        <SourceIcon source={item.source} className="w-4 h-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {!!item.metadata?.pinned && <Pin className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                          <a href={item.url} target="_blank" rel="noopener noreferrer"
                            className="font-semibold text-gray-900 hover:text-blue-600 text-sm truncate block transition-colors">
                            {decodeHtmlEntities(item.title)}
                          </a>
                          {/* New badge for items added in last 24h */}
                          {isNewItem(item.created_at) && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500 text-white new-badge flex-shrink-0">
                              NEW
                            </span>
                          )}
                          {/* Sent/Received indicator for emails */}
                          {item.source === 'gmail' && (
                            item.metadata?.is_sent
                              ? <span className="flex items-center gap-0.5 text-xs text-blue-500 flex-shrink-0"><ArrowUp className="w-3 h-3" />Sent</span>
                              : <span className="flex items-center gap-0.5 text-xs text-green-500 flex-shrink-0"><ArrowDown className="w-3 h-3" />Received</span>
                          )}
                        </div>
                        {/* Source-specific details */}
                        {item.source === 'gmail' && (
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                            {!!item.metadata?.from && <span className="truncate max-w-[200px]">{String(item.metadata.from).split('<')[0].trim()}</span>}
                            {!!item.metadata?.has_attachments && <span className="text-gray-500">📎 {String(item.metadata.attachment_count || '')}</span>}
                          </div>
                        )}
                        {item.source === 'calendar' && (
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                            {!!item.metadata?.start && <span>{new Date(String(item.metadata.start)).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
                            {!!item.metadata?.location && <span className="truncate max-w-[150px]">📍 {String(item.metadata.location)}</span>}
                            {!!item.metadata?.conference_link && <a href={String(item.metadata.conference_link)} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">🎥 Join</a>}
                          </div>
                        )}
                        {item.source === 'drive' && (
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                            <span>{String(item.metadata?.mimeType || '').split('.').pop() || 'File'}</span>
                            {!!item.metadata?.size && <span>{(Number(item.metadata.size) / 1024).toFixed(0)} KB</span>}
                          </div>
                        )}
                        {item.source === 'slack' && (
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                            {!!item.metadata?.channel_name && <span>#{String(item.metadata.channel_name)}</span>}
                            {!!item.metadata?.username && <span>@{String(item.metadata.username)}</span>}
                            {Number(item.metadata?.reply_count || 0) > 0 && <span>💬 {String(item.metadata.reply_count)} replies</span>}
                          </div>
                        )}
                        {item.snippet && !expandedContent[item.id] && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{decodeHtmlEntities(item.snippet)}</p>
                        )}
                        {/* Expanded content */}
                        {expandedContent[item.id] && (
                          <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-700 max-h-80 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed thin-scrollbar">
                            {expandedContent[item.id]}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatRelativeDate(item.occurred_at)}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${sourceIconBgClass(item.source)}`}>
                            <SourceIcon source={item.source} className="w-2.5 h-2.5" />
                            {sourceLabel(item.source)}
                          </span>
                          {item.linked_by === 'ai' && (
                            <span className="text-purple-500 flex items-center gap-0.5 bg-purple-50 px-1.5 py-0.5 rounded text-[10px] font-medium">
                              <Sparkles className="w-3 h-3" /> AI linked
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button onClick={() => toggleContent(item.id)}
                          className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title={expandedContent[item.id] ? 'Hide content' : 'View full content'}>
                          {loadingContent.has(item.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : expandedContent[item.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => togglePinItem(item.id)}
                          className={`p-1.5 rounded-lg transition-colors ${item.metadata?.pinned ? 'text-amber-500 bg-amber-50' : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'}`} title={item.metadata?.pinned ? 'Unpin' : 'Pin to top'}>
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        <a href={item.url} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Open in source">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button onClick={() => unlinkItem(item.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Unlink from topic">
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== TASKS TAB ===== */}
      {activeSection === 'tasks' && (
        <div id="section-tasks" className="scroll-mt-8 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <ListChecks className="w-3.5 h-3.5 text-white" />
              </span>
              <h2 className="text-base font-bold text-gray-900">Tasks</h2>
              <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length} active
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={refreshTasks} disabled={tasksLoading}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Refresh tasks">
                <RefreshCw className={`w-3.5 h-3.5 ${tasksLoading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={recommendTasks} disabled={!!agentLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                title="AI recommends tasks based on topic context">
                {agentLoading === 'recommend_tasks' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                Recommend
              </button>
              <button onClick={extractAndPersistTasks} disabled={!!agentLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors disabled:opacity-50"
                title="Extract tasks from linked items using AI">
                {agentLoading === 'extract_tasks' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Extract
              </button>
            </div>
          </div>

          {/* AI Task Recommendations */}
          {taskRecommendations.length > 0 && (
            <div className="bg-blue-50/50 border border-blue-200/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-900">AI Recommended Tasks</span>
                  <span className="text-[10px] text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{taskRecommendations.length} suggestions</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={acceptAllRecommendedTasks} disabled={taskSaving}
                    className="px-3 py-1 text-xs font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50">
                    {taskSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add All'}
                  </button>
                  <button onClick={() => setTaskRecommendations([])}
                    className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">Dismiss</button>
                </div>
              </div>
              <div className="space-y-2">
                {taskRecommendations.map((rec, idx) => {
                  const priorityColor = rec.priority === 'high' ? 'border-l-red-400' : rec.priority === 'medium' ? 'border-l-amber-400' : 'border-l-green-400';
                  return (
                    <div key={idx} className={`bg-white border border-gray-100 border-l-[3px] ${priorityColor} rounded-lg p-3`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-800">{rec.title}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                              rec.priority === 'high' ? 'text-red-600 bg-red-50' : rec.priority === 'medium' ? 'text-amber-600 bg-amber-50' : 'text-green-600 bg-green-50'
                            }`}>{rec.priority}</span>
                          </div>
                          {rec.description && <p className="text-xs text-gray-500 mt-0.5">{rec.description}</p>}
                          <div className="flex items-center gap-3 mt-1.5">
                            {rec.assignee && (
                              <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                <Users className="w-2.5 h-2.5" /> {rec.assignee}
                              </span>
                            )}
                            {rec.due && rec.due !== 'No deadline' && rec.due !== 'N/A' && (
                              <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                <Calendar className="w-2.5 h-2.5" /> {rec.due}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-blue-600/70 mt-1 italic">{rec.rationale}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => acceptRecommendedTask(rec)}
                            className="px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                            <Check className="w-3 h-3 inline mr-0.5" />Add
                          </button>
                          <button onClick={() => setTaskRecommendations(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick-add input + expand button */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newTaskTitle.trim()) createTask(newTaskTitle); }}
                  placeholder="Quick add task... (press Enter for title only)"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all placeholder:text-gray-400"
                  disabled={taskSaving}
                />
                {taskSaving && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-amber-500" />}
              </div>
              <button
                onClick={() => { setShowTaskForm(!showTaskForm); if (!showTaskForm) setTaskFormData({ title: newTaskTitle || '', description: '', assignee: '', assignee_contact_id: null, priority: 'medium', due_date: '' }); }}
                className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${showTaskForm ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                title="Expand to add more details"
              >
                {showTaskForm ? 'Simple' : '+ Details'}
              </button>
            </div>

            {/* Expanded task creation form */}
            {showTaskForm && (
              <div className="bg-amber-50/40 border border-amber-200/50 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Title *</label>
                    <input type="text" value={taskFormData.title} onChange={e => setTaskFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Task title" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                    <textarea value={taskFormData.description} onChange={e => setTaskFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Add more context or details..." rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 resize-none" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        <Users className="w-3 h-3 inline mr-1" />Owner
                      </label>
                      <ContactPicker
                        contacts={pickerContacts}
                        value={taskFormData.assignee_contact_id}
                        onChange={(contactId, contactName) => setTaskFormData(prev => ({ ...prev, assignee_contact_id: contactId, assignee: contactName }))}
                        placeholder="Assign contact..."
                        compact
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        <Calendar className="w-3 h-3 inline mr-1" />Deadline
                      </label>
                      <input type="date" value={taskFormData.due_date} onChange={e => setTaskFormData(prev => ({ ...prev, due_date: e.target.value }))}
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Priority</label>
                      <select value={taskFormData.priority} onChange={e => setTaskFormData(prev => ({ ...prev, priority: e.target.value as 'high' | 'medium' | 'low' }))}
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400">
                        <option value="low">🟢 Low</option>
                        <option value="medium">🟡 Medium</option>
                        <option value="high">🔴 High</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={() => createTask(taskFormData)} disabled={taskSaving || !taskFormData.title.trim()}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors disabled:opacity-50">
                    {taskSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Create Task'}
                  </button>
                  <button onClick={() => { setShowTaskForm(false); setTaskFormData({ title: '', description: '', assignee: '', assignee_contact_id: null, priority: 'medium', due_date: '' }); }}
                    className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Filter pills */}
          <div className="flex gap-1">
            {(['active', 'completed', 'archived', 'all'] as const).map(filter => {
              const counts = {
                active: tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length,
                completed: tasks.filter(t => t.status === 'completed').length,
                archived: tasks.filter(t => t.status === 'archived').length,
                all: tasks.length,
              };
              return (
                <button
                  key={filter}
                  onClick={() => setTaskFilter(filter)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    taskFilter === filter
                      ? 'bg-amber-100 text-amber-800'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  {counts[filter] > 0 && <span className="ml-1 text-[10px] opacity-70">{counts[filter]}</span>}
                </button>
              );
            })}
          </div>

          {/* Task list */}
          {(() => {
            const filteredTasks = tasks.filter(t => {
              if (taskFilter === 'active') return t.status === 'pending' || t.status === 'in_progress';
              if (taskFilter === 'completed') return t.status === 'completed';
              if (taskFilter === 'archived') return t.status === 'archived';
              return true;
            });

            if (filteredTasks.length === 0) {
              return (
                <div className="text-center py-12 text-gray-400">
                  <ListChecks className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-medium">
                    {tasks.length === 0
                      ? 'No tasks yet'
                      : `No ${taskFilter} tasks`}
                  </p>
                  <p className="text-xs mt-1">
                    {tasks.length === 0
                      ? 'Add tasks manually or extract them from linked items with AI'
                      : 'Try a different filter'}
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-1.5">
                {filteredTasks.map(task => {
                  const isCompleted = task.status === 'completed';
                  const isArchived = task.status === 'archived';
                  const isEditing = editingTaskId === task.id;
                  const priorityDot = task.priority === 'high' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-amber-400' : 'bg-green-400';
                  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !isCompleted && !isArchived;

                  if (isEditing) {
                    return (
                      <div key={task.id} className="border border-amber-200 bg-amber-50/30 rounded-xl p-4 space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Title</label>
                          <input type="text" value={editingTaskData.title} onChange={e => setEditingTaskData(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400" autoFocus />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                          <textarea value={editingTaskData.description} onChange={e => setEditingTaskData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Add details..." rows={2}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 resize-none" />
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                              <Users className="w-3 h-3 inline mr-1" />Owner
                            </label>
                            <ContactPicker
                              contacts={pickerContacts}
                              value={editingTaskData.assignee_contact_id}
                              onChange={(contactId, contactName) => setEditingTaskData(prev => ({ ...prev, assignee_contact_id: contactId, assignee: contactName }))}
                              placeholder="Assign contact..."
                              compact
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                              <Calendar className="w-3 h-3 inline mr-1" />Deadline
                            </label>
                            <input type="date" value={editingTaskData.due_date} onChange={e => setEditingTaskData(prev => ({ ...prev, due_date: e.target.value }))}
                              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/20" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Priority</label>
                            <select value={editingTaskData.priority} onChange={e => setEditingTaskData(prev => ({ ...prev, priority: e.target.value as 'high' | 'medium' | 'low' }))}
                              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/20">
                              <option value="low">🟢 Low</option>
                              <option value="medium">🟡 Medium</option>
                              <option value="high">🔴 High</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                            <select value={editingTaskData.status} onChange={e => setEditingTaskData(prev => ({ ...prev, status: e.target.value }))}
                              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/20">
                              <option value="pending">Pending</option>
                              <option value="in_progress">In Progress</option>
                              <option value="completed">Completed</option>
                              <option value="archived">Archived</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button onClick={saveEditingTask}
                            className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors disabled:opacity-50"
                            disabled={!editingTaskData.title.trim()}>
                            <Save className="w-3 h-3 inline mr-1" />Save
                          </button>
                          <button onClick={cancelEditingTask}
                            className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                          <div className="flex-1" />
                          <button onClick={() => { cancelEditingTask(); deleteTask(task.id); }}
                            className="px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-3 h-3 inline mr-1" />Delete
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={task.id}
                      className={`group flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-all hover:shadow-sm cursor-pointer ${
                        isArchived ? 'border-gray-100 bg-gray-50/50 opacity-60' : isCompleted ? 'border-green-100 bg-green-50/30' : 'border-gray-100 bg-white hover:border-gray-200'
                      }`}
                      onDoubleClick={() => startEditingTask(task)}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleTaskComplete(task.id)}
                        className={`mt-0.5 flex-shrink-0 transition-colors ${isCompleted ? 'text-green-500' : 'text-gray-300 hover:text-green-400'}`}
                        title={isCompleted ? 'Reopen task' : 'Complete task'}
                      >
                        {isCompleted ? <CheckSquare className="w-4.5 h-4.5" /> : <Square className="w-4.5 h-4.5" />}
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priorityDot}`} title={`${task.priority} priority`} />
                          <span className={`text-sm font-medium ${isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                            {task.title}
                          </span>
                          {task.source === 'ai_extracted' && (
                            <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" /> AI
                            </span>
                          )}
                          {task.status === 'in_progress' && (
                            <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">In Progress</span>
                          )}
                        </div>
                        {task.description && (
                          <p className={`text-xs mt-0.5 ${isCompleted ? 'text-gray-300' : 'text-gray-500'}`}>{task.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {task.assignee && (
                            <span className="text-[11px] text-gray-500 flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-full">
                              <Users className="w-3 h-3" /> {task.assignee}
                            </span>
                          )}
                          {task.due_date && (
                            <span className={`text-[11px] flex items-center gap-1 px-2 py-0.5 rounded-full ${
                              isOverdue ? 'text-red-700 bg-red-50 font-semibold' : 'text-gray-500 bg-gray-50'
                            }`}>
                              <Calendar className="w-3 h-3" />
                              {isOverdue && <AlertTriangle className="w-2.5 h-2.5" />}
                              {formatSmartDate(task.due_date)}
                            </span>
                          )}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                            task.priority === 'high' ? 'text-red-600 bg-red-50' : task.priority === 'medium' ? 'text-amber-600 bg-amber-50' : 'text-green-600 bg-green-50'
                          }`}>
                            {task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢'} {task.priority}
                          </span>
                          <span className="text-[10px] text-gray-300">
                            Added {formatRelativeDate(task.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Hover actions */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button onClick={() => startEditingTask(task)}
                          className="p-1 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" title="Edit task">
                          <Edit3 className="w-3 h-3" />
                        </button>
                        {!isCompleted && !isArchived && (
                          <button
                            onClick={() => updateTask(task.id, { status: task.status === 'in_progress' ? 'pending' : 'in_progress' } as Partial<TopicTask>)}
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title={task.status === 'in_progress' ? 'Set to pending' : 'Start working on this'}
                          >
                            <Activity className="w-3 h-3" />
                          </button>
                        )}
                        {isCompleted && (
                          <button onClick={() => archiveTask(task.id)}
                            className="p-1 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors" title="Archive task">
                            <Archive className="w-3 h-3" />
                          </button>
                        )}
                        <button onClick={() => deleteTask(task.id)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete task">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ===== INTELLIGENCE TAB ===== */}
      {activeSection === 'intelligence' && (
        <div id="section-analysis" className="scroll-mt-8 rounded-xl border border-gray-100 shadow-sm overflow-hidden hover-lift bg-gradient-to-br from-white via-white to-purple-50/20">
          <div className="px-5 py-3.5 flex items-center justify-between bg-gradient-to-r from-purple-50/30 to-blue-50/30 border-b border-purple-100/50">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </span>
              Topic Intelligence
              {analysis && !analysisLoading && (
                <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="ai-success-check"/></svg>
                  Ready
                </span>
              )}
              {analysisLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />}
            </h2>
            <span onClick={() => runAnalysis()}
              className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg text-xs font-medium hover:from-purple-600 hover:to-blue-600 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm">
              {analysisLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {analysis ? 'Refresh' : 'Run'}
            </span>
          </div>
          <div className="px-5 py-5">
            {analysisLoading ? (
              <div className="space-y-3 py-4">
                {/* Shimmer loading effect */}
                <div className="ai-shimmer h-5 w-3/4" />
                <div className="ai-shimmer h-4 w-full" />
                <div className="ai-shimmer h-4 w-5/6" />
                <div className="ai-shimmer h-4 w-2/3" />
                <div className="ai-shimmer h-5 w-1/2 mt-4" />
                <div className="ai-shimmer h-4 w-full" />
                <div className="ai-shimmer h-4 w-4/5" />
                <p className="text-center text-xs text-purple-400 mt-4 flex items-center justify-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {aiQuestion ? 'Answering your question...' : 'Analyzing linked items...'}
                </p>
              </div>
            ) : analysis ? (
              <div className="ai-glass-card rounded-xl border border-purple-100/50 overflow-hidden">
                {/* Collapsible header with metadata */}
                <button
                  onClick={() => setSummaryCollapsed(prev => !prev)}
                  className="w-full px-5 py-3 flex items-center justify-between bg-gradient-to-r from-purple-50/40 to-blue-50/40 hover:from-purple-50/60 hover:to-blue-50/60 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-semibold text-gray-800">AI Summary</span>
                    {topic.updated_at && (
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        Last analyzed: {formatRelativeDate(topic.updated_at)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      onClick={(e) => { e.stopPropagation(); runAnalysis(); }}
                      className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-lg text-[10px] font-semibold hover:bg-purple-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" /> Re-analyze
                    </span>
                    {summaryCollapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>
                {/* Collapsible content */}
                {!summaryCollapsed && (
                  <div className="px-5 py-4">
                    <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
                      {analysis.split('\n').map((line, i) => {
                        if (line.startsWith('## ')) {
                          return <h3 key={i} className="font-bold text-gray-900 mt-5 mb-2 text-base border-b border-purple-100/50 pb-1.5">{line.replace('## ', '')}</h3>;
                        }
                        if (line.startsWith('# ')) {
                          return <h2 key={i} className="font-bold text-gray-900 mt-4 mb-2 text-lg">{line.replace('# ', '')}</h2>;
                        }
                        if (line.startsWith('### ')) {
                          return <h4 key={i} className="font-semibold text-gray-800 mt-3 mb-1 text-sm">{line.replace('### ', '')}</h4>;
                        }
                        if (line.startsWith('- ') || line.startsWith('* ')) {
                          return <li key={i} className="ml-4 text-sm text-gray-700 mt-1 leading-relaxed">{line.slice(2)}</li>;
                        }
                        if (/^\d+\.\s/.test(line)) {
                          return <li key={i} className="ml-4 text-sm text-gray-700 mt-1 leading-relaxed list-decimal">{line.replace(/^\d+\.\s/, '')}</li>;
                        }
                        if (line.startsWith('**') && line.endsWith('**')) {
                          return <p key={i} className="font-semibold text-gray-800 mt-3">{line.replace(/\*\*/g, '')}</p>;
                        }
                        if (line.startsWith('> ')) {
                          return <blockquote key={i} className="border-l-3 border-purple-300 pl-3 text-sm text-gray-600 italic mt-2 bg-purple-50/30 py-1 rounded-r">{line.slice(2)}</blockquote>;
                        }
                        if (line.startsWith('```')) {
                          return <div key={i} className="bg-gray-900 text-gray-200 rounded-lg px-3 py-2 text-xs font-mono mt-2">{line.replace(/```\w*/, '')}</div>;
                        }
                        if (line.trim() === '') return <br key={i} />;
                        // Inline bold/italic support
                        const rendered = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
                        if (rendered !== line) {
                          return <p key={i} className="text-sm text-gray-700 mt-1.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: rendered }} />;
                        }
                        return <p key={i} className="text-sm text-gray-700 mt-1.5 leading-relaxed">{line}</p>;
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <Brain className="w-8 h-8 text-purple-400" />
                </div>
                {items.length > 0 ? (
                  <>
                    <h3 className="text-base font-semibold text-gray-800 mb-1">Unlock Topic Intelligence</h3>
                    <p className="text-sm text-gray-500 max-w-sm mx-auto mb-5">
                      AI will analyze your {items.length} linked item{items.length !== 1 ? 's' : ''} to generate insights, identify patterns, and surface key information.
                    </p>
                    <button onClick={() => runAnalysis()}
                      className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl text-sm font-semibold hover:from-purple-700 hover:to-blue-700 inline-flex items-center gap-2 transition-all shadow-md hover:shadow-lg">
                      <Sparkles className="w-4 h-4" /> Run AI Analysis
                    </button>
                    <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-400">
                      <span className="inline-flex items-center gap-1"><Brain className="w-3 h-3" /> Summary</span>
                      <span className="inline-flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Key Insights</span>
                      <span className="inline-flex items-center gap-1"><ListChecks className="w-3 h-3" /> Next Steps</span>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-base font-semibold text-gray-800 mb-1">Link Items to Get Started</h3>
                    <p className="text-sm text-gray-500 max-w-sm mx-auto mb-4">
                      Add emails, documents, messages, or notes to this topic, then run AI analysis for powerful insights.
                    </p>
                    <button onClick={() => setActiveSection('search')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 inline-flex items-center gap-1.5 transition-colors">
                      <Search className="w-3.5 h-3.5" /> Find & Link Items
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Ask AI a question */}
            {items.length > 0 && (
              <div className="mt-5 pt-4 border-t border-gray-100">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <MessageSquare className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      value={aiQuestion}
                      onChange={e => setAiQuestion(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && aiQuestion.trim() && runAnalysis(aiQuestion)}
                      placeholder="Ask AI a question about this topic..."
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      disabled={analysisLoading}
                    />
                  </div>
                  <button
                    onClick={() => aiQuestion.trim() && runAnalysis(aiQuestion)}
                    disabled={analysisLoading || !aiQuestion.trim()}
                    className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-xs font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 flex items-center gap-1.5 transition-all"
                  >
                    {analysisLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Ask
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== SEARCH TAB ===== */}
      {activeSection === 'search' && (
        <div id="section-search" className="scroll-mt-8 space-y-4">

          {/* Review Recent Activity Panel */}
          <div className="bg-white rounded-xl border border-teal-200 overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-teal-100 bg-gradient-to-r from-teal-50/50 to-cyan-50/30">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
                    <Activity className="w-3.5 h-3.5 text-white" />
                  </span>
                  Review Recent Activity
                </h3>
                {reviewResults.length > 0 && !reviewLoading && (
                  <span className="text-xs font-medium text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">
                    {reviewResults.filter(r => !r.already_linked).length} new items found
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">Scan your connected sources for items not yet linked to this topic</p>
            </div>
            <div className="px-5 py-3.5 space-y-3">
              {/* Time period selector */}
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
              </div>
              {/* Source filter */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-gray-400 mr-1">Sources:</span>
                {['gmail', 'calendar', 'drive', 'slack', 'notion'].map(src => (
                  <button key={src} onClick={() => {
                    setReviewSources(prev => {
                      const next = new Set(prev);
                      next.has(src) ? next.delete(src) : next.add(src);
                      return next;
                    });
                  }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                      reviewSources.has(src)
                        ? 'bg-teal-50 text-teal-700 border-teal-200'
                        : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                    }`}>
                    <SourceIcon source={src} className="w-3 h-3" /> {sourceLabel(src)}
                  </button>
                ))}
              </div>
              {/* Scan button */}
              <button
                onClick={handleReviewActivity}
                disabled={reviewLoading || reviewSources.size === 0}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-lg text-sm font-medium hover:from-teal-700 hover:to-cyan-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                {reviewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                {reviewLoading ? 'Scanning sources...' : `Scan Last ${reviewTimePeriod === '15d' ? '15 Days' : reviewTimePeriod === '1m' ? 'Month' : '3 Months'}`}
              </button>
            </div>

            {/* Review Results */}
            {showReviewPanel && (reviewResults.length > 0 || reviewLoading) && (
              <div className="border-t border-teal-100">
                <div className="px-5 py-2.5 flex items-center justify-between bg-teal-50/30">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-gray-600">
                      {reviewLoading ? 'Scanning...' : `${reviewResults.length} results`}
                    </span>
                    {reviewResults.filter(r => !r.already_linked).length > 0 && !reviewLoading && (
                      <button onClick={selectAllReview}
                        className="text-xs text-teal-600 hover:text-teal-800 flex items-center gap-1 transition-colors">
                        {selectedReviewResults.size === reviewResults.filter(r => !r.already_linked).length
                          ? <><CheckSquare className="w-3 h-3" /> Deselect All</>
                          : <><Square className="w-3 h-3" /> Select All</>}
                      </button>
                    )}
                  </div>
                  {selectedReviewResults.size > 0 && (
                    <button onClick={linkSelectedReview} disabled={linkingItems}
                      className="px-3 py-1.5 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-lg text-xs font-medium hover:from-teal-700 hover:to-cyan-700 disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition-all">
                      {linkingItems ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                      Link {selectedReviewResults.size} Selected
                    </button>
                  )}
                </div>
                {reviewResults.length === 0 && !reviewLoading ? (
                  <p className="px-5 py-8 text-center text-sm text-gray-500">No unlinked items found for this time period. Your topic appears up to date!</p>
                ) : reviewLoading ? (
                  <div className="px-5 py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-teal-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Scanning your connected sources...</p>
                    <p className="text-xs text-gray-400 mt-1">This may take a few seconds</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto thin-scrollbar">
                    {reviewResults.map((item) => {
                      const key = item.source + ':' + item.external_id;
                      const confidencePercent = item.ai_confidence != null ? Math.round(item.ai_confidence * 100) : null;
                      return (
                        <div key={key} className={`px-5 py-3.5 flex items-start gap-3 transition-colors ${item.already_linked ? 'opacity-50 bg-gray-50' : 'hover:bg-teal-50/20'}`}>
                          {!item.already_linked && (
                            <input type="checkbox" checked={selectedReviewResults.has(key)}
                              onChange={() => toggleReviewResult(key)}
                              className="mt-1 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                          )}
                          {item.already_linked && (
                            <span className="mt-1 text-green-500 text-xs font-semibold flex items-center gap-0.5">
                              <Check className="w-3 h-3" /> Linked
                            </span>
                          )}
                          <span className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${sourceIconBgClass(item.source)}`}>
                            <SourceIcon source={item.source} className="w-3.5 h-3.5" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{decodeHtmlEntities(item.title)}</p>
                            <p className="text-xs text-gray-500 truncate mt-0.5">{decodeHtmlEntities(item.snippet)}</p>
                            <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${sourceIconBgClass(item.source)}`}>
                                {sourceLabel(item.source)}
                              </span>
                              <span>{formatRelativeDate(item.occurred_at)}</span>
                              {confidencePercent != null && (
                                <span className="flex items-center gap-1.5">
                                  <span className={`text-[10px] font-bold ${confidencePercent >= 80 ? 'text-green-600' : confidencePercent >= 50 ? 'text-amber-600' : 'text-gray-500'}`}>
                                    {confidencePercent}%
                                  </span>
                                  <span className="confidence-meter w-12">
                                    <span className={`confidence-meter-fill ${confidencePercent >= 80 ? 'bg-green-500' : confidencePercent >= 50 ? 'bg-amber-500' : 'bg-gray-400'}`} style={{ width: `${confidencePercent}%` }} />
                                  </span>
                                </span>
                              )}
                            </div>
                            {item.ai_reason && (
                              <p className="text-xs text-teal-600 mt-1.5 italic bg-teal-50/50 px-2 py-1 rounded">{item.ai_reason}</p>
                            )}
                          </div>
                          <a href={item.url} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors" title="Open in source">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Manual Search */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover-lift">
            <div className="px-5 py-4 space-y-3">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
                    placeholder="Search emails, messages, events, files..."
                    className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                <button onClick={() => handleSearch()} disabled={searchLoading}
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors">
                  {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Search
                </button>
                <button onClick={handleAiFind} disabled={aiFindLoading}
                  className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 flex items-center gap-2 transition-all">
                  {aiFindLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  AI Find
                </button>
              </div>
              {/* Source filter pills + options toggle */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-gray-400 mr-1">Sources:</span>
                {SOURCES.map(src => (
                  <button key={src} onClick={() => toggleSource(src)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      searchSources.has(src)
                        ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm'
                        : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                    }`}>
                    <SourceIcon source={src} className="w-3.5 h-3.5" /> {sourceLabel(src)}
                  </button>
                ))}
                <button onClick={() => setShowSearchOptions(!showSearchOptions)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all ml-auto ${
                    showSearchOptions || selectedAccountIds.size > 0 || searchMaxResults !== 20
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                  }`}>
                  <Activity className="w-3 h-3" />
                  {showSearchOptions ? 'Less' : 'Options'}
                  {(selectedAccountIds.size > 0 || searchMaxResults !== 20) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  )}
                </button>
              </div>

              {/* Advanced search options (accounts, result limit) */}
              {showSearchOptions && (
                <div className="space-y-3 pt-2 border-t border-gray-100 mt-1">
                  {/* Account selection */}
                  {(searchAccounts.google.length > 1 || searchAccounts.slack.length > 1 || searchAccounts.notion.length > 1) && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500">Search Accounts</span>
                        {selectedAccountIds.size > 0 && (
                          <button onClick={() => setSelectedAccountIds(new Set())}
                            className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-0.5">
                            <X className="w-2.5 h-2.5" /> Clear filter
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {searchAccounts.google.map(a => (
                          <button key={a.id}
                            onClick={() => setSelectedAccountIds(prev => {
                              const next = new Set(prev);
                              next.has(a.id) ? next.delete(a.id) : next.add(a.id);
                              return next;
                            })}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-all ${
                              selectedAccountIds.size === 0 || selectedAccountIds.has(a.id)
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                            }`}>
                            <SourceIcon source="gmail" className="w-3.5 h-3.5" />
                            {a.email}
                            {selectedAccountIds.has(a.id) && <Check className="w-3 h-3 text-blue-600" />}
                          </button>
                        ))}
                        {searchAccounts.slack.map(a => (
                          <button key={a.id}
                            onClick={() => setSelectedAccountIds(prev => {
                              const next = new Set(prev);
                              next.has(a.id) ? next.delete(a.id) : next.add(a.id);
                              return next;
                            })}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-all ${
                              selectedAccountIds.size === 0 || selectedAccountIds.has(a.id)
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                            }`}>
                            <SourceIcon source="slack" className="w-3.5 h-3.5" />
                            {a.name}
                            {selectedAccountIds.has(a.id) && <Check className="w-3 h-3 text-purple-600" />}
                          </button>
                        ))}
                        {searchAccounts.notion.map(a => (
                          <button key={a.id}
                            onClick={() => setSelectedAccountIds(prev => {
                              const next = new Set(prev);
                              next.has(a.id) ? next.delete(a.id) : next.add(a.id);
                              return next;
                            })}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-all ${
                              selectedAccountIds.size === 0 || selectedAccountIds.has(a.id)
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                            }`}>
                            <SourceIcon source="notion" className="w-3.5 h-3.5" />
                            {a.name}
                            {selectedAccountIds.has(a.id) && <Check className="w-3 h-3 text-amber-600" />}
                          </button>
                        ))}
                      </div>
                      {selectedAccountIds.size === 0 && (
                        <p className="text-[10px] text-gray-400 mt-1">All accounts searched. Click to filter specific accounts.</p>
                      )}
                    </div>
                  )}

                  {/* Max results control */}
                  <div>
                    <span className="text-xs font-medium text-gray-500 block mb-1.5">Results per search</span>
                    <div className="flex gap-1.5">
                      {[20, 50, 100].map(n => (
                        <button key={n} onClick={() => setSearchMaxResults(n)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            searchMaxResults === n
                              ? 'bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-blue-200'
                              : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                          }`}>
                          {n} results
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden animate-slide-up">
              <div className="px-5 py-3 border-b border-blue-100 flex items-center justify-between bg-blue-50/30">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-blue-500" />
                    Search Results
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{searchResults.length}</span>
                  </h3>
                  {searchResults.filter(r => !r.already_linked).length > 0 && (
                    <button onClick={selectAllSearch}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors">
                      {selectedResults.size === searchResults.filter(r => !r.already_linked).length
                        ? <><CheckSquare className="w-3 h-3" /> Deselect All</>
                        : <><Square className="w-3 h-3" /> Select All</>}
                    </button>
                  )}
                </div>
                {selectedResults.size > 0 && (
                  <button onClick={linkSelectedSearch} disabled={linkingItems}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition-colors">
                    {linkingItems ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                    Link {selectedResults.size} Selected
                  </button>
                )}
              </div>
              <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto thin-scrollbar">
                {searchResults.map((item) => {
                  const key = item.source + ':' + item.external_id;
                  return (
                    <div key={key} className={`px-5 py-3.5 flex items-start gap-3 transition-colors ${item.already_linked ? 'opacity-50 bg-gray-50' : 'hover:bg-blue-50/30'}`}>
                      {!item.already_linked && (
                        <input type="checkbox" checked={selectedResults.has(key)}
                          onChange={() => toggleSearchResult(key)}
                          className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      )}
                      {item.already_linked && (
                        <span className="mt-1 text-green-500 text-xs font-semibold flex items-center gap-0.5">
                          <Check className="w-3 h-3" /> Linked
                        </span>
                      )}
                      <span className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${sourceIconBgClass(item.source)}`}>
                        <SourceIcon source={item.source} className="w-3.5 h-3.5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{decodeHtmlEntities(item.title)}</p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{decodeHtmlEntities(item.snippet)}</p>
                        <div className="flex gap-2 mt-1.5 text-xs text-gray-400">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${sourceIconBgClass(item.source)}`}>
                            {sourceLabel(item.source)}
                          </span>
                          <span>{formatRelativeDate(item.occurred_at)}</span>
                        </div>
                      </div>
                      <a href={item.url} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Open in source">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  );
                })}
              </div>
              {/* Load more / expand results */}
              {searchResults.length >= searchMaxResults && searchMaxResults < 100 && (
                <div className="px-5 py-3 border-t border-blue-100 bg-blue-50/30 flex items-center justify-center">
                  <button
                    onClick={() => {
                      const nextMax = Math.min(searchMaxResults + 30, 100);
                      setSearchMaxResults(nextMax);
                      handleSearch(nextMax);
                    }}
                    disabled={searchLoading}
                    className="px-4 py-2 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {searchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                    Load more results (currently showing {searchMaxResults}, max 100)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* AI Find Results */}
          {showAiResults && (
            <div className="bg-white rounded-xl border border-purple-200 shadow-sm overflow-hidden animate-slide-up">
              <div className="px-5 py-3 border-b border-purple-100 flex items-center justify-between bg-gradient-to-r from-purple-50/50 to-pink-50/30">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </span>
                    AI Find Results
                    {aiFindLoading && <Loader2 className="w-4 h-4 animate-spin text-purple-500" />}
                  </h3>
                  {aiFindResults.filter(r => !r.already_linked).length > 0 && !aiFindLoading && (
                    <button onClick={selectAllAi}
                      className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1 transition-colors">
                      {selectedAiResults.size === aiFindResults.filter(r => !r.already_linked).length
                        ? <><CheckSquare className="w-3 h-3" /> Deselect All</>
                        : <><Square className="w-3 h-3" /> Select All</>}
                    </button>
                  )}
                </div>
                {selectedAiResults.size > 0 && (
                  <button onClick={linkSelectedAi} disabled={linkingItems}
                    className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg text-xs font-medium hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition-all">
                    {linkingItems ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                    Link {selectedAiResults.size} Selected
                  </button>
                )}
              </div>
              {aiFindResults.length === 0 && !aiFindLoading ? (
                <p className="px-5 py-8 text-center text-sm text-gray-500">No results found. Try adding a more detailed description to your topic.</p>
              ) : (
                <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto thin-scrollbar">
                  {aiFindResults.map((item) => {
                    const key = item.source + ':' + item.external_id;
                    const confidencePercent = item.ai_confidence != null ? Math.round(item.ai_confidence * 100) : null;
                    return (
                      <div key={key} className={`px-5 py-3.5 flex items-start gap-3 transition-colors ${item.already_linked ? 'opacity-50 bg-gray-50' : 'hover:bg-purple-50/20'}`}>
                        {!item.already_linked && (
                          <input type="checkbox" checked={selectedAiResults.has(key)}
                            onChange={() => toggleAiResult(key)}
                            className="mt-1 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                        )}
                        {item.already_linked && (
                          <span className="mt-1 text-green-500 text-xs font-semibold flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> Linked
                          </span>
                        )}
                        <span className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${sourceIconBgClass(item.source)}`}>
                          <SourceIcon source={item.source} className="w-3.5 h-3.5" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{decodeHtmlEntities(item.title)}</p>
                          <p className="text-xs text-gray-500 truncate mt-0.5">{decodeHtmlEntities(item.snippet)}</p>
                          <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${sourceIconBgClass(item.source)}`}>
                              {sourceLabel(item.source)}
                            </span>
                            <span>{formatRelativeDate(item.occurred_at)}</span>
                            {/* AI confidence indicator */}
                            {confidencePercent != null && (
                              <span className="flex items-center gap-1.5">
                                <span className={`text-[10px] font-bold ${confidencePercent >= 80 ? 'text-green-600' : confidencePercent >= 50 ? 'text-amber-600' : 'text-gray-500'}`}>
                                  {confidencePercent}%
                                </span>
                                <span className="confidence-meter w-12">
                                  <span className={`confidence-meter-fill ${confidencePercent >= 80 ? 'bg-green-500' : confidencePercent >= 50 ? 'bg-amber-500' : 'bg-gray-400'}`} style={{ width: `${confidencePercent}%` }} />
                                </span>
                              </span>
                            )}
                          </div>
                          {item.ai_reason && (
                            <p className="text-xs text-purple-600 mt-1.5 italic bg-purple-50/50 px-2 py-1 rounded">{item.ai_reason}</p>
                          )}
                        </div>
                        <a href={item.url} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Open in source">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {/* ===== DETAILS TAB ===== */}
      {activeSection === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-slide-up">
          {/* Key Metrics */}
          <div className="bg-gradient-to-br from-white to-blue-50/30 rounded-xl border border-gray-100 p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Overview</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-2 bg-blue-50 rounded-lg">
                <p className="text-lg font-bold text-blue-600">{items.length}</p>
                <p className="text-xs text-gray-500">Linked Items</p>
              </div>
              <div className="text-center p-2 bg-purple-50 rounded-lg">
                <p className="text-lg font-bold text-purple-600">{Object.keys(sourceCounts).length}</p>
                <p className="text-xs text-gray-500">Sources</p>
              </div>
              <div className="text-center p-2 bg-green-50 rounded-lg">
                <p className="text-lg font-bold text-green-600">{topic.priority || 0}</p>
                <p className="text-xs text-gray-500">Priority</p>
              </div>
              <div className="text-center p-2 bg-amber-50 rounded-lg">
                <p className="text-lg font-bold text-amber-600">{topic.progress_percent ?? 0}%</p>
                <p className="text-xs text-gray-500">Progress</p>
              </div>
            </div>
            {(topic.tags && topic.tags.length > 0) && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1.5">Tags</p>
                <div className="flex gap-1 flex-wrap">
                  {topic.tags.map((tag, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{tag}</span>
                  ))}
                </div>
              </div>
            )}
            {topic.goal && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Goal</p>
                <p className="text-sm text-gray-700">{topic.goal}</p>
              </div>
            )}
            {/* Topic Health Score */}
            {(() => {
              let score = 100;
              const daysSinceUpdate = Math.floor((Date.now() - new Date(topic.updated_at).getTime()) / (1000 * 60 * 60 * 24));
              if (daysSinceUpdate > 14) score -= 30;
              else if (daysSinceUpdate > 7) score -= 15;
              if (!topic.description) score -= 10;
              if (items.length === 0) score -= 20;
              if (topic.due_date && new Date(topic.due_date) < new Date()) score -= 25;
              if (!topic.tags || topic.tags.length === 0) score -= 5;
              score = Math.max(0, Math.min(100, score));
              const color = score >= 80 ? 'text-green-600' : score >= 50 ? 'text-amber-600' : 'text-red-600';
              const barColor = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
              return (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-gray-500 flex items-center gap-1"><Heart className="w-3 h-3" /> Health</p>
                    <span className={`text-xs font-bold ${color}`}>{score}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${score}%` }} />
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Timeline */}
          <div className="bg-gradient-to-br from-white to-purple-50/30 rounded-xl border border-gray-100 p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Timeline
            </h3>
            {items.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No items linked yet</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {items.slice(0, 8).map((item, idx) => (
                  <div key={item.id} className="flex items-start gap-2">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                      {idx < Math.min(items.length, 8) - 1 && <div className="w-0.5 h-full bg-gray-200 min-h-[16px]" />}
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <p className="text-xs font-medium text-gray-800 truncate">{item.title}</p>
                      <div className="flex gap-1 text-xs text-gray-400 items-center">
                        <SourceIcon source={item.source} className="w-3 h-3" />
                        <span>{formatRelativeDate(item.occurred_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {items.length > 8 && (
                  <p className="text-xs text-gray-400 text-center">+{items.length - 8} more items</p>
                )}
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-1 text-xs text-gray-500">
              {topic.start_date && <p>Started: {new Date(topic.start_date).toLocaleDateString()}</p>}
              {topic.due_date && (
                <p className={new Date(topic.due_date) < new Date() ? 'text-red-600 font-medium' : ''}>
                  Due: {new Date(topic.due_date).toLocaleDateString()}
                  {new Date(topic.due_date) < new Date() && ' (Overdue)'}
                </p>
              )}
              {topic.created_at && <p>Created: {new Date(topic.created_at).toLocaleDateString()}</p>}
            </div>
          </div>

          {/* People & Contacts */}
          <div className="bg-gradient-to-br from-white to-teal-50/30 rounded-xl border border-gray-100 p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1">
              <Users className="w-3 h-3" /> People Involved
            </h3>
            {topic.owner && (
              <div className="mb-2">
                <p className="text-xs text-gray-500">Owner</p>
                <p className="text-sm font-medium text-gray-800">{topic.owner}</p>
              </div>
            )}
            {topic.stakeholders && topic.stakeholders.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-1">Stakeholders</p>
                <div className="flex gap-1 flex-wrap">
                  {topic.stakeholders.map((s, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {topic.client && (
              <div className="mb-2">
                <p className="text-xs text-gray-500">Client</p>
                <p className="text-sm text-gray-700">{topic.client}</p>
              </div>
            )}
            {topic.company && (
              <div className="mb-2">
                <p className="text-xs text-gray-500">Company</p>
                <p className="text-sm text-gray-700">{topic.company}</p>
              </div>
            )}
            {/* Extract unique contacts from item metadata */}
            {(() => {
              const contacts = new Map<string, string>();
              items.forEach(item => {
                const meta = item.metadata || {};
                if (meta.from && typeof meta.from === 'string') {
                  const name = meta.from.split('<')[0].trim();
                  if (name && !contacts.has(name.toLowerCase())) contacts.set(name.toLowerCase(), name);
                }
              });
              const contactList = Array.from(contacts.values()).slice(0, 6);
              if (contactList.length === 0) return null;
              return (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">From Communications</p>
                  <div className="flex gap-1 flex-wrap">
                    {contactList.map((name, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{name}</span>
                    ))}
                    {contacts.size > 6 && <span className="text-xs text-gray-400">+{contacts.size - 6} more</span>}
                  </div>
                </div>
              );
            })()}
            {!topic.owner && (!topic.stakeholders || topic.stakeholders.length === 0) && items.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">No contacts associated yet</p>
            )}
            {topic.risk_level && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Risk Level</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  topic.risk_level === 'critical' ? 'bg-red-100 text-red-700' :
                  topic.risk_level === 'high' ? 'bg-orange-100 text-orange-700' :
                  topic.risk_level === 'medium' ? 'bg-amber-100 text-amber-700' :
                  'bg-green-100 text-green-700'
                }`}>{topic.risk_level}</span>
              </div>
            )}
          </div>

          {/* Sub-topics section */}
          {childTopics.length > 0 && (
            <div className="mt-4 bg-gradient-to-br from-white to-indigo-50/30 rounded-xl border border-gray-100 p-4 shadow-sm lg:col-span-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Layers className="w-3 h-3 text-indigo-500" /> Sub-topics
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">{childTopics.length}</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {childTopics.map(child => {
                  const statusColor = child.status === 'active' ? 'bg-emerald-100 text-emerald-700' : child.status === 'completed' ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-700';
                  const areaBorder = child.area === 'work' ? 'border-l-blue-500' : child.area === 'personal' ? 'border-l-green-500' : 'border-l-purple-500';
                  return (
                    <Link key={child.id} href={`/topics/${child.id}`}
                      className={`block px-3 py-2.5 bg-white rounded-lg border border-gray-100 border-l-[3px] ${areaBorder} hover:border-indigo-200 hover:shadow-md transition-all`}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900 truncate flex-1">{child.title}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColor}`}>{child.status}</span>
                      </div>
                      {child.description && (
                        <p className="text-xs text-gray-500 mt-1 truncate">{child.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
                        {child.progress_percent != null && child.progress_percent > 0 && (
                          <span className="flex items-center gap-1">
                            <div className="w-8 h-1 rounded-full bg-gray-200">
                              <div className={`h-full rounded-full ${child.progress_percent >= 80 ? 'bg-green-500' : 'bg-blue-500'}`}
                                style={{ width: `${child.progress_percent}%` }} />
                            </div>
                            {child.progress_percent}%
                          </span>
                        )}
                        {child.tags && child.tags.length > 0 && (
                          <span>{child.tags.slice(0, 2).join(', ')}</span>
                        )}
                        <span className="ml-auto">{formatRelativeDate(child.updated_at)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== CONTACTS TAB ===== */}
      {activeSection === 'contacts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-white" />
              </span>
              <h2 className="text-base font-bold text-gray-900">Linked Contacts</h2>
              <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{linkedContacts.length}</span>
            </div>
            <button onClick={() => setShowLinkContactForm(v => !v)}
              className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 flex items-center gap-1.5 transition-colors shadow-sm">
              <Users className="w-3.5 h-3.5" /> Link Contact
            </button>
          </div>

          {/* Link Contact Form */}
          {showLinkContactForm && (
            <div className="p-4 bg-teal-50/50 border border-teal-200 rounded-xl space-y-3 animate-slide-up">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={contactSearchQuery}
                  onChange={e => setContactSearchQuery(e.target.value)}
                  placeholder="Search contacts by name or email..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                  autoFocus
                />
                {contactSearchLoading && <Loader2 className="w-4 h-4 animate-spin text-teal-500 absolute right-3 top-1/2 -translate-y-1/2" />}
              </div>
              {allContacts.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-1 thin-scrollbar">
                  {allContacts
                    .filter(c => !linkedContacts.some(lc => lc.contact_id === c.id))
                    .map(contact => (
                      <button
                        key={contact.id}
                        onClick={() => linkContact(contact.id)}
                        disabled={linkingContact}
                        className="w-full flex items-center gap-3 p-2.5 bg-white rounded-lg border border-gray-100 hover:border-teal-300 hover:bg-teal-50/30 transition-all text-left disabled:opacity-50"
                      >
                        <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                          {contact.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{contact.name}</p>
                          {contact.email && <p className="text-xs text-gray-400 truncate">{contact.email}</p>}
                        </div>
                        <Link2 className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                      </button>
                    ))}
                </div>
              )}
              {allContacts.length === 0 && !contactSearchLoading && contactSearchQuery && (
                <p className="text-xs text-gray-400 text-center py-3">No contacts found</p>
              )}
              <button onClick={() => { setShowLinkContactForm(false); setContactSearchQuery(''); }}
                className="text-xs text-gray-500 hover:text-gray-700 hover:underline">Cancel</button>
            </div>
          )}

          {/* Contact Cards */}
          {linkedContacts.length > 0 ? (
            <div className="space-y-2">
              {linkedContacts.map(lc => (
                <div key={lc.id} className="p-3.5 bg-white rounded-xl border border-gray-100 shadow-sm flex items-center gap-3 group hover:shadow-md transition-all">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-100 to-cyan-100 text-teal-700 flex items-center justify-center text-base font-semibold flex-shrink-0">
                    {lc.contacts?.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{lc.contacts?.name || 'Unknown'}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                      {lc.contacts?.email && <span className="truncate">{lc.contacts.email}</span>}
                      {lc.contacts?.organization && <span className="truncate">{lc.contacts.organization}</span>}
                    </div>
                  </div>
                  {lc.role && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 flex-shrink-0">
                      {lc.role}
                    </span>
                  )}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <Link href={`/contacts/${lc.contact_id}`}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View contact">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                    <button onClick={() => unlinkContact(lc.contact_id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Unlink contact">
                      <Unlink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : !showLinkContactForm && (
            <div className="py-12 bg-gradient-to-b from-white to-gray-50/50 rounded-xl border border-dashed border-gray-200 text-center">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-teal-400" />
              </div>
              <h3 className="text-gray-700 text-sm font-semibold mb-1">No contacts linked yet</h3>
              <p className="text-gray-400 text-xs mb-4">Associate people with this topic for better organization.</p>
              <button onClick={() => setShowLinkContactForm(true)}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 inline-flex items-center gap-1.5 transition-colors">
                <Users className="w-3.5 h-3.5" /> Link a Contact
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== NOTES TAB ===== */}
      {activeSection === 'notes' && (
        <div id="section-notes" className="scroll-mt-8 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover-lift">
          <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-amber-500" />
              Quick Notes
              <span className="text-xs text-gray-400 font-normal">&middot; included in AI analysis</span>
            </h2>
            <div className="flex items-center gap-3">
              {/* Auto-save indicator */}
              {notesSaving && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                </span>
              )}
              {notesSaved && !notesSaving && (
                <span className="text-xs text-green-500 flex items-center gap-1 saved-indicator">
                  <Check className="w-3 h-3" /> Saved
                </span>
              )}
              {/* Word count */}
              <span className="text-[10px] text-gray-300 font-mono tabular-nums">
                {noteWordCount} {noteWordCount === 1 ? 'word' : 'words'}
              </span>
              <button onClick={saveNotes} disabled={notesSaving}
                className="px-3 py-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg text-xs font-medium disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                {notesSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save
              </button>
            </div>
          </div>
          <div className="p-4">
            <textarea
              value={notes}
              onChange={e => handleNotesChange(e.target.value)}
              onFocus={() => setNotesFocused(true)}
              onBlur={() => setNotesFocused(false)}
              placeholder="Add notes about this topic... (auto-saves after 2s)"
              className={`w-full min-h-[120px] px-4 py-3 border rounded-lg text-sm text-gray-700 bg-gray-50/30 focus:bg-white focus:outline-none resize-y transition-all leading-relaxed font-[system-ui] ${
                notesFocused ? 'notes-textarea border-blue-300' : 'border-gray-200'
              }`}
            />
          </div>
        </div>
      )}

      {/* ===== TIMELINE TAB ===== */}
      {activeSection === 'timeline' && (
        <TopicTimeline topic={topic} items={items} linkedContacts={linkedContacts} />
      )}
      {/* ===== AGENT RESULTS - shown regardless of active tab ===== */}

      {/* Title suggestions */}
      {showTitleSuggestions && titleSuggestions.length > 0 && (
        <div className="rounded-xl border border-gray-100 shadow-sm overflow-hidden bg-purple-50/50 px-4 py-3">
          <p className="text-xs text-purple-700 font-medium mb-2">Suggested Titles:</p>
          <div className="space-y-1">
            {titleSuggestions.map((s, i) => (
              <button key={i} onClick={() => applyTitle(s)}
                className="block w-full text-left px-3 py-2 text-sm bg-white rounded border border-purple-100 hover:border-purple-300 hover:bg-purple-50 transition-colors">
                {s}
              </button>
            ))}
          </div>
          <button onClick={() => setShowTitleSuggestions(false)} className="text-xs text-purple-600 hover:underline mt-2">Dismiss</button>
        </div>
      )}

      {/* Action items */}
      {showActionItems && actionItems.length > 0 && (
        <div className="rounded-xl border border-gray-100 shadow-sm overflow-hidden bg-amber-50/50 px-4 py-3">
          <p className="text-xs text-amber-700 font-medium mb-2">Action Items ({actionItems.length}):</p>
          <div className="space-y-1.5">
            {actionItems.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm p-2 bg-white rounded border border-amber-100">
                <ListChecks className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-gray-800">{item.task}</p>
                  <div className="flex gap-2 mt-0.5 text-xs text-gray-400">
                    <span>Assignee: {item.assignee}</span>
                    <span>Due: {item.due}</span>
                    <span className={`font-medium ${item.priority === 'high' ? 'text-red-500' : item.priority === 'medium' ? 'text-amber-500' : 'text-gray-500'}`}>{item.priority}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setShowActionItems(false)} className="text-xs text-amber-600 hover:underline mt-2">Dismiss</button>
        </div>
      )}

      {/* Thread summary */}
      {showThreadSummary && threadSummary && (
        <div className="rounded-xl border border-gray-100 shadow-sm overflow-hidden bg-indigo-50/50 px-4 py-3">
          <p className="text-xs text-indigo-700 font-medium mb-2">Thread Summary:</p>
          <div className="prose prose-sm max-w-none text-gray-700 text-sm">
            {threadSummary.split('\n').map((line, i) => {
              if (line.startsWith('## ')) return <h3 key={i} className="font-bold text-gray-900 mt-3 mb-1 text-sm">{line.replace('## ', '')}</h3>;
              if (line.startsWith('- ')) return <li key={i} className="ml-4 text-sm mt-0.5">{line.slice(2)}</li>;
              if (line.trim() === '') return <br key={i} />;
              return <p key={i} className="text-sm mt-1">{line}</p>;
            })}
          </div>
          <button onClick={() => setShowThreadSummary(false)} className="text-xs text-indigo-600 hover:underline mt-2">Dismiss</button>
        </div>
      )}

      {/* Extracted contacts */}
      {showExtractedContacts && extractedContacts.length > 0 && (
        <div className="rounded-xl border border-gray-100 shadow-sm overflow-hidden bg-teal-50/50 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-teal-700 font-medium">Extracted Contacts ({extractedContacts.length}):</p>
            <button
              onClick={saveAllExtractedContacts}
              disabled={savingExtractedContacts.size > 0}
              className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 disabled:opacity-50 flex items-center gap-1.5 transition-colors shadow-sm"
            >
              {savingExtractedContacts.size > 0 ? <Loader2 className="w-3 h-3 animate-spin" /> : <Users className="w-3 h-3" />}
              Save All & Link to Topic
            </button>
          </div>
          <div className="space-y-1.5">
            {extractedContacts.map((c, i) => {
              const alreadyLinked = linkedContacts.some(lc => {
                if (lc.contacts?.email && c.email) {
                  return lc.contacts.email.toLowerCase() === c.email.toLowerCase();
                }
                // For contacts without email, match by name
                if (!c.email && lc.contacts?.name) {
                  return lc.contacts.name.toLowerCase() === c.name.toLowerCase();
                }
                return false;
              });
              const isSaving = savingExtractedContacts.has(i);
              return (
                <div key={i} className={`flex items-center gap-2 text-sm p-2.5 bg-white rounded-lg border ${alreadyLinked ? 'border-green-200 bg-green-50/30' : 'border-teal-100'} transition-all`}>
                  <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 font-medium truncate">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.email}{c.role ? ` \u00b7 ${c.role}` : ''}</p>
                  </div>
                  {alreadyLinked ? (
                    <span className="text-xs text-green-600 font-medium flex items-center gap-1 flex-shrink-0 bg-green-50 px-2 py-1 rounded-full">
                      <Check className="w-3 h-3" /> Linked
                    </span>
                  ) : (
                    <button
                      onClick={() => saveAndLinkExtractedContact(c, i)}
                      disabled={isSaving}
                      className="px-2.5 py-1.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg text-xs font-medium hover:bg-teal-100 hover:border-teal-300 disabled:opacity-50 flex items-center gap-1 transition-colors flex-shrink-0"
                    >
                      {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                      {isSaving ? 'Saving...' : 'Save & Link'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-3 mt-2">
            <button onClick={() => setShowExtractedContacts(false)} className="text-xs text-teal-600 hover:underline">Dismiss</button>
            <button onClick={() => { setActiveSection('contacts'); }} className="text-xs text-teal-600 hover:underline">Go to Contacts tab</button>
          </div>
        </div>
      )}

      {/* Deep Dive Report */}
      {showDeepDive && deepDiveReport && (
        <div className="rounded-xl border border-gray-100 shadow-sm overflow-hidden bg-gradient-to-r from-purple-50/50 to-pink-50/50 px-4 py-3">
          <p className="text-xs text-purple-700 font-medium mb-2 flex items-center gap-1">
            <Eye className="w-3 h-3" /> Deep Dive Report
          </p>
          <div className="prose prose-sm max-w-none text-gray-700 text-sm max-h-96 overflow-y-auto">
            {deepDiveReport.split('\n').map((line, i) => {
              if (line.startsWith('## ')) return <h3 key={i} className="font-bold text-gray-900 mt-3 mb-1 text-sm">{line.replace('## ', '')}</h3>;
              if (line.startsWith('# ')) return <h2 key={i} className="font-bold text-gray-900 mt-2 mb-1 text-base">{line.replace('# ', '')}</h2>;
              if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 text-sm mt-0.5">{line.slice(2)}</li>;
              if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold text-gray-800 mt-2">{line.replace(/\*\*/g, '')}</p>;
              if (line.trim() === '') return <br key={i} />;
              return <p key={i} className="text-sm mt-1">{line}</p>;
            })}
          </div>
          <button onClick={() => setShowDeepDive(false)} className="text-xs text-purple-600 hover:underline mt-2">Dismiss</button>
        </div>
      )}

      {/* Content Recommendations */}
      {showRecommendations && recommendations.length > 0 && (
        <div className="rounded-xl border border-gray-100 shadow-sm overflow-hidden bg-gradient-to-r from-blue-50/50 to-cyan-50/50 px-4 py-3">
          <p className="text-xs text-blue-700 font-medium mb-2 flex items-center gap-1">
            <Compass className="w-3 h-3" /> Content Recommendations
          </p>
          <div className="space-y-2">
            {recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2 p-2 bg-white rounded-lg border border-blue-100">
                <span className="mt-0.5"><SourceIcon source={rec.source} className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 font-medium">{rec.reason}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Search: <code className="bg-gray-100 px-1 rounded">{rec.query}</code></p>
                  <p className="text-xs text-blue-500 mt-0.5">{rec.expected_type}</p>
                </div>
                <button onClick={() => { setSearchQuery(rec.query); setActiveSection('search'); }}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex-shrink-0">
                  Search
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => setShowRecommendations(false)} className="text-xs text-blue-600 hover:underline mt-2">Dismiss</button>
        </div>
      )}

      {/* Extracted Entities */}
      {showEntities && entities && (
        <div className="rounded-xl border border-gray-100 shadow-sm overflow-hidden bg-gradient-to-r from-emerald-50/50 to-green-50/50 px-4 py-3">
          <p className="text-xs text-emerald-700 font-medium mb-2 flex items-center gap-1">
            <Target className="w-3 h-3" /> Extracted Entities
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {(entities.people as Array<{name: string; email: string; role: string; mention_count: number}>)?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">People</p>
                {(entities.people as Array<{name: string; email: string; role: string; mention_count: number}>).slice(0, 8).map((p, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs p-1">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold">{p.name.charAt(0)}</span>
                    <span className="font-medium">{p.name}</span>
                    {p.role && <span className="text-gray-400">({p.role})</span>}
                  </div>
                ))}
              </div>
            )}
            {(entities.action_items as Array<{task: string; assignee: string; due: string; status: string}>)?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Action Items</p>
                {(entities.action_items as Array<{task: string; assignee: string; due: string; status: string}>).slice(0, 6).map((a, i) => (
                  <div key={i} className="text-xs p-1 flex items-start gap-1">
                    <ListChecks className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span>{a.task} {a.assignee !== 'unknown' && <span className="text-gray-400">&rarr; {a.assignee}</span>}</span>
                  </div>
                ))}
              </div>
            )}
            {(entities.dates as Array<{date: string; description: string; type: string}>)?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Key Dates</p>
                {(entities.dates as Array<{date: string; description: string; type: string}>).slice(0, 5).map((d, i) => (
                  <div key={i} className="text-xs p-1 flex items-start gap-1">
                    <Clock className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span>{d.date}: {d.description}</span>
                  </div>
                ))}
              </div>
            )}
            {(entities.amounts as Array<{value: string; currency: string; context: string}>)?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Amounts</p>
                {(entities.amounts as Array<{value: string; currency: string; context: string}>).slice(0, 5).map((a, i) => (
                  <div key={i} className="text-xs p-1">💰 {a.value} {a.currency} — {a.context}</div>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setShowEntities(false)} className="text-xs text-emerald-600 hover:underline mt-2">Dismiss</button>
        </div>
      )}

      {/* Related Topics */}
      {showRelatedTopics && relatedTopics.length > 0 && (
        <div className="rounded-xl border border-gray-100 shadow-sm overflow-hidden bg-gradient-to-r from-orange-50/50 to-amber-50/50 px-4 py-3">
          <p className="text-xs text-orange-700 font-medium mb-2 flex items-center gap-1">
            <GitBranch className="w-3 h-3" /> Related Topics
          </p>
          <div className="space-y-1.5">
            {relatedTopics.map((rt, i) => (
              <Link key={i} href={`/topics/${rt.topic_id}`}
                className="flex items-center gap-2 p-2 bg-white rounded-lg border border-orange-100 hover:border-orange-300 transition-colors">
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  rt.relationship === 'parent' ? 'bg-blue-100 text-blue-700' :
                  rt.relationship === 'child' ? 'bg-green-100 text-green-700' :
                  rt.relationship === 'dependent' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{rt.relationship}</span>
                <span className="text-sm font-medium text-gray-800 flex-1">{rt.title}</span>
                <span className="text-xs text-orange-500">{Math.round(rt.confidence * 100)}%</span>
              </Link>
            ))}
          </div>
          <button onClick={() => setShowRelatedTopics(false)} className="text-xs text-orange-600 hover:underline mt-2">Dismiss</button>
        </div>
      )}

      {/* Completeness Check */}
      {showCompleteness && completenessScore && (
        <div className="rounded-xl border border-gray-100 shadow-sm overflow-hidden bg-gradient-to-r from-rose-50/50 to-pink-50/50 px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative w-14 h-14">
              <svg className="w-14 h-14 transform -rotate-90">
                <circle cx="28" cy="28" r="24" stroke="#e5e7eb" strokeWidth="4" fill="none" />
                <circle cx="28" cy="28" r="24" stroke={(completenessScore.score as number) >= 80 ? '#22c55e' : (completenessScore.score as number) >= 50 ? '#f59e0b' : '#ef4444'} strokeWidth="4" fill="none"
                  strokeDasharray={`${(completenessScore.score as number) * 1.508} 150.8`} strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{completenessScore.score as number}%</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Topic Completeness</p>
              <p className="text-xs text-gray-500">{String((completenessScore.stats as Record<string, unknown>)?.item_count || 0)} items, {String((completenessScore.stats as Record<string, unknown>)?.source_count || 0)} sources</p>
            </div>
          </div>
          {(completenessScore.suggestions as string[])?.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-medium text-rose-600 mb-1">Suggestions</p>
              {(completenessScore.suggestions as string[]).map((s, i) => (
                <p key={i} className="text-xs text-gray-600 flex items-start gap-1 mt-0.5"><ArrowRight className="w-3 h-3 text-rose-400 mt-0.5 flex-shrink-0" />{s}</p>
              ))}
            </div>
          )}
          {(completenessScore.strengths as string[])?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-green-600 mb-1">Strengths</p>
              {(completenessScore.strengths as string[]).map((s, i) => (
                <p key={i} className="text-xs text-gray-600 flex items-start gap-1 mt-0.5"><span className="text-green-500">&#10003;</span> {s}</p>
              ))}
            </div>
          )}
          <button onClick={() => setShowCompleteness(false)} className="text-xs text-rose-600 hover:underline mt-2">Dismiss</button>
        </div>
      )}

      {/* Note Editor Dialog */}
      {(showNoteEditor || editingNote) && (
        <NoteEditor
          topicId={topic.id}
          note={editingNote as any || undefined}
          onSave={(item) => {
            const fullItem = item as unknown as TopicItem;
            if (editingNote) {
              setItems(prev => prev.map(i => i.id === fullItem.id ? fullItem : i));
            } else {
              setItems(prev => [fullItem, ...prev]);
            }
            setShowNoteEditor(false);
            setEditingNote(null);
          }}
          onClose={() => { setShowNoteEditor(false); setEditingNote(null); }}
        />
      )}
    </div>
  );
}
