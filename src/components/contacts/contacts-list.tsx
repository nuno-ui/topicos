'use client';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Plus, X, Users, Mail, Building, StickyNote, ChevronRight, Loader2, Search, Edit3, Save, Trash2, Sparkles, Brain, UserPlus, Network, Wand2, ExternalLink, Clock, TrendingUp, Activity } from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  email: string | null;
  organization: string | null;
  role: string | null;
  notes: string | null;
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

export function ContactsList({ initialContacts }: { initialContacts: Contact[] }) {
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
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingContact, setEditingContact] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editOrganization, setEditOrganization] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // AI Agent state
  const [agentLoading, setAgentLoading] = useState<string | null>(null);
  const [enrichedProfile, setEnrichedProfile] = useState<EnrichedProfile | null>(null);
  const [enrichedContactId, setEnrichedContactId] = useState<string | null>(null);
  const [extractedContacts, setExtractedContacts] = useState<ExtractedContact[]>([]);
  const [showExtracted, setShowExtracted] = useState(false);
  const [dedupeResults, setDedupeResults] = useState<string | null>(null);
  const [showDedupe, setShowDedupe] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error('Name is required'); return; }
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setContacts(prev => [...prev, data.contact].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName(''); setNewEmail(''); setNewOrganization(''); setNewRole(''); setNewNotes('');
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
    setSelectedContact(c.id);
  };

  const saveEdit = async (contactId: string) => {
    if (!editName.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim() || null,
          organization: editOrganization.trim() || null,
          role: editRole.trim() || null,
          notes: editNotes.trim() || null,
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

  // Calculate interaction score based on topic links
  const getInteractionScore = (c: Contact) => {
    const topicCount = c.contact_topic_links?.length || 0;
    if (topicCount >= 5) return { label: 'Very Active', color: 'text-green-600 bg-green-50', score: 5 };
    if (topicCount >= 3) return { label: 'Active', color: 'text-blue-600 bg-blue-50', score: 3 };
    if (topicCount >= 1) return { label: 'Connected', color: 'text-amber-600 bg-amber-50', score: 1 };
    return { label: 'New', color: 'text-gray-500 bg-gray-50', score: 0 };
  };

  const initials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.organization || '').toLowerCase().includes(q) ||
      (c.role || '').toLowerCase().includes(q)
    );
  }, [contacts, searchQuery]);

  // Organization grouping for count
  const orgCounts = useMemo(() => {
    return contacts.reduce((acc, c) => {
      if (c.organization) {
        acc[c.organization] = (acc[c.organization] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
  }, [contacts]);

  const avatarColors = ['bg-blue-100 text-blue-700', 'bg-green-100 text-green-700', 'bg-purple-100 text-purple-700', 'bg-amber-100 text-amber-700', 'bg-pink-100 text-pink-700', 'bg-cyan-100 text-cyan-700'];
  const getAvatarColor = (name: string) => {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return avatarColors[hash % avatarColors.length];
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
      // Update the contact in the local state
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
      // First get topics
      const topicsRes = await fetch('/api/topics');
      const topicsData = await topicsRes.json();
      const topics = topicsData.topics || [];
      if (topics.length === 0) {
        toast.error('No topics found - create topics with linked items first');
        setAgentLoading(null);
        return;
      }
      // Extract from first topic that has items (could iterate more)
      const allExtracted: ExtractedContact[] = [];
      for (const topic of topics.slice(0, 3)) {
        try {
          const res = await fetch('/api/ai/agents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agent: 'find_contacts', context: { topic_id: topic.id } }),
          });
          const data = await res.json();
          if (res.ok && data.result.contacts) {
            allExtracted.push(...data.result.contacts);
          }
        } catch { /* skip failed topics */ }
      }
      // Deduplicate by email
      const seen = new Set<string>();
      const unique = allExtracted.filter(c => {
        const key = c.email?.toLowerCase() || c.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        // Also filter out contacts we already have
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

  return (
    <div>
      {/* Search + Actions */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search contacts..."
            className="w-full pl-10 pr-8 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 transition-colors flex-shrink-0">
          {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showCreate ? 'Cancel' : 'Add Contact'}
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-4 mb-4 text-xs text-gray-500">
        <span>{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</span>
        {Object.keys(orgCounts).length > 0 && (
          <span>{Object.keys(orgCounts).length} organization{Object.keys(orgCounts).length !== 1 ? 's' : ''}</span>
        )}
      </div>

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
                <div className={`w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center ${getAvatarColor(ec.name)}`}>
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

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 p-4 bg-white rounded-xl border border-blue-200 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Add New Contact</h3>
          <div className="grid grid-cols-2 gap-3">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name *"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
            <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email"
              className="px-3 py-2 border rounded-lg text-sm" type="email" />
            <input value={newOrganization} onChange={e => setNewOrganization(e.target.value)} placeholder="Organization"
              className="px-3 py-2 border rounded-lg text-sm" />
            <input value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="Role"
              className="px-3 py-2 border rounded-lg text-sm" />
          </div>
          <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Notes (optional)"
            className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
          <button onClick={handleCreate} disabled={creating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Contact
          </button>
        </div>
      )}

      {/* Contact list */}
      {filteredContacts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
          <Users className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{searchQuery ? `No contacts match "${searchQuery}"` : 'No contacts yet'}</p>
          <p className="text-gray-400 text-xs mt-1">Contacts will be auto-extracted when you link items to topics, or add them manually.</p>
          {!searchQuery && (
            <div className="flex gap-3 justify-center mt-4">
              <button onClick={() => setShowCreate(true)}
                className="text-blue-600 hover:underline text-sm">Add your first contact &rarr;</button>
              <button onClick={runExtractContacts} disabled={!!agentLoading}
                className="text-purple-600 hover:underline text-sm flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Auto-extract from topics
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredContacts.map((c) => (
            <div key={c.id}>
              <button
                onClick={() => setSelectedContact(selectedContact === c.id ? null : c.id)}
                className="w-full p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all shadow-sm text-left"
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full font-medium text-sm flex items-center justify-center flex-shrink-0 ${getAvatarColor(c.name)}`}>
                    {initials(c.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{c.name}</p>
                    <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                      {c.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {c.email}
                        </span>
                      )}
                      {c.organization && (
                        <span className="flex items-center gap-1">
                          <Building className="w-3 h-3" /> {c.organization}
                        </span>
                      )}
                      {c.role && (
                        <span className="text-gray-400">{c.role}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.contact_topic_links && c.contact_topic_links.length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                        {c.contact_topic_links.length} topic{c.contact_topic_links.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()}
                        className="p-1 text-gray-300 hover:text-green-600 hover:bg-green-50 rounded transition-colors" title="Send email">
                        <Mail className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${selectedContact === c.id ? 'rotate-90' : ''}`} />
                  </div>
                </div>
              </button>

              {/* Expanded detail */}
              {selectedContact === c.id && (
                <div className="mt-1 ml-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
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
                        {(() => {
                          const interaction = getInteractionScore(c);
                          return (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${interaction.color}`}>
                              <Activity className="w-3 h-3 inline mr-0.5" />
                              {interaction.label}
                            </span>
                          );
                        })()}
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
          ))}
        </div>
      )}
    </div>
  );
}
