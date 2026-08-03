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
      // The database assigns customer by default. Provider access is granted only
      // after the separate application and approval process.
      data: { full_name: fullName },
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
      requested_role: role,
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

export const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
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

  const { data, error } = await supabase.rpc('oc_request_service', {
    p_service_name: booking.service_name,
    p_address: booking.address,
    p_lat: booking.lat || null,
    p_lng: booking.lng || null,
    p_scheduled_at: booking.scheduled_at || null,
  });

  if (error) throw error;

  // Get customer profile for GHL sync
  const { data: profile } = await supabase
    .from('oc_users')
    .select('full_name, email, ghl_contact_id')
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

export const getProviderBookings = async () => {
  const { data, error } = await supabase
    .from('oc_bookings')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const getAvailableOffers = async () => {
  const { data, error } = await supabase.rpc('oc_available_offers');
  if (error) throw error;
  return data || [];
};

export const acceptOffer = async (bookingId: string) => {
  const { data, error } = await supabase.rpc('oc_accept_offer', { p_booking_id: bookingId });
  if (error) throw error;
  return data;
};

export const transitionBooking = async (bookingId: string, status: string) => {
  const { data, error } = await supabase.rpc('oc_provider_transition', {
    p_booking_id: bookingId,
    p_status: status,
  });
  if (error) throw error;
  if (status === 'completed') {
    const { error: captureError } = await supabase.functions.invoke('oc-capture-payment', { body: { bookingId } });
    if (captureError) throw new Error(`Service completed, but payment capture needs attention: ${captureError.message}`);
  }
  return data;
};

export const createBookingPayment = async (bookingId: string) => {
  const { data, error } = await supabase.functions.invoke('oc-create-payment', { body: { bookingId } });
  if (error) throw error;
  return data as { paymentId: string; clientSecret: string; status: string };
};

export const getBookingPayments = async () => {
  const { data, error } = await supabase
    .from('oc_booking_payments')
    .select('*,booking:oc_bookings(service_name,status,created_at)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const startProviderOnboarding = async () => {
  const { data, error } = await supabase.functions.invoke('oc-connect-onboarding', { body: {} });
  if (error) throw error;
  if (!data?.url) throw new Error('Payout onboarding link was not created');
  window.location.assign(data.url);
};

export const cancelBooking = async (bookingId: string) => {
  const { data, error } = await supabase.rpc('oc_customer_cancel', { p_booking_id: bookingId });
  if (error) throw error;
  const { data: payment } = await supabase.from('oc_booking_payments').select('id,status').eq('booking_id', bookingId).maybeSingle();
  if (payment && !['captured','transferred','partially_refunded','refunded'].includes(payment.status)) {
    const { error: cancelError } = await supabase.functions.invoke('oc-cancel-payment', { body: { bookingId } });
    if (cancelError) throw new Error(`Booking canceled, but payment authorization needs attention: ${cancelError.message}`);
  }
  return data;
};

export const rateBooking = async (bookingId: string, rating: number) => {
  const { data, error } = await supabase.rpc('oc_rate_booking', {
    p_booking_id: bookingId,
    p_rating: rating,
  });
  if (error) throw error;
  return data;
};
