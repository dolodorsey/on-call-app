import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bpnaqrjhxsompkdskepi.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwbmFxcmpoeHNvbXBrZHNrZXBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5OTkxNDUsImV4cCI6MjA4NzU3NTE0NX0.H16WVF7Vbu6SUQ3h7s1xdARvSj7PIyNGz5dDSGhRlQg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// n8n webhook base URL
const N8N_BASE = 'https://drdorsey.app.n8n.cloud/webhook';

// ── Auth helpers ──
export const signUp = async (email: string, password: string, fullName: string, role: 'customer' | 'provider') => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role },
    },
  });
  if (error) throw error;

  // Fire n8n webhook for GHL sync (non-blocking)
  fetch(`${N8N_BASE}/on-call-new-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      full_name: fullName,
      role,
      user_id: data.user?.id || '',
    }),
  }).catch(() => {}); // silent fail — don't block signup

  return data;
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  await supabase.auth.signOut();
};

export const getUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const getSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

// ── Booking helpers ──
export const createBooking = async (booking: {
  customer_id: string;
  service_id?: string;
  service_name: string;
  category_name: string;
  address: string;
  lat?: number;
  lng?: number;
  total_price: number;
  scheduled_at?: string;
}) => {
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      customer_id: booking.customer_id,
      service_id: booking.service_id || null,
      status: 'pending',
      address: booking.address,
      lat: booking.lat || null,
      lng: booking.lng || null,
      total_price: booking.total_price,
      scheduled_at: booking.scheduled_at || null,
    })
    .select()
    .single();

  if (error) throw error;

  // Get customer profile for GHL sync
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, ghl_contact_id')
    .eq('id', booking.customer_id)
    .single();

  // Fire n8n webhook for service request + GHL opportunity (non-blocking)
  fetch(`${N8N_BASE}/on-call-service-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      booking_id: data.id,
      customer_id: booking.customer_id,
      customer_email: profile?.email || '',
      customer_name: profile?.full_name || '',
      ghl_contact_id: profile?.ghl_contact_id || '',
      service_name: booking.service_name,
      category_name: booking.category_name,
      total_price: booking.total_price,
      address: booking.address,
      status: 'pending',
    }),
  }).catch(() => {});

  return data;
};

export const getBookings = async (customerId: string) => {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
};

// ── Provider helpers ──
export const applyAsProvider = async (providerData: {
  user_id: string;
  full_name: string;
  email: string;
  phone?: string;
  skills: string[];
  service_area?: string;
}) => {
  // Update provider_profiles
  const { error } = await supabase
    .from('provider_profiles')
    .upsert({
      id: providerData.user_id,
      skills: providerData.skills,
      service_area_radius: 25,
      is_available: false,
      background_check_status: 'pending',
    });

  if (error) throw error;

  // Fire n8n webhook for GHL pipeline (non-blocking)
  fetch(`${N8N_BASE}/on-call-provider-apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(providerData),
  }).catch(() => {});
};

export const toggleAvailability = async (providerId: string, isAvailable: boolean) => {
  const { error } = await supabase
    .from('provider_profiles')
    .update({ is_available: isAvailable })
    .eq('id', providerId);

  if (error) throw error;
};

export const getProviderProfile = async (providerId: string) => {
  const { data, error } = await supabase
    .from('provider_profiles')
    .select('*')
    .eq('id', providerId)
    .single();

  if (error) return null;
  return data;
};
