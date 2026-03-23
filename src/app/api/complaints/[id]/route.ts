import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('complaints')
      .select(`
        id,
        complaint_code,
        complainant_name,
        complainant_mobile,
        complainant_email,
        assembly_constituency,
        block_municipality,
        original_bengali,
        english_summary,
        location_booth_block,
        category,
        urgency,
        status,
        recorded_by,
        created_at,
        updated_at
      `)
      .eq('id', params.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ complaint: data });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch complaint' }, { status: 500 });
  }
}
