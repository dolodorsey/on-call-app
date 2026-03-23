'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════
// KHG UNIVERSAL FORM SYSTEM
// Drop-in component for ALL brand sites
// Submits to /api/forms/submit → Supabase + GHL
// ═══════════════════════════════════════════════════════════

const FORM_DEFS = {
  vendor: {
    label: 'Vendor Application',
    icon: '🏪',
    fields: [
      { name: 'full_name', label: 'Full Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'company_name', label: 'Company Name', type: 'text' },
      { name: 'website', label: 'Website', type: 'url' },
      { name: 'vendor_type', label: 'Vendor Type', type: 'select', options: ['Food', 'Beverage', 'Merchandise', 'Art', 'Services', 'Other'] },
      { name: 'description', label: 'Description of Services', type: 'textarea' },
      { name: 'portfolio_link', label: 'Portfolio / Website Link', type: 'url' },
      { name: 'city', label: 'City', type: 'text' },
      { name: 'availability', label: 'Availability', type: 'text' },
      { name: 'referral_source', label: 'How Did You Hear About Us?', type: 'text' },
    ],
  },
  artist_painter: {
    label: 'Artist (Painter)',
    icon: '🎨',
    fields: [
      { name: 'full_name', label: 'Full Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'artist_name', label: 'Artist Name', type: 'text' },
      { name: 'portfolio_link', label: 'Portfolio Link', type: 'url' },
      { name: 'instagram', label: 'Instagram Handle', type: 'text' },
      { name: 'medium_style', label: 'Medium / Style', type: 'select', options: ['Oil', 'Acrylic', 'Watercolor', 'Mixed Media', 'Digital', 'Sculpture', 'Other'] },
      { name: 'description', label: 'Description of Work', type: 'textarea' },
      { name: 'city', label: 'City', type: 'text' },
      { name: 'availability', label: 'Availability', type: 'text' },
      { name: 'pricing_range', label: 'Pricing Range', type: 'text' },
      { name: 'referral_source', label: 'How Did You Hear About Us?', type: 'text' },
    ],
  },
  artist_music: {
    label: 'Artist (Music)',
    icon: '🎵',
    fields: [
      { name: 'full_name', label: 'Full Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'stage_name', label: 'Stage Name', type: 'text' },
      { name: 'genre', label: 'Genre', type: 'select', options: ['Hip-Hop', 'R&B', 'Afrobeats', 'Latin', 'House / EDM', 'Jazz', 'Gospel', 'Indie', 'Other'] },
      { name: 'streaming_link', label: 'Spotify / Apple Music Link', type: 'url' },
      { name: 'instagram', label: 'Instagram Handle', type: 'text' },
      { name: 'youtube', label: 'YouTube Link', type: 'url' },
      { name: 'bio', label: 'Bio / Description', type: 'textarea' },
      { name: 'city', label: 'City', type: 'text' },
      { name: 'availability', label: 'Availability', type: 'text' },
      { name: 'set_length', label: 'Set Length', type: 'select', options: ['15 min', '30 min', '45 min', '1 hour', '1.5 hours', '2 hours'] },
      { name: 'equipment_needs', label: 'Equipment Needs', type: 'textarea' },
      { name: 'referral_source', label: 'How Did You Hear About Us?', type: 'text' },
    ],
  },
  influencer: {
    label: 'Influencer',
    icon: '📸',
    fields: [
      { name: 'full_name', label: 'Full Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'instagram', label: 'Instagram Handle', type: 'text' },
      { name: 'tiktok', label: 'TikTok Handle', type: 'text' },
      { name: 'youtube', label: 'YouTube Channel', type: 'text' },
      { name: 'follower_count', label: 'Follower Count', type: 'select', options: ['1K - 5K', '5K - 10K', '10K - 25K', '25K - 50K', '50K - 100K', '100K+'] },
      { name: 'niche', label: 'Niche / Content Type', type: 'text' },
      { name: 'city', label: 'City', type: 'text' },
      { name: 'rate_card', label: 'Rate Card / Pricing', type: 'text' },
      { name: 'referral_source', label: 'How Did You Hear About Us?', type: 'text' },
    ],
  },
  sponsor: {
    label: 'Sponsor Inquiry',
    icon: '💎',
    fields: [
      { name: 'full_name', label: 'Full Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'company_name', label: 'Company Name', type: 'text', required: true },
      { name: 'website', label: 'Website', type: 'url' },
      { name: 'sponsorship_interest', label: 'Sponsorship Interest', type: 'select', options: ['Event Title', 'Beverage', 'Activations', 'Media', 'Full Season', 'Custom'] },
      { name: 'budget_range', label: 'Budget Range', type: 'select', options: ['$500 - $1K', '$1K - $2.5K', '$2.5K - $5K', '$5K - $10K', '$10K+'] },
      { name: 'target_events', label: 'Target Events / Brands', type: 'textarea' },
      { name: 'goals', label: 'Sponsorship Goals', type: 'textarea' },
      { name: 'referral_source', label: 'How Did You Hear About Us?', type: 'text' },
    ],
  },
  consultation: {
    label: 'Consultation Request',
    icon: '💬',
    fields: [
      { name: 'full_name', label: 'Full Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'company_name', label: 'Company Name', type: 'text' },
      { name: 'consultation_type', label: 'Consultation Type', type: 'select', options: ['Events', 'Hospitality', 'Marketing', 'Branding', 'Strategy', 'Legal', 'Mental Health', 'Other'] },
      { name: 'description', label: 'Description of Needs', type: 'textarea' },
      { name: 'preferred_date', label: 'Preferred Date', type: 'date' },
      { name: 'preferred_time', label: 'Preferred Time', type: 'select', options: ['Morning (9AM-12PM)', 'Afternoon (12PM-5PM)', 'Evening (5PM-8PM)'] },
      { name: 'budget_range', label: 'Budget Range', type: 'text' },
      { name: 'referral_source', label: 'How Did You Hear About Us?', type: 'text' },
    ],
  },
  onboarding: {
    label: 'Onboarding',
    icon: '🚀',
    fields: [
      { name: 'full_name', label: 'Full Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'role', label: 'Role / Position', type: 'text' },
      { name: 'department', label: 'Department', type: 'text' },
      { name: 'start_date', label: 'Start Date', type: 'date' },
      { name: 'address', label: 'Mailing Address', type: 'textarea' },
      { name: 'emergency_contact', label: 'Emergency Contact Name', type: 'text' },
      { name: 'emergency_phone', label: 'Emergency Contact Phone', type: 'tel' },
      { name: 'tshirt_size', label: 'T-Shirt Size', type: 'select', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] },
      { name: 'dietary', label: 'Dietary Restrictions', type: 'text' },
      { name: 'social_handles', label: 'Social Media Handles', type: 'text' },
    ],
  },
  what_you_do: {
    label: 'What You Do',
    icon: '✨',
    fields: [
      { name: 'full_name', label: 'Full Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'what_you_do', label: 'What You Do', type: 'textarea', required: true },
      { name: 'skills', label: 'Key Skills', type: 'text' },
      { name: 'portfolio_link', label: 'Portfolio / Website Link', type: 'url' },
      { name: 'instagram', label: 'Instagram Handle', type: 'text' },
      { name: 'city', label: 'City', type: 'text' },
      { name: 'availability', label: 'Availability', type: 'text' },
      { name: 'collaboration_ideas', label: 'How Can We Collaborate?', type: 'textarea' },
      { name: 'referral_source', label: 'How Did You Hear About Us?', type: 'text' },
    ],
  },
  rsvp: {
    label: 'RSVP',
    icon: '🎟️',
    fields: [
      { name: 'full_name', label: 'Full Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'event_name', label: 'Event Name', type: 'text', required: true },
      { name: 'guest_count', label: 'Number of Guests', type: 'select', options: ['1', '2', '3', '4', '5+'] },
      { name: 'dietary', label: 'Dietary Restrictions', type: 'text' },
      { name: 'special_requests', label: 'Special Requests', type: 'textarea' },
      { name: 'referral_source', label: 'How Did You Hear About Us?', type: 'text' },
    ],
  },
  intern: {
    label: 'Intern Application',
    icon: '📚',
    fields: [
      { name: 'full_name', label: 'Full Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'school', label: 'School / University', type: 'text' },
      { name: 'major', label: 'Major / Field of Study', type: 'text' },
      { name: 'graduation_year', label: 'Graduation Year', type: 'text' },
      { name: 'department_interest', label: 'Department Interest', type: 'select', options: ['Events', 'Marketing', 'Social Media', 'Design', 'Operations', 'Tech', 'Legal', 'Other'] },
      { name: 'resume_link', label: 'Resume Link', type: 'url' },
      { name: 'portfolio_link', label: 'Portfolio Link', type: 'url' },
      { name: 'availability', label: 'Availability', type: 'select', options: ['Full-Time', 'Part-Time', 'Weekends Only'] },
      { name: 'why_interested', label: 'Why Are You Interested?', type: 'textarea' },
      { name: 'referral_source', label: 'How Did You Hear About Us?', type: 'text' },
    ],
  },
  volunteer: {
    label: 'Volunteer',
    icon: '🤝',
    fields: [
      { name: 'full_name', label: 'Full Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'availability', label: 'Availability', type: 'select', options: ['Weekdays', 'Weekends', 'Both', 'Event-Day Only'] },
      { name: 'skills', label: 'Skills / Experience', type: 'textarea' },
      { name: 'events_interested', label: 'Events Interested In', type: 'text' },
      { name: 'experience', label: 'Prior Volunteer Experience', type: 'textarea' },
      { name: 'tshirt_size', label: 'T-Shirt Size', type: 'select', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] },
      { name: 'city', label: 'City', type: 'text' },
      { name: 'referral_source', label: 'How Did You Hear About Us?', type: 'text' },
    ],
  },
  hiring_inquiry: {
    label: 'Hiring Inquiry',
    icon: '💼',
    fields: [
      { name: 'full_name', label: 'Full Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'position', label: 'Position Interested In', type: 'text' },
      { name: 'resume_link', label: 'Resume Link', type: 'url' },
      { name: 'portfolio_link', label: 'Portfolio Link', type: 'url' },
      { name: 'experience_years', label: 'Years of Experience', type: 'text' },
      { name: 'city', label: 'City', type: 'text' },
      { name: 'availability', label: 'Availability', type: 'select', options: ['Immediately', '2 Weeks', '1 Month', 'Flexible'] },
      { name: 'salary_expectation', label: 'Salary Expectation', type: 'text' },
      { name: 'referral_source', label: 'How Did You Hear About Us?', type: 'text' },
    ],
  },
  inquiry: {
    label: 'General Inquiry',
    icon: '📩',
    fields: [
      { name: 'full_name', label: 'Full Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'subject', label: 'Subject', type: 'text', required: true },
      { name: 'message', label: 'Message', type: 'textarea', required: true },
      { name: 'referral_source', label: 'How Did You Hear About Us?', type: 'text' },
    ],
  },
  group_pricing: {
    label: 'Group Pricing',
    icon: '👥',
    fields: [
      { name: 'full_name', label: 'Full Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'event_name', label: 'Event Name', type: 'text' },
      { name: 'group_size', label: 'Group Size', type: 'select', options: ['5-10', '10-20', '20-50', '50+'] },
      { name: 'preferred_date', label: 'Preferred Date', type: 'date' },
      { name: 'budget_range', label: 'Budget Range', type: 'text' },
      { name: 'special_requests', label: 'Special Requests', type: 'textarea' },
      { name: 'referral_source', label: 'How Did You Hear About Us?', type: 'text' },
    ],
  },
  table_reservation: {
    label: 'Table / Section Reservation',
    icon: '🍽️',
    fields: [
      { name: 'full_name', label: 'Full Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'event_name', label: 'Event Name', type: 'text' },
      { name: 'date', label: 'Date', type: 'date' },
      { name: 'party_size', label: 'Party Size', type: 'select', options: ['2-4', '4-6', '6-8', '8-12', '12+'] },
      { name: 'reservation_type', label: 'Table or Section', type: 'select', options: ['Table', 'VIP Section', 'Cabana', 'Custom'] },
      { name: 'budget_range', label: 'Budget Range', type: 'select', options: ['$200 - $500', '$500 - $1K', '$1K - $2.5K', '$2.5K - $5K', '$5K+'] },
      { name: 'special_requests', label: 'Special Requests', type: 'textarea' },
      { name: 'referral_source', label: 'How Did You Hear About Us?', type: 'text' },
    ],
  },
  nda: {
    label: 'NDA Agreement',
    icon: '📋',
    fields: [
      { name: 'full_name', label: 'Full Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'company_name', label: 'Company Name', type: 'text' },
      { name: 'title', label: 'Title / Position', type: 'text' },
      { name: 'address', label: 'Mailing Address', type: 'textarea' },
      { name: 'nda_purpose', label: 'Purpose of NDA', type: 'textarea', required: true },
      { name: 'date', label: 'Date', type: 'date' },
      { name: 'signature', label: 'Type Full Name as Signature', type: 'text', required: true },
    ],
  },
};

// ═══════════════════════════════════════════════════════════
// FIELD RENDERER
// ═══════════════════════════════════════════════════════════
function FormField({ field, value, onChange }) {
  const baseStyle = {
    width: '100%',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    color: '#fff',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  };

  const labelStyle = {
    display: 'block',
    marginBottom: 6,
    fontSize: 12,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: '0.02em',
  };

  const handleFocus = (e) => { e.target.style.borderColor = 'var(--accent, #FF6B35)'; };
  const handleBlur = (e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; };

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>
        {field.label}
        {field.required && <span style={{ color: 'var(--accent, #FF6B35)', marginLeft: 3 }}>*</span>}
      </label>
      {field.type === 'textarea' ? (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          rows={3}
          style={{ ...baseStyle, resize: 'vertical', minHeight: 80 }}
          required={field.required}
        />
      ) : field.type === 'select' ? (
        <select
          value={value || ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={{ ...baseStyle, cursor: 'pointer', appearance: 'none' }}
          required={field.required}
        >
          <option value="" style={{ background: '#111' }}>Select...</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt} style={{ background: '#111' }}>{opt}</option>
          ))}
        </select>
      ) : (
        <input
          type={field.type}
          value={value || ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={baseStyle}
          required={field.required}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// FORM MODAL
// ═══════════════════════════════════════════════════════════
function FormModal({ formType, brandKey, onClose }) {
  const [formData, setFormData] = useState({});
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const modalRef = useRef(null);
  const def = FORM_DEFS[formType];

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const handleChange = useCallback((name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('submitting');
    try {
      const res = await fetch('/api/forms/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_key: brandKey, form_type: formType, ...formData }),
      });
      if (res.ok) {
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  if (!def) return null;

  return (
    <div
      ref={modalRef}
      onClick={(e) => { if (e.target === modalRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(24px)',
        animation: 'khgFadeIn 0.25s ease',
      }}
    >
      <div style={{
        width: '92%', maxWidth: 560, maxHeight: '92vh',
        background: '#0c0c0c', borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
        animation: 'khgSlideUp 0.35s cubic-bezier(0.16,1,0.3,1)',
        overflow: 'hidden',
      }}>
        {/* HEADER */}
        <div style={{
          padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>{def.icon}</span>
            <h2 style={{
              margin: 0, fontSize: 20, fontWeight: 400,
              fontFamily: 'var(--font-heading, "Cormorant Garamond", serif)',
              letterSpacing: '-0.01em', color: '#fff',
            }}>
              {def.label}
            </h2>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer', fontSize: 22, padding: '4px 8px', lineHeight: 1,
          }} aria-label="Close">✕</button>
        </div>

        {/* BODY */}
        <div style={{ overflow: 'auto', flex: 1, padding: '24px 28px' }}>
          {status === 'success' ? (
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
              <h3 style={{
                fontFamily: 'var(--font-heading, "Cormorant Garamond", serif)',
                fontSize: 28, fontWeight: 300, marginBottom: 12, color: '#fff',
              }}>
                Submitted
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 32 }}>
                We'll be in touch soon.
              </p>
              <button onClick={onClose} style={{
                padding: '12px 32px', background: 'var(--accent, #FF6B35)',
                border: 'none', borderRadius: 10, color: '#fff', fontSize: 14,
                fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {def.fields.map((field) => (
                <FormField
                  key={field.name}
                  field={field}
                  value={formData[field.name]}
                  onChange={handleChange}
                />
              ))}
              <button
                type="submit"
                disabled={status === 'submitting'}
                style={{
                  width: '100%', padding: '14px 24px', marginTop: 8,
                  background: status === 'submitting' ? 'rgba(255,255,255,0.1)' : 'var(--accent, #FF6B35)',
                  border: 'none', borderRadius: 12, color: '#fff',
                  fontSize: 15, fontWeight: 600, cursor: status === 'submitting' ? 'wait' : 'pointer',
                  fontFamily: 'inherit', letterSpacing: '0.02em',
                  transition: 'all 0.3s ease',
                }}
              >
                {status === 'submitting' ? 'Submitting...' : 'Submit'}
              </button>
              {status === 'error' && (
                <p style={{ color: '#ff4444', fontSize: 13, textAlign: 'center', marginTop: 12 }}>
                  Something went wrong. Please try again.
                </p>
              )}
            </form>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes khgFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes khgSlideUp { from { opacity: 0; transform: translateY(24px) scale(0.96); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SINGLE FORM BUTTON — use anywhere on any page
// ═══════════════════════════════════════════════════════════
export function KHGFormButton({
  formType,
  brandKey,
  label,
  variant = 'default', // 'default' | 'outline' | 'accent' | 'ghost'
  size = 'md',
  className = '',
  style: customStyle = {},
}) {
  const [isOpen, setIsOpen] = useState(false);
  const def = FORM_DEFS[formType];
  if (!def) return null;

  const sizes = {
    sm: { padding: '8px 16px', fontSize: 13 },
    md: { padding: '12px 24px', fontSize: 14 },
    lg: { padding: '16px 32px', fontSize: 15 },
  };

  const variants = {
    default: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' },
    outline: { background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' },
    accent: { background: 'var(--accent, #FF6B35)', border: '1px solid transparent', color: '#fff' },
    ghost: { background: 'transparent', border: '1px solid transparent', color: 'rgba(255,255,255,0.7)' },
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={className}
        style={{
          ...sizes[size],
          ...variants[variant],
          display: 'inline-flex', alignItems: 'center', gap: 10,
          borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
          fontWeight: 500, letterSpacing: '0.02em', whiteSpace: 'nowrap',
          transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
          backdropFilter: variant === 'default' ? 'blur(12px)' : undefined,
          ...customStyle,
        }}
      >
        <span style={{ fontSize: size === 'sm' ? 14 : 18 }}>{def.icon}</span>
        {label || def.label}
      </button>
      {isOpen && <FormModal formType={formType} brandKey={brandKey} onClose={() => setIsOpen(false)} />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// FULL FORMS GRID — "Connect With Us" section
// ═══════════════════════════════════════════════════════════
export function KHGFormGrid({
  brandKey,
  title = 'Connect With Us',
  subtitle = 'Choose an option below to get started.',
  forms, // optional array of form_type strings to show (default: all universal + selective if applicable)
  showSelective = false, // show artist/vendor forms
  columns = 4,
  variant = 'default',
}) {
  const selectiveForms = ['vendor', 'artist_painter', 'artist_music'];
  const formTypes = forms || Object.keys(FORM_DEFS).filter(
    (ft) => showSelective || !selectiveForms.includes(ft)
  );

  return (
    <section style={{
      padding: 'clamp(60px, 10vw, 120px) clamp(20px, 5vw, 80px)',
      position: 'relative',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 'clamp(40px, 6vw, 72px)' }}>
        <h2 style={{
          fontFamily: 'var(--font-heading, "Cormorant Garamond", serif)',
          fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 300,
          color: '#fff', marginBottom: 14, letterSpacing: '-0.02em',
        }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{
            fontFamily: 'var(--font-body, "DM Sans", sans-serif)',
            fontSize: 'clamp(14px, 1.5vw, 16px)', color: 'rgba(255,255,255,0.45)',
            maxWidth: 460, margin: '0 auto',
          }}>
            {subtitle}
          </p>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${columns <= 2 ? '280px' : '220px'}, 1fr))`,
        gap: 12, maxWidth: 1100, margin: '0 auto',
      }}>
        {formTypes.map((ft) => (
          <KHGFormButton
            key={ft}
            formType={ft}
            brandKey={brandKey}
            variant={variant}
            size="lg"
            style={{ width: '100%', justifyContent: 'flex-start' }}
          />
        ))}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════
// EXPORTS & USAGE
// ═══════════════════════════════════════════════════════════
// 
// USAGE ON ANY BRAND SITE:
// 
// 1. Copy this file to: components/KHGForms.jsx
// 2. Copy api-route.js to: app/api/forms/submit/route.js
// 3. Use anywhere:
//
//   import { KHGFormGrid, KHGFormButton } from '@/components/KHGForms';
//
//   // Full "Connect" page:
//   <KHGFormGrid brandKey="huglife" showSelective={true} />
//
//   // Individual buttons scattered throughout site:
//   <KHGFormButton formType="rsvp" brandKey="huglife" variant="accent" />
//   <KHGFormButton formType="sponsor" brandKey="huglife" variant="outline" />
//   <KHGFormButton formType="inquiry" brandKey="huglife" />
//
//   // Custom selection of forms:
//   <KHGFormGrid 
//     brandKey="mind_studio"
//     forms={['consultation', 'inquiry', 'hiring_inquiry', 'nda']}
//     title="Get In Touch"
//   />

export default KHGFormGrid;
