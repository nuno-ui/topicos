'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, X, Users, Mail, Building, StickyNote, ChevronRight, Loader2 } from 'lucide-react';

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

export function ContactsList({ initialContacts }: { initialContacts: Contact[] }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newOrganization, setNewOrganization] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [creating, setCreating] = useState(false);

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

  const initials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div>
      {/* Actions */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
          {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showCreate ? 'Cancel' : 'Add Contact'}
        </button>
        <span className="text-sm text-gray-500">{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name *"
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
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Contact
          </button>
        </div>
      )}

      {/* Contact list */}
      {contacts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <Users className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No contacts yet</p>
          <p className="text-gray-400 text-xs mt-1">Contacts will be auto-extracted when you link items to topics, or add them manually.</p>
          <button onClick={() => setShowCreate(true)}
            className="mt-3 text-blue-600 hover:underline text-sm">Add your first contact &rarr;</button>
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <div key={c.id}>
              <button
                onClick={() => setSelectedContact(selectedContact === c.id ? null : c.id)}
                className="w-full p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-medium text-sm flex items-center justify-center flex-shrink-0">
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
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${selectedContact === c.id ? 'rotate-90' : ''}`} />
                </div>
              </button>

              {/* Expanded detail */}
              {selectedContact === c.id && (
                <div className="ml-13 mt-1 p-4 bg-gray-50 rounded-lg border border-gray-200">
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
                            className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100">
                            {link.topics?.title || 'Unknown'}
                            {link.role && ` (${link.role})`}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {!c.notes && (!c.contact_topic_links || c.contact_topic_links.length === 0) && (
                    <p className="text-xs text-gray-400">No additional details. Link items to topics involving this contact to see more.</p>
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
