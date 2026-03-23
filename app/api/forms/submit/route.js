// app/api/forms/submit/route.js
// Universal Form Submission Handler for ALL KHG Brand Sites
// Receives form data → logs to Supabase → pushes to GHL via n8n webhook
// Drop this file into any KHG Next.js site under app/api/forms/submit/route.js

import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dzlmtvodpyhetvektfuo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const N8N_WEBHOOK = process.env.N8N_FORM_WEBHOOK || 'https://dorsey.app.n8n.cloud/webhook/khg-form-submit';

// Brand → GHL Location ID mapping
const BRAND_LOCATIONS = {
  forever_futbol: 'GbG9KQGmgIDSvPuYIUf9',
  infinity_water: 'OQcKgzwCYdUYLSjZnRBE',
  pronto_energy: 'P3Xk1DXrNRFozNsGQeJ8',
  huglife: 'tGbC7nJkOkH5G3RiyjKR',
  casper_group: 'IPP6mHiRgKtIAHOOueHS',
  mind_studio: '6h8pNMs7vPOnStVlvGvJ',
  good_times: 'jbm4vUg0J1llNkK8q6Lt',
  bodega: 'IPP6mHiRgKtIAHOOueHS',
  stush: '2rlQ89TGyca6NZaFugHN',
  umbrella_group: '78C8jSFZhpH9MxiKUtFc',
  sos: 'jz8geHs33lqyruo2q2oO',
  on_call: 'jz8geHs33lqyruo2q2oO',
};

export async function POST(request) {
  try {
    const body = await request.json();
    const { brand_key, form_type, ...formData } = body;

    if (!brand_key || !form_type) {
      return NextResponse.json({ error: 'brand_key and form_type required' }, { status: 400 });
    }

    const location_id = BRAND_LOCATIONS[brand_key];
    if (!location_id) {
      return NextResponse.json({ error: `Unknown brand: ${brand_key}` }, { status: 400 });
    }

    // 1. Log to Supabase
    const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/form_submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        brand_key,
        form_type,
        full_name: formData.full_name || formData.fullName || '',
        email: formData.email || '',
        phone: formData.phone || '',
        form_data: formData,
        ghl_push_status: 'pending',
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || '',
      }),
    });

    let submissionId = null;
    if (sbRes.ok) {
      const [row] = await sbRes.json();
      submissionId = row?.id;
    }

    // 2. Push to GHL via n8n webhook (async, don't block response)
    fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submission_id: submissionId,
        brand_key,
        form_type,
        location_id,
        contact: {
          firstName: (formData.full_name || formData.fullName || '').split(' ')[0],
          lastName: (formData.full_name || formData.fullName || '').split(' ').slice(1).join(' '),
          email: formData.email || '',
          phone: formData.phone || '',
          tags: [`form:${form_type}`, `brand:${brand_key}`, 'website-form'],
          source: `${brand_key} Website - ${form_type}`,
        },
        form_data: formData,
      }),
    }).catch(() => {}); // Fire and forget

    return NextResponse.json({
      success: true,
      message: 'Form submitted successfully',
      id: submissionId,
    });
  } catch (err) {
    console.error('Form submission error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
