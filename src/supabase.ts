import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wfkohcwxxsrhcxhepfql.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indma29oY3d4eHNyaGN4aGVwZnFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczMzMxODUsImV4cCI6MjA4MjkwOTE4NX0.e78lphH3WlRtWP0M9egyvFCLNVW9rgJiOBy9-ZZC9Ao';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// n8n webhook base URL
const N8N_BASE = 'https://dorsey.app.n8n.cloud/webhook';

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

// Lookup oc_users.id from auth.users.id (auth_id)
export const getOcUserId = async (authId: string): Promise<string | null> => {
  const { data } = await supabase
    .from('oc_users')
    .select('id')
    .eq('auth_id', authId)
    .single();
  return data?.id || null;
};

export const createBooking = async (booking: {
  customer_id: string; // This is auth.users.id — we look up oc_users.id
  service_id?: string;
  service_name: string;
  category_name: string;
  address: string;
  lat?: number;
  lng?: number;
  total_price: number;
  scheduled_at?: string;
}) => {
  // oc_bookings.customer_id FK → oc_users.id (not auth.users.id)
  const ocUserId = await getOcUserId(booking.customer_id);
  if (!ocUserId) throw new Error('No oc_users record found for this auth user');

  const { data, error } = await supabase
    .from('oc_bookings')
    .insert({
      customer_id: ocUserId,
      service_name: booking.service_name,
      category_name: booking.category_name || 'Home Services',
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
    .from('oc_users')
    .select('full_name, email')
    .eq('id', ocUserId)
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

export const getBookings = async (authUserId: string) => {
  // oc_bookings.customer_id references oc_users.id, not auth.users.id
  const ocUserId = await getOcUserId(authUserId);
  if (!ocUserId) return [];

  const { data, error } = await supabase
    .from('oc_bookings')
    .select('*')
    .eq('customer_id', ocUserId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getProfile = async (authUserId: string) => {
  const { data, error } = await supabase
    .from('oc_users')
    .select('*')
    .eq('auth_id', authUserId)
    .single();

  if (error) throw error;
  return data;
};

// ── Provider helpers ──
export const applyAsProvider = async (providerData: {
  user_id: string; // This is auth.users.id
  full_name: string;
  email: string;
  phone?: string;
  skills: string[];
  service_area?: string;
}) => {
  // Look up oc_users.id from auth_id
  const ocUserId = await getOcUserId(providerData.user_id);
  if (!ocUserId) throw new Error('No oc_users record found');

  const { error } = await supabase
    .from('oc_provider_profiles')
    .upsert({
      user_id: ocUserId,
      skills: providerData.skills,
      service_area_radius: 25,
      is_available: false,
      background_check_status: 'pending',
    });

  if (error) throw error;

  fetch(`${N8N_BASE}/on-call-provider-apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(providerData),
  }).catch(() => {});
};

export const toggleAvailability = async (authUserId: string, isAvailable: boolean) => {
  const ocUserId = await getOcUserId(authUserId);
  if (!ocUserId) return;

  const { error } = await supabase
    .from('oc_provider_profiles')
    .update({ is_available: isAvailable })
    .eq('user_id', ocUserId);

  if (error) throw error;
};

export const getProviderProfile = async (authUserId: string) => {
  const ocUserId = await getOcUserId(authUserId);
  if (!ocUserId) return null;

  const { data, error } = await supabase
    .from('oc_provider_profiles')
    .select('*')
    .eq('user_id', ocUserId)
    .single();

  if (error) return null;
  return data;
};
