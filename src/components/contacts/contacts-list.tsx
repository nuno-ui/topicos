'use client';
import { useState } from 'react';

interface Contact { id: string; name: string; email: string | null; notes: string | null; }

export function ContactsList({ initialContacts }: { initialContacts: Contact[] }) {
  const [contacts] = useState(initialContacts);
  return (
    <div className="space-y-2">
      {contacts.length === 0 && <p className="text-gray-500 py-8 text-center">No contacts yet</p>}
      {contacts.map((c) => (
        <div key={c.id} className="p-3 bg-white rounded-lg border">
          <p className="font-medium">{c.name}</p>
          {c.email && <p className="text-sm text-gray-500">{c.email}</p>}
          {c.notes && <p className="text-sm text-gray-400">{c.notes}</p>}
        </div>
      ))}
    </div>
  );
}
