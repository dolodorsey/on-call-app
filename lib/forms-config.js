/**
 * KHG Forms System — Brand Configuration
 * 
 * Each brand site sets NEXT_PUBLIC_BRAND_KEY in .env.local
 * The API route uses this to route submissions to the correct GHL sub-account.
 * 
 * PIT tokens are stored server-side only in .env.local as GHL_PIT_TOKEN
 * Location IDs are public (used in form routing).
 */

export const BRAND_CONFIG = {
  forever_futbol: {
    name: 'Forever Futbol',
    locationId: 'GbG9KQGmgIDSvPuYIUf9',
    accent: '#C87941',
    hasArtistForms: true,
    hasVendorForm: true,
  },
  infinity_water: {
    name: 'Infinity Water',
    locationId: 'OQcKgzwCYdUYLSjZnRBE',
    accent: '#4ECDC4',
    hasArtistForms: false,
    hasVendorForm: false,
  },
  pronto_energy: {
    name: 'Pronto Energy',
    locationId: 'P3Xk1DXrNRFozNsGQeJ8',
    accent: '#FFD93D',
    hasArtistForms: false,
    hasVendorForm: false,
  },
  huglife: {
    name: 'HugLife',
    locationId: 'tGbC7nJkOkH5G3RiyjKR',
    accent: '#FF6B35',
    hasArtistForms: true,
    hasVendorForm: true,
  },
  casper_group: {
    name: 'Casper Group',
    locationId: 'IPP6mHiRgKtIAHOOueHS',
    accent: '#E8485C',
    hasArtistForms: true,
    hasVendorForm: true,
  },
  mind_studio: {
    name: 'Mind Studio',
    locationId: '6h8pNMs7vPOnStVlvGvJ',
    accent: '#7C5CFC',
    hasArtistForms: false,
    hasVendorForm: false,
  },
  good_times: {
    name: 'Good Times',
    locationId: 'jbm4vUg0J1llNkK8q6Lt',
    accent: '#4A9FD5',
    hasArtistForms: true,
    hasVendorForm: true,
  },
  bodega: {
    name: 'Bodega',
    locationId: 'IPP6mHiRgKtIAHOOueHS',
    accent: '#FF8C42',
    hasArtistForms: true,
    hasVendorForm: true,
  },
  stush: {
    name: 'Stush',
    locationId: '2rlQ89TGyca6NZaFugHN',
    accent: '#D4AF37',
    hasArtistForms: false,
    hasVendorForm: false,
  },
  umbrella_group: {
    name: 'Umbrella Group',
    locationId: '78C8jSFZhpH9MxiKUtFc',
    accent: '#8B9DAF',
    hasArtistForms: false,
    hasVendorForm: false,
  },
  sos: {
    name: 'SOS',
    locationId: 'jz8geHs33lqyruo2q2oO',
    accent: '#FF4444',
    hasArtistForms: false,
    hasVendorForm: false,
  },
  on_call: {
    name: 'On Call',
    locationId: 'jz8geHs33lqyruo2q2oO',
    accent: '#00C9A7',
    hasArtistForms: false,
    hasVendorForm: false,
  },
};

/**
 * All 16 form type definitions with field specs.
 * Each form generates a GHL contact with tags + notes.
 */
export const FORM_TYPES = {
  vendor: {
    label: 'Vendor',
    icon: '🏪',
    tag: 'form_vendor',
    selective: true,
    description: 'Apply to be a vendor at our events',
    fields: [
      { name: 'company_name', label: 'Company Name', type: 'text', required: false },
      { name: 'website', label: 'Website', type: 'url', required: false },
      { name: 'vendor_type', label: 'Vendor Type', type: 'select', options: ['Food', 'Beverage', 'Merchandise', 'Art', 'Services', 'Other'], required: true },
      { name: 'description', label: 'Description of Services', type: 'textarea', required: true },
      { name: 'portfolio_link', label: 'Portfolio/Website Link', type: 'url', required: false },
      { name: 'city', label: 'City', type: 'text', required: true },
      { name: 'availability', label: 'Availability', type: 'text', required: false },
    ],
  },
  artist_painter: {
    label: 'Artist (Painter)',
    icon: '🎨',
    tag: 'form_artist_painter',
    selective: true,
    description: 'Submit your work for exhibition or collaboration',
    fields: [
      { name: 'artist_name', label: 'Artist Name', type: 'text', required: true },
      { name: 'portfolio_link', label: 'Portfolio Link', type: 'url', required: true },
      { name: 'instagram', label: 'Instagram Handle', type: 'text', required: false },
      { name: 'medium', label: 'Medium/Style', type: 'select', options: ['Oil', 'Acrylic', 'Watercolor', 'Mixed Media', 'Digital', 'Other'], required: true },
      { name: 'description', label: 'Description of Work', type: 'textarea', required: true },
      { name: 'city', label: 'City', type: 'text', required: true },
      { name: 'pricing_range', label: 'Pricing Range', type: 'text', required: false },
    ],
  },
  artist_music: {
    label: 'Artist (Music)',
    icon: '🎵',
    tag: 'form_artist_music',
    selective: true,
    description: 'Apply to perform at our events',
    fields: [
      { name: 'stage_name', label: 'Stage Name', type: 'text', required: true },
      { name: 'genre', label: 'Genre', type: 'select', options: ['Hip-Hop', 'R&B', 'Afrobeats', 'Latin', 'House/EDM', 'Jazz', 'Gospel', 'Indie', 'Other'], required: true },
      { name: 'spotify_link', label: 'Spotify/Apple Music Link', type: 'url', required: false },
      { name: 'instagram', label: 'Instagram Handle', type: 'text', required: false },
      { name: 'youtube', label: 'YouTube Link', type: 'url', required: false },
      { name: 'bio', label: 'Bio/Description', type: 'textarea', required: true },
      { name: 'city', label: 'City', type: 'text', required: true },
      { name: 'set_length', label: 'Set Length', type: 'select', options: ['15 min', '30 min', '45 min', '1 hr', '1.5 hr', '2 hr'], required: true },
      { name: 'equipment_needs', label: 'Equipment Needs', type: 'textarea', required: false },
    ],
  },
  influencer: {
    label: 'Influencer',
    icon: '📸',
    tag: 'form_influencer',
    description: 'Partner with us for content and events',
    fields: [
      { name: 'instagram', label: 'Instagram Handle', type: 'text', required: true },
      { name: 'tiktok', label: 'TikTok Handle', type: 'text', required: false },
      { name: 'youtube', label: 'YouTube Channel', type: 'text', required: false },
      { name: 'follower_count', label: 'Follower Count', type: 'select', options: ['1K-5K', '5K-10K', '10K-25K', '25K-50K', '50K-100K', '100K+'], required: true },
      { name: 'niche', label: 'Niche/Content Type', type: 'text', required: true },
      { name: 'city', label: 'City', type: 'text', required: true },
      { name: 'rate_card', label: 'Rate Card/Pricing', type: 'text', required: false },
    ],
  },
  sponsor: {
    label: 'Sponsor',
    icon: '💎',
    tag: 'form_sponsor',
    description: 'Sponsorship and partnership opportunities',
    fields: [
      { name: 'company_name', label: 'Company Name', type: 'text', required: true },
      { name: 'website', label: 'Website', type: 'url', required: false },
      { name: 'sponsorship_interest', label: 'Sponsorship Interest', type: 'select', options: ['Event Title', 'Beverage', 'Activations', 'Media', 'Full Season', 'Custom'], required: true },
      { name: 'budget_range', label: 'Budget Range', type: 'select', options: ['$500-$1K', '$1K-$2.5K', '$2.5K-$5K', '$5K-$10K', '$10K+'], required: true },
      { name: 'target_events', label: 'Target Events/Brands', type: 'text', required: false },
      { name: 'goals', label: 'Sponsorship Goals', type: 'textarea', required: true },
    ],
  },
  consultation: {
    label: 'Consultation',
    icon: '💬',
    tag: 'form_consultation',
    description: 'Book a consultation session',
    fields: [
      { name: 'company_name', label: 'Company Name', type: 'text', required: false },
      { name: 'consultation_type', label: 'Type', type: 'select', options: ['Events', 'Hospitality', 'Marketing', 'Branding', 'Strategy', 'Legal', 'Other'], required: true },
      { name: 'description', label: 'Description of Needs', type: 'textarea', required: true },
      { name: 'preferred_date', label: 'Preferred Date', type: 'date', required: false },
      { name: 'budget_range', label: 'Budget Range', type: 'text', required: false },
    ],
  },
  onboarding: {
    label: 'Onboarding',
    icon: '🚀',
    tag: 'form_onboarding',
    description: 'New team member onboarding form',
    fields: [
      { name: 'role', label: 'Role/Position', type: 'text', required: true },
      { name: 'department', label: 'Department', type: 'text', required: true },
      { name: 'start_date', label: 'Start Date', type: 'date', required: true },
      { name: 'address', label: 'Mailing Address', type: 'textarea', required: true },
      { name: 'emergency_contact', label: 'Emergency Contact Name', type: 'text', required: true },
      { name: 'emergency_phone', label: 'Emergency Contact Phone', type: 'tel', required: true },
      { name: 'tshirt_size', label: 'T-Shirt Size', type: 'select', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'], required: true },
      { name: 'dietary', label: 'Dietary Restrictions', type: 'text', required: false },
      { name: 'social_handles', label: 'Social Media Handles', type: 'text', required: false },
    ],
  },
  what_you_do: {
    label: 'What You Do',
    icon: '✨',
    tag: 'form_what_you_do',
    description: 'Tell us what you do — let\'s find ways to collaborate',
    fields: [
      { name: 'what_you_do', label: 'What You Do', type: 'textarea', required: true },
      { name: 'skills', label: 'Key Skills', type: 'text', required: true },
      { name: 'portfolio_link', label: 'Portfolio/Website Link', type: 'url', required: false },
      { name: 'instagram', label: 'Instagram Handle', type: 'text', required: false },
      { name: 'city', label: 'City', type: 'text', required: true },
      { name: 'collaboration', label: 'How Can We Collaborate?', type: 'textarea', required: false },
    ],
  },
  rsvp: {
    label: 'RSVP',
    icon: '🎟️',
    tag: 'form_rsvp',
    description: 'RSVP for an upcoming event',
    fields: [
      { name: 'event_name', label: 'Event Name', type: 'text', required: true },
      { name: 'guest_count', label: 'Number of Guests', type: 'select', options: ['1', '2', '3', '4', '5+'], required: true },
      { name: 'dietary', label: 'Dietary Restrictions', type: 'text', required: false },
      { name: 'special_requests', label: 'Special Requests', type: 'textarea', required: false },
    ],
  },
  intern: {
    label: 'Intern',
    icon: '📚',
    tag: 'form_intern',
    description: 'Apply for an internship position',
    fields: [
      { name: 'school', label: 'School/University', type: 'text', required: true },
      { name: 'major', label: 'Major/Field of Study', type: 'text', required: true },
      { name: 'graduation_year', label: 'Graduation Year', type: 'text', required: true },
      { name: 'department_interest', label: 'Department Interest', type: 'select', options: ['Events', 'Marketing', 'Social Media', 'Design', 'Operations', 'Tech', 'Legal', 'Other'], required: true },
      { name: 'resume_link', label: 'Resume Link', type: 'url', required: true },
      { name: 'portfolio_link', label: 'Portfolio Link', type: 'url', required: false },
      { name: 'availability', label: 'Availability', type: 'select', options: ['Full-Time', 'Part-Time', 'Weekends Only'], required: true },
      { name: 'why_interested', label: 'Why Are You Interested?', type: 'textarea', required: true },
    ],
  },
  volunteer: {
    label: 'Volunteer',
    icon: '🤝',
    tag: 'form_volunteer',
    description: 'Volunteer at our events',
    fields: [
      { name: 'availability', label: 'Availability', type: 'select', options: ['Weekdays', 'Weekends', 'Both', 'Event-Day Only'], required: true },
      { name: 'skills', label: 'Skills/Experience', type: 'textarea', required: false },
      { name: 'events_interested', label: 'Events Interested In', type: 'text', required: false },
      { name: 'experience', label: 'Prior Volunteer Experience', type: 'textarea', required: false },
      { name: 'tshirt_size', label: 'T-Shirt Size', type: 'select', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'], required: true },
      { name: 'city', label: 'City', type: 'text', required: true },
    ],
  },
  hiring_inquiry: {
    label: 'Hiring Inquiry',
    icon: '💼',
    tag: 'form_hiring',
    description: 'Inquire about open positions',
    fields: [
      { name: 'position', label: 'Position Interested In', type: 'text', required: true },
      { name: 'resume_link', label: 'Resume Link', type: 'url', required: true },
      { name: 'portfolio_link', label: 'Portfolio Link', type: 'url', required: false },
      { name: 'experience_years', label: 'Years of Experience', type: 'text', required: true },
      { name: 'city', label: 'City', type: 'text', required: true },
      { name: 'availability', label: 'Availability', type: 'select', options: ['Immediately', '2 Weeks', '1 Month', 'Flexible'], required: true },
      { name: 'salary_expectation', label: 'Salary Expectation', type: 'text', required: false },
    ],
  },
  inquiry: {
    label: 'Inquiry',
    icon: '📩',
    tag: 'form_inquiry',
    description: 'General inquiries and questions',
    fields: [
      { name: 'subject', label: 'Subject', type: 'text', required: true },
      { name: 'message', label: 'Message', type: 'textarea', required: true },
    ],
  },
  group_pricing: {
    label: 'Group Pricing',
    icon: '👥',
    tag: 'form_group_pricing',
    description: 'Request group rates for events',
    fields: [
      { name: 'event_name', label: 'Event Name', type: 'text', required: true },
      { name: 'group_size', label: 'Group Size', type: 'select', options: ['5-10', '10-20', '20-50', '50+'], required: true },
      { name: 'preferred_date', label: 'Preferred Date', type: 'date', required: false },
      { name: 'budget_range', label: 'Budget Range', type: 'text', required: false },
      { name: 'special_requests', label: 'Special Requests', type: 'textarea', required: false },
    ],
  },
  table_reservation: {
    label: 'Table / Section',
    icon: '🍽️',
    tag: 'form_table_reservation',
    description: 'Reserve a table or VIP section',
    fields: [
      { name: 'event_name', label: 'Event Name', type: 'text', required: true },
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'party_size', label: 'Party Size', type: 'select', options: ['2-4', '4-6', '6-8', '8-12', '12+'], required: true },
      { name: 'reservation_type', label: 'Table or Section', type: 'select', options: ['Table', 'VIP Section', 'Cabana', 'Custom'], required: true },
      { name: 'budget_range', label: 'Budget Range', type: 'select', options: ['$200-$500', '$500-$1K', '$1K-$2.5K', '$2.5K-$5K', '$5K+'], required: true },
      { name: 'special_requests', label: 'Special Requests', type: 'textarea', required: false },
    ],
  },
  nda: {
    label: 'NDA',
    icon: '📋',
    tag: 'form_nda',
    description: 'Non-Disclosure Agreement',
    fields: [
      { name: 'company_name', label: 'Company Name', type: 'text', required: true },
      { name: 'title', label: 'Title/Position', type: 'text', required: true },
      { name: 'address', label: 'Mailing Address', type: 'textarea', required: true },
      { name: 'purpose', label: 'Purpose of NDA', type: 'textarea', required: true },
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'signature', label: 'Type Full Legal Name as Signature', type: 'text', required: true },
    ],
  },
};

/**
 * Get available forms for a brand
 */
export function getBrandForms(brandKey) {
  const config = BRAND_CONFIG[brandKey];
  if (!config) return [];
  
  return Object.entries(FORM_TYPES)
    .filter(([key, form]) => {
      if (form.selective) {
        if (key === 'vendor') return config.hasVendorForm;
        if (key.startsWith('artist_')) return config.hasArtistForms;
      }
      return true;
    })
    .map(([key, form]) => ({ key, ...form }));
}
