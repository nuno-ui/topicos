import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface ImportedContact {
  name: string;
  email?: string;
  organization?: string;
  role?: string;
  phone?: string;
  notes?: string;
}

function parseCSV(text: string): ImportedContact[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
  const contacts: ImportedContact[] = [];

  // Map common header names
  const findCol = (names: string[]) => headers.findIndex(h => names.some(n => h.includes(n)));
  const nameCol = findCol(['name', 'full name', 'contact']);
  const emailCol = findCol(['email', 'e-mail', 'mail']);
  const orgCol = findCol(['organization', 'company', 'org', 'employer']);
  const roleCol = findCol(['role', 'title', 'job title', 'position']);
  const phoneCol = findCol(['phone', 'tel', 'mobile', 'cell']);
  const notesCol = findCol(['notes', 'note', 'comment']);

  if (nameCol === -1 && emailCol === -1) return [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parsing (handles quoted fields)
    const cols: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === ',' && !inQuotes) { cols.push(current.trim()); current = ''; continue; }
      current += char;
    }
    cols.push(current.trim());

    const name = nameCol >= 0 ? cols[nameCol] : '';
    const email = emailCol >= 0 ? cols[emailCol] : '';
    if (!name && !email) continue;

    contacts.push({
      name: name || email?.split('@')[0] || 'Unknown',
      email: email || undefined,
      organization: orgCol >= 0 ? cols[orgCol] || undefined : undefined,
      role: roleCol >= 0 ? cols[roleCol] || undefined : undefined,
      phone: phoneCol >= 0 ? cols[phoneCol] || undefined : undefined,
      notes: notesCol >= 0 ? cols[notesCol] || undefined : undefined,
    });
  }

  return contacts;
}

function parseVCard(text: string): ImportedContact[] {
  const cards = text.split('BEGIN:VCARD');
  const contacts: ImportedContact[] = [];

  for (const card of cards) {
    if (!card.trim()) continue;

    const getField = (prefix: string): string => {
      const match = card.match(new RegExp(`${prefix}[^:]*:(.+)`, 'i'));
      return match ? match[1].trim() : '';
    };

    const name = getField('FN') || getField('N').split(';').filter(Boolean).reverse().join(' ');
    if (!name) continue;

    contacts.push({
      name,
      email: getField('EMAIL') || undefined,
      organization: getField('ORG').replace(/;/g, ' ').trim() || undefined,
      role: getField('TITLE') || undefined,
      phone: getField('TEL') || undefined,
    });
  }

  return contacts;
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { content, format, contacts: directContacts } = body;

  let parsedContacts: ImportedContact[] = [];

  if (directContacts && Array.isArray(directContacts)) {
    // Direct contact array (from preview → confirm flow)
    parsedContacts = directContacts;
  } else if (content && format) {
    // Parse from file content
    if (format === 'csv') {
      parsedContacts = parseCSV(content);
    } else if (format === 'vcf' || format === 'vcard') {
      parsedContacts = parseVCard(content);
    } else {
      return NextResponse.json({ error: 'Unsupported format. Use csv or vcf.' }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: 'Provide either content+format or contacts array' }, { status: 400 });
  }

  if (parsedContacts.length === 0) {
    return NextResponse.json({ error: 'No valid contacts found in the provided data' }, { status: 400 });
  }

  // Preview mode: return parsed contacts without importing
  if (body.preview) {
    return NextResponse.json({ contacts: parsedContacts, count: parsedContacts.length });
  }

  // Import contacts
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const c of parsedContacts) {
    const metadata: Record<string, unknown> = {};
    if (c.phone) metadata.phone = c.phone;

    const { data, error } = await supabase.from('contacts').upsert({
      user_id: user.id,
      name: c.name,
      email: c.email || null,
      organization: c.organization || null,
      role: c.role || null,
      notes: c.notes || null,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    }, { onConflict: 'user_id, email' }).select().single();

    if (error) {
      skipped++;
    } else if (data) {
      // Determine if created or updated based on created_at timestamp
      const isNew = new Date(data.created_at).getTime() > Date.now() - 5000;
      if (isNew) created++;
      else updated++;
    }
  }

  return NextResponse.json({ created, updated, skipped, total: parsedContacts.length });
}
