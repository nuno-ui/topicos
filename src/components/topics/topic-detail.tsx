'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { sourceLabel, formatRelativeDate, sourceBorderClass, sourceIconBgClass, formatSmartDate, AREA_COLORS } from '@/lib/utils';
import { SourceIcon } from '@/components/ui/source-icon';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NoteEditor } from './note-editor';
import { NoteCard } from './note-card';
import { Search, Sparkles, Link2, Unlink, ExternalLink, ChevronDown, ChevronUp, Edit3, Archive, Trash2, Save, X, Bot, RefreshCw, StickyNote, Loader2, CheckSquare, Square, MessageSquare, Tag, Wand2, ListChecks, Users, Clock, FileText, Brain, Zap, Heart, AlertTriangle, TrendingUp, Eye, EyeOff, Pin, ArrowUp, ArrowDown, ArrowRight, ArrowLeft, Layers, GitBranch, Compass, Award, Target, MoreHorizontal, ChevronRight, Info, Calendar, FolderOpen, Check, CircleDot } from 'lucide-react';

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
  stakeholders: string[];
  progress_percent: number | null;
  risk_level: string | null;
  client: string | null;
  company: string | null;
  goal: string | null;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

const SOURCES = ['gmail', 'calendar', 'drive', 'slack', 'notion', 'manual', 'link'] as const;

export function TopicDetail({ topic: initialTopic, initialItems }: { topic: Topic; initialItems: TopicItem[] }) {
  const router = useRouter();
  const [topic, setTopic] = useState(initialTopic);
  const [items, setItems] = useState(initialItems);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchSources, setSearchSources] = useState<Set<string>>(new Set(SOURCES));

  // AI Find state
  const [aiFindLoading, setAiFindLoading] = useState(false);
  const [aiFindResults, setAiFindResults] = useState<SearchResult[]>([]);
  const [selectedAiResults, setSelectedAiResults] = useState<Set<string>>(new Set());
  const [showAiResults, setShowAiResults] = useState(false);

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
  const [editOwner, setEditOwner] = useState(topic.owner || '');
  const [editGoal, setEditGoal] = useState(topic.goal || '');

  // Folders for folder picker
  const [folders, setFolders] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    fetch('/api/folders').then(r => r.json()).then(d => setFolders(d.folders || [])).catch(() => {});
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

  // Note editor state
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [editingNote, setEditingNote] = useState<Record<string, unknown> | null>(null);

  // Link form state
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkSaving, setLinkSaving] = useState(false);
  const [itemsRefreshing, setItemsRefreshing] = useState(false);

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
  const [showInfoDashboard, setShowInfoDashboard] = useState(false);
  const [showAgentMenu, setShowAgentMenu] = useState(false);

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
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchResults([]);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          sources: Array.from(searchSources),
          topic_id: topic.id,
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
      setSelectedResults(new Set());
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
      // Enrich first (fetches full content from Notion, Gmail, etc.)
      fetch(`/api/topics/${topic.id}/enrich`, { method: 'POST' })
        .catch(() => { /* non-blocking */ })
        .then(() => fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic_id: topic.id }),
        }))
        .then(async (res) => {
          if (res && res.ok) {
            const data = await res.json();
            setAnalysis(data.analysis);
            setShowAnalysis(true);
          }
        })
        .catch(() => { /* silent — user can manually refresh */ })
        .finally(() => setAnalysisLoading(false));
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
          due_date: editDueDate || null,
          start_date: editStartDate || null,
          priority: editPriority,
          tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
          progress_percent: editProgress,
          folder_id: editFolderId || null,
          owner: editOwner.trim() || null,
          goal: editGoal.trim() || null,
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

  // Helper: check if item was added in last 24 hours
  const isNewItem = (occurredAt: string) => {
    return (Date.now() - new Date(occurredAt).getTime()) < 24 * 60 * 60 * 1000;
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
      {/* Header with gradient strip */}
      <div className="topic-header-strip -mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 md:px-8 pt-5 pb-6 mb-2 rounded-b-2xl relative overflow-hidden">
        {/* Decorative dots */}
        <div className="absolute inset-0 dot-pattern opacity-30 pointer-events-none" />
        <div className="relative">
          {/* Breadcrumb */}
          <nav className="mb-4 inline-flex items-center gap-1.5 text-xs">
            <Link href="/topics" className="text-gray-400 hover:text-blue-600 inline-flex items-center gap-1 transition-all duration-200 group">
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span className="group-hover:underline underline-offset-2">Topics</span>
            </Link>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <Link href="/topics" className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
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
                    <input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                  </div>
                  {/* Dates row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                      <input type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
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
                      <select value={editFolderId} onChange={e => setEditFolderId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        <option value="">No folder</option>
                        {folders.map(f => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Owner</label>
                      <input value={editOwner} onChange={e => setEditOwner(e.target.value)}
                        placeholder="e.g. John Doe"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/80" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Goal</label>
                      <input value={editGoal} onChange={e => setEditGoal(e.target.value)}
                        placeholder="e.g. Launch by Q2"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/80" />
                    </div>
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

                  {/* Progress visualization (if progress_percent is set) */}
                  {topic.progress_percent != null && topic.progress_percent > 0 && (
                    <div className="mt-4 flex items-center gap-4 max-w-lg">
                      {/* Progress ring */}
                      <div className="relative flex-shrink-0">
                        <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
                          <circle cx="28" cy="28" r="24" fill="none" stroke="#e5e7eb" strokeWidth="5" />
                          <circle
                            cx="28" cy="28" r="24" fill="none"
                            strokeWidth="5"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 24}`}
                            strokeDashoffset={`${2 * Math.PI * 24 * (1 - topic.progress_percent / 100)}`}
                            stroke={`url(#progress-gradient-${topic.id})`}
                            className="transition-all duration-500"
                          />
                          <defs>
                            <linearGradient id={`progress-gradient-${topic.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#3b82f6" />
                              <stop offset="100%" stopColor={topic.progress_percent >= 80 ? '#22c55e' : topic.progress_percent >= 50 ? '#06b6d4' : '#3b82f6'} />
                            </linearGradient>
                          </defs>
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">
                          {topic.progress_percent}%
                        </span>
                      </div>
                      {/* Progress bar alongside */}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-500">Progress</span>
                          <span className={`text-xs font-semibold ${
                            topic.progress_percent >= 100 ? 'text-green-600' : topic.progress_percent >= 60 ? 'text-blue-600' : 'text-amber-600'
                          }`}>
                            {topic.progress_percent >= 100 ? 'Complete' : topic.progress_percent >= 75 ? 'Almost there' : topic.progress_percent >= 50 ? 'Halfway' : 'In progress'}
                          </span>
                        </div>
                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(topic.progress_percent, 100)}%`,
                              background: `linear-gradient(90deg, #3b82f6 0%, ${topic.progress_percent >= 80 ? '#22c55e' : topic.progress_percent >= 50 ? '#06b6d4' : '#3b82f6'} 100%)`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Compact dates row */}
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
                  </div>
                </>
              )}
            </div>
            {!editing && (
              <div className="flex gap-1 items-center flex-shrink-0">
                <button onClick={() => { setEditing(true); setEditTitle(topic.title); setEditDescription(topic.description || ''); setEditArea(topic.area); setEditStatus(topic.status); setEditDueDate(topic.due_date || ''); setEditPriority(topic.priority ?? 0); setEditTags(topic.tags?.join(', ') || ''); setEditStartDate(topic.start_date || ''); setEditProgress(topic.progress_percent ?? 0); setEditFolderId(topic.folder_id || ''); setEditOwner(topic.owner || ''); setEditGoal(topic.goal || ''); }}
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
        {topic.goal && (
          <div className="flex items-start gap-2.5 p-3 bg-blue-50/50 rounded-lg border border-blue-100/50">
            <Target className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-700"><span className="font-semibold text-gray-800">Goal:</span> {topic.goal}</p>
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

      {/* Topic Info Dashboard - collapsible */}
      <button onClick={() => setShowInfoDashboard(!showInfoDashboard)}
        className="w-full flex items-center justify-between px-5 py-3 bg-white rounded-xl border border-gray-100 shadow-sm hover:bg-gray-50/50 hover:shadow-md transition-all">
        <div className="flex items-center gap-2.5 text-sm font-medium text-gray-600">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
            <Info className="w-3.5 h-3.5 text-blue-600" />
          </span>
          Topic Details
          <span className="text-xs text-gray-400 font-normal">
            {items.length} items &middot; {Object.keys(sourceCounts).length} sources
          </span>
        </div>
        {showInfoDashboard ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {showInfoDashboard && <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-slide-up">
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
            const bg = score >= 80 ? 'bg-green-50' : score >= 50 ? 'bg-amber-50' : 'bg-red-50';
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
      </div>}

      {/* Search Panel */}
      <div id="section-search" className="scroll-mt-8 bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover-lift">
        <button onClick={() => setShowSearch(!showSearch)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/80 transition-colors">
          <div className="flex items-center gap-2.5 text-sm font-medium text-gray-700">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Search className="w-3.5 h-3.5 text-white" />
            </span>
            Search &amp; Link Content
          </div>
          {showSearch ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {showSearch && (
          <div className="px-5 pb-5 space-y-3 border-t border-gray-100">
            <div className="flex gap-2 mt-3">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Search emails, messages, events, files..."
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              <button onClick={handleSearch} disabled={searchLoading}
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
            {/* Source filter pills */}
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
            </div>
          </div>
        )}
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
                    <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{item.snippet}</p>
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
                      <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{item.snippet}</p>
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

      {/* Linked Items */}
      <div id="section-items" className="scroll-mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
              <Layers className="w-3.5 h-3.5 text-white" />
            </span>
            Linked Items
            <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{items.length}</span>
          </h2>
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
              <button onClick={() => setShowSearch(true)}
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
                          {item.title}
                        </a>
                        {/* New badge for items added in last 24h */}
                        {isNewItem(item.occurred_at) && (
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
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{item.snippet}</p>
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

      {/* AI Analysis */}
      <div id="section-analysis" className="scroll-mt-8 rounded-xl border border-gray-100 shadow-sm overflow-hidden hover-lift bg-gradient-to-br from-white via-white to-purple-50/20">
        <button onClick={() => { setShowAnalysis(!showAnalysis); if (!showAnalysis) setTimeout(() => document.getElementById('section-analysis')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }}
          className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-gray-50/50 transition-colors bg-gradient-to-r from-purple-50/30 to-blue-50/30">
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
          <div className="flex items-center gap-2">
            <span onClick={(e) => { e.stopPropagation(); runAnalysis(); }}
              className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg text-xs font-medium hover:from-purple-600 hover:to-blue-600 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm">
              {analysisLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {analysis ? 'Refresh' : 'Run'}
            </span>
            {showAnalysis ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </button>
        {showAnalysis && (
        <div className="px-5 py-5 border-t border-purple-100/50">
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
            <div className="ai-glass-card rounded-xl p-5">
              <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
                {analysis.split('\n').map((line, i) => {
                  if (line.startsWith('## ')) {
                    return <h3 key={i} className="font-bold text-gray-900 mt-5 mb-2 text-base border-b border-purple-100/50 pb-1.5">{line.replace('## ', '')}</h3>;
                  }
                  if (line.startsWith('# ')) {
                    return <h2 key={i} className="font-bold text-gray-900 mt-4 mb-2 text-lg">{line.replace('# ', '')}</h2>;
                  }
                  if (line.startsWith('- ') || line.startsWith('* ')) {
                    return <li key={i} className="ml-4 text-sm text-gray-700 mt-1 leading-relaxed">{line.slice(2)}</li>;
                  }
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return <p key={i} className="font-semibold text-gray-800 mt-3">{line.replace(/\*\*/g, '')}</p>;
                  }
                  if (line.trim() === '') return <br key={i} />;
                  return <p key={i} className="text-sm text-gray-700 mt-1.5 leading-relaxed">{line}</p>;
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center mx-auto mb-3">
                <Brain className="w-7 h-7 text-purple-400" />
              </div>
              <p className="text-sm text-gray-500 font-medium">
                {items.length > 0
                  ? 'Click "Run" to get AI-powered insights'
                  : 'Link some items first, then run AI analysis'}
              </p>
              <p className="text-xs text-gray-400 mt-1">Powered by AI topic intelligence</p>
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
        )}
      </div>

      {/* AI Agents */}
      <div id="section-agents" className="scroll-mt-8 rounded-xl border border-gray-100 shadow-sm overflow-hidden hover-lift bg-gradient-to-br from-white via-white to-blue-50/20">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50/40 to-purple-50/40">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </span>
            AI Agents
            {agentLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />}
            {agentSuccess && !agentLoading && (
              <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium animate-fade-in">
                <Check className="w-3.5 h-3.5" /> Done
              </span>
            )}
          </h2>
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

        {/* Title suggestions */}
        {showTitleSuggestions && titleSuggestions.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-100 bg-purple-50/50">
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
          <div className="px-4 py-3 border-b border-gray-100 bg-amber-50/50">
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
          <div className="px-4 py-3 border-b border-gray-100 bg-indigo-50/50">
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
          <div className="px-4 py-3 bg-teal-50/50">
            <p className="text-xs text-teal-700 font-medium mb-2">Extracted Contacts ({extractedContacts.length}):</p>
            <div className="space-y-1.5">
              {extractedContacts.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-sm p-2 bg-white rounded border border-teal-100">
                  <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-medium flex-shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 font-medium truncate">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.email} &bull; {c.role}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowExtractedContacts(false)} className="text-xs text-teal-600 hover:underline mt-2">Dismiss</button>
          </div>
        )}

        {/* Deep Dive Report */}
        {showDeepDive && deepDiveReport && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gradient-to-r from-purple-50/50 to-pink-50/50">
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
          <div className="px-4 py-3 border-t border-gray-100 bg-gradient-to-r from-blue-50/50 to-cyan-50/50">
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
                  <button onClick={() => { setSearchQuery(rec.query); setShowSearch(true); }}
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
          <div className="px-4 py-3 border-t border-gray-100 bg-gradient-to-r from-emerald-50/50 to-green-50/50">
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
                      <span>{a.task} {a.assignee !== 'unknown' && <span className="text-gray-400">→ {a.assignee}</span>}</span>
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
          <div className="px-4 py-3 border-t border-gray-100 bg-gradient-to-r from-orange-50/50 to-amber-50/50">
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
          <div className="px-4 py-3 border-t border-gray-100 bg-gradient-to-r from-rose-50/50 to-pink-50/50">
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
                  <p key={i} className="text-xs text-gray-600 flex items-start gap-1 mt-0.5"><span className="text-green-500">✓</span> {s}</p>
                ))}
              </div>
            )}
            <button onClick={() => setShowCompleteness(false)} className="text-xs text-rose-600 hover:underline mt-2">Dismiss</button>
          </div>
        )}
      </div>

      {/* Notes */}
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

      {/* Activity Feed */}
      <div id="section-activity" className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover-lift">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            Activity
          </h2>
        </div>
        <div className="p-5">
          <div className="relative pl-6 space-y-4">
            {/* Created */}
            <div className="relative">
              <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-blue-400 ring-2 ring-white" />
              <div className="absolute -left-[18px] top-4 w-0.5 h-full bg-gray-200" />
              <p className="text-xs font-medium text-gray-700">Topic created</p>
              <p className="text-[11px] text-gray-400">{formatSmartDate(topic.created_at)}</p>
            </div>
            {/* Last updated */}
            {topic.updated_at !== topic.created_at && (
              <div className="relative">
                <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-green-400 ring-2 ring-white" />
                <div className="absolute -left-[18px] top-4 w-0.5 h-full bg-gray-200" />
                <p className="text-xs font-medium text-gray-700">Last updated</p>
                <p className="text-[11px] text-gray-400">{formatSmartDate(topic.updated_at)}</p>
              </div>
            )}
            {/* Linked items count */}
            <div className="relative">
              <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-purple-400 ring-2 ring-white" />
              <div className="absolute -left-[18px] top-4 w-0.5 h-full bg-gray-200" />
              <p className="text-xs font-medium text-gray-700">{items.length} linked item{items.length !== 1 ? 's' : ''}</p>
              <p className="text-[11px] text-gray-400">
                {Object.entries(sourceCounts).map(([src, count]) => `${count} ${sourceLabel(src).toLowerCase()}`).join(', ') || 'No items yet'}
              </p>
            </div>
            {/* Linked contacts count */}
            <div className="relative">
              <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-teal-400 ring-2 ring-white" />
              <p className="text-xs font-medium text-gray-700">
                {(() => {
                  const contactNames = new Set<string>();
                  items.forEach(item => {
                    const from = item.metadata?.from;
                    if (from && typeof from === 'string') {
                      contactNames.add(from.split('<')[0].trim().toLowerCase());
                    }
                  });
                  (topic.stakeholders || []).forEach(s => contactNames.add(s.toLowerCase()));
                  if (topic.owner) contactNames.add(topic.owner.toLowerCase());
                  return `${contactNames.size} linked contact${contactNames.size !== 1 ? 's' : ''}`;
                })()}
              </p>
              <p className="text-[11px] text-gray-400">From communications and stakeholders</p>
            </div>
          </div>
        </div>
      </div>

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
