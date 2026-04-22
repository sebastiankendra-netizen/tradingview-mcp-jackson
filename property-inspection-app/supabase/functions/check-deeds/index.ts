import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const FIELDS_TO_TRACK = ['owner_name', 'deed_book', 'deed_page'];

/**
 * Fetch and parse property info from leepa.org by address.
 * Returns null if the property can't be found.
 */
async function fetchLeepaData(address: string, city: string): Promise<{
  owner_name?: string;
  deed_book?: string;
  deed_page?: string;
  sale_date?: string;
  sale_amount?: string;
} | null> {
  // Parse street number and name from address
  const parts = address.trim().split(' ');
  const streetNum = parts[0];
  const streetName = parts.slice(1).join(' ');

  const searchUrl = `https://www.leepa.org/Search/GeneralSearch.aspx?` +
    `addr=${encodeURIComponent(streetNum)}&` +
    `street=${encodeURIComponent(streetName)}&` +
    `city=${encodeURIComponent(city)}`;

  try {
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PropertyMonitor/1.0)',
        'Accept': 'text/html',
      },
    });

    if (!res.ok) return null;
    const html = await res.text();

    // Extract owner name
    const ownerMatch = html.match(/Owner(?:\s*Name)?[:\s]*<[^>]+>([^<]+)<\/[^>]+>/i)
      ?? html.match(/class="[^"]*owner[^"]*"[^>]*>([^<]+)</i);
    const owner_name = ownerMatch?.[1]?.trim();

    // Extract deed book
    const bookMatch = html.match(/Deed\s*Book[:\s]*<[^>]+>([^<]+)<\/[^>]+>/i)
      ?? html.match(/OR\s*Book[:\s]*(\d+)/i);
    const deed_book = bookMatch?.[1]?.trim();

    // Extract deed page
    const pageMatch = html.match(/Deed\s*Page[:\s]*<[^>]+>([^<]+)<\/[^>]+>/i)
      ?? html.match(/OR\s*Page[:\s]*(\d+)/i);
    const deed_page = pageMatch?.[1]?.trim();

    // Extract sale date
    const saleDateMatch = html.match(/Sale\s*Date[:\s]*<[^>]+>([^<]+)<\/[^>]+>/i);
    const sale_date = saleDateMatch?.[1]?.trim();

    // Extract sale amount
    const saleAmtMatch = html.match(/Sale\s*(?:Amount|Price)[:\s]*<[^>]+>\$?([^<]+)<\/[^>]+>/i);
    const sale_amount = saleAmtMatch?.[1]?.trim();

    if (!owner_name && !deed_book) return null;

    return { owner_name, deed_book, deed_page, sale_date, sale_amount };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    // Fetch all properties
    const { data: properties, error: propErr } = await supabase
      .from('properties')
      .select('id, name, address, city');

    if (propErr) throw propErr;
    if (!properties?.length) {
      return new Response(JSON.stringify({ message: 'No properties found.' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let checked = 0;
    let alertsCreated = 0;

    for (const prop of properties) {
      const leepaData = await fetchLeepaData(prop.address, prop.city ?? 'Fort Myers');
      if (!leepaData) continue;

      // Get last snapshot for this property
      const { data: lastSnapshot } = await supabase
        .from('deed_snapshots')
        .select('*')
        .eq('property_id', prop.id)
        .order('checked_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Detect changes against last snapshot
      if (lastSnapshot) {
        for (const field of FIELDS_TO_TRACK) {
          const oldVal = (lastSnapshot as any)[field];
          const newVal = (leepaData as any)[field];
          if (oldVal && newVal && oldVal !== newVal) {
            await supabase.from('deed_alerts').insert({
              property_id: prop.id,
              address: prop.address,
              field_changed: field,
              old_value: oldVal,
              new_value: newVal,
            });
            alertsCreated++;
          }
        }
      }

      // Save new snapshot
      await supabase.from('deed_snapshots').insert({
        property_id: prop.id,
        address: prop.address,
        owner_name: leepaData.owner_name ?? null,
        deed_book: leepaData.deed_book ?? null,
        deed_page: leepaData.deed_page ?? null,
        sale_date: leepaData.sale_date ?? null,
        sale_amount: leepaData.sale_amount ?? null,
        checked_at: new Date().toISOString(),
      });

      checked++;
    }

    const message = alertsCreated > 0
      ? `Checked ${checked} properties. ${alertsCreated} change(s) detected — review alerts in the app.`
      : `Checked ${checked} properties. No deed changes detected.`;

    return new Response(JSON.stringify({ message, checked, alertsCreated }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
