import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', user.id)
    .order('position', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ folders: data });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { name, parent_id, color, icon, area } = body;
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  // Validate area if provided
  if (area && !['work', 'personal', 'career'].includes(area)) {
    return NextResponse.json({ error: 'Area must be work, personal, or career' }, { status: 400 });
  }

  // Validate nesting depth (max 5 levels)
  if (parent_id) {
    let depth = 1;
    let currentId = parent_id;
    while (currentId && depth < 6) {
      const { data: parent } = await supabase
        .from('folders')
        .select('parent_id')
        .eq('id', currentId)
        .single();
      if (!parent || !parent.parent_id) break;
      currentId = parent.parent_id;
      depth++;
    }
    if (depth >= 5) {
      return NextResponse.json({ error: 'Maximum folder depth (5 levels) reached' }, { status: 400 });
    }
  }

  // NOTE: The 'area' column requires a database migration:
  // ALTER TABLE folders ADD COLUMN IF NOT EXISTS area text CHECK (area IN ('work', 'personal', 'career'));
  const insertData: Record<string, unknown> = {
    name,
    parent_id: parent_id || null,
    color: color || null,
    icon: icon || null,
    user_id: user.id,
  };
  if (area) insertData.area = area;

  let { data, error } = await supabase.from('folders').insert(insertData).select().single();

  // If schema cache error, retry without new columns (area/color/icon may not exist yet)
  if (error && error.message.includes('schema cache')) {
    console.warn('POST /api/folders: new columns not in schema, retrying without area/color/icon');
    const safeData: Record<string, unknown> = {
      name: insertData.name,
      parent_id: insertData.parent_id,
      user_id: insertData.user_id,
    };
    const retry = await supabase.from('folders').insert(safeData).select().single();
    data = retry.data;
    error = retry.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ folder: data }, { status: 201 });
}
