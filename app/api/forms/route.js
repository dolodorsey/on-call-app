import { NextResponse } from 'next/server';

/**
 * POST /api/forms
 * 
 * Receives form submissions from any KHG form component,
 * upserts the contact into GHL via Contacts API,
 * applies tags, and stores form-specific data in notes.
 * 
 * Required env vars per brand site:
 *   GHL_PIT_TOKEN=pit-xxxxx
 *   GHL_LOCATION_ID=xxxxx
 *   NEXT_PUBLIC_BRAND_KEY=huglife
 */

const GHL_API = 'https://services.leadconnectorhq.com';

export async function POST(request) {
  try {
    const body = await request.json();
    const { formType, name, email, phone, source, fields = {} } = body;

    if (!formType || !name || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: formType, name, email' },
        { status: 400 }
      );
    }

    const pitToken = process.env.GHL_PIT_TOKEN;
    const locationId = process.env.GHL_LOCATION_ID;

    if (!pitToken || !locationId) {
      console.error('Missing GHL_PIT_TOKEN or GHL_LOCATION_ID');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Build the notes string with all form-specific fields
    const formTag = `form_${formType}`;
    const timestamp = new Date().toISOString();
    const notesLines = [
      `═══ ${formType.toUpperCase().replace(/_/g, ' ')} SUBMISSION ═══`,
      `Submitted: ${timestamp}`,
      `Source: ${source || 'Website'}`,
      '',
      ...Object.entries(fields).map(([k, v]) => `${k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: ${v}`),
    ];
    const notesText = notesLines.join('\n');

    // Split name into first/last
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Upsert contact in GHL
    const contactPayload = {
      firstName,
      lastName,
      email,
      phone: phone || undefined,
      locationId,
      source: `KHG Form: ${formType.replace(/_/g, ' ')}`,
      tags: [formTag, 'website_form', `form_${timestamp.split('T')[0]}`],
    };

    // Remove undefined values
    Object.keys(contactPayload).forEach(k => {
      if (contactPayload[k] === undefined) delete contactPayload[k];
    });

    const contactRes = await fetch(`${GHL_API}/contacts/upsert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${pitToken}`,
        'Version': '2021-07-28',
      },
      body: JSON.stringify(contactPayload),
    });

    if (!contactRes.ok) {
      const errText = await contactRes.text();
      console.error('GHL contact upsert failed:', contactRes.status, errText);
      // Still return success to user — log for ops
      return NextResponse.json({
        success: true,
        message: 'Form submitted successfully. Our team will be in touch.',
        _debug: process.env.NODE_ENV === 'development' ? errText : undefined,
      });
    }

    const contactData = await contactRes.json();
    const contactId = contactData?.contact?.id;

    // Add notes with form details
    if (contactId) {
      try {
        await fetch(`${GHL_API}/contacts/${contactId}/notes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${pitToken}`,
            'Version': '2021-07-28',
          },
          body: JSON.stringify({ body: notesText }),
        });
      } catch (noteErr) {
        console.error('Failed to add note:', noteErr);
      }
    }

    // Log to Supabase (fire and forget)
    logSubmission(formType, email, locationId, contactId).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Form submitted successfully. Our team will be in touch.',
      contactId,
    });
  } catch (err) {
    console.error('Form API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function logSubmission(formType, email, locationId, contactId) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) return;

  await fetch(`${supabaseUrl}/rest/v1/form_submissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      form_type: formType,
      email,
      location_id: locationId,
      ghl_contact_id: contactId,
      brand_key: process.env.NEXT_PUBLIC_BRAND_KEY,
      submitted_at: new Date().toISOString(),
    }),
  });
}
