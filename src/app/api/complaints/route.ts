import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      complainantName,
      complainantMobile,
      complainantEmail,
      assemblyConstituency,
      blockMunicipality,
      originalBengali,
      englishSummary,
      locationBoothBlock,
      category,
      urgency,
    } = body;

    if (!assemblyConstituency?.trim() || !blockMunicipality?.trim()) {
      return NextResponse.json(
        { error: 'Assembly Constituency and Block / Municipality are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('complaints')
      .insert({
        complainant_name: complainantName?.trim() || null,
        complainant_mobile: complainantMobile?.trim() || null,
        complainant_email: complainantEmail?.trim() || null,
        assembly_constituency: assemblyConstituency.trim(),
        block_municipality: blockMunicipality.trim(),
        original_bengali: originalBengali?.trim() || null,
        english_summary: englishSummary?.trim() || null,
        location_booth_block: locationBoothBlock?.trim() || null,
        category: category === 'MCC' || category === 'L&O' ? category : null,
        urgency: ['Low', 'Medium', 'High', 'Critical'].includes(urgency || '')
          ? urgency
          : null,
        recorded_by: user.email || user.id,
      })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to save complaint' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { count: queueCount } = await supabase
      .from('complaints')
      .select('*', { count: 'exact', head: true })
      .in('status', ['submitted', 'in_progress']);

    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.parse(today + 'T00:00:00Z') + 86400000).toISOString().split('T')[0];
    const { count: todayCount } = await supabase
      .from('complaints')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${today}T00:00:00Z`)
      .lt('created_at', `${tomorrow}T00:00:00Z`);

    const { count: escalatedCount } = await supabase
      .from('complaints')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'escalated');

    const { data: recent } = await supabase
      .from('complaints')
      .select('id, complainant_name, complainant_mobile, assembly_constituency, block_municipality, status, created_at, recorded_by')
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      queue: queueCount ?? 0,
      recordedToday: todayCount ?? 0,
      escalated: escalatedCount ?? 0,
      recent: recent ?? [],
    });
  } catch {
    return NextResponse.json({
      queue: 0,
      recordedToday: 0,
      escalated: 0,
      recent: [],
    });
  }
}
