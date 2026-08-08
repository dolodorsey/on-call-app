import { createClient } from '@supabase/supabase-js';

// ON CALL shares the SOS Supabase project for infrastructure only.
// Product data remains isolated under oc_* tables/functions.
const supabaseUrl = 'https://cxdqkjvtpilvouwtbgdy.supabase.co';
const supabaseAnonKey = 'sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN';
const expectedProjectRef = 'cxdqkjvtpilvouwtbgdy';

let configuredProjectRef = '';
try {
  const hostname = new URL(supabaseUrl).hostname;
  configuredProjectRef = hostname.endsWith('.supabase.co') ? hostname.split('.')[0] : '';
} catch {
  throw new Error('ON CALL backend URL is invalid.');
}

if (!configuredProjectRef || configuredProjectRef !== expectedProjectRef) {
  throw new Error('ON CALL backend project does not match the approved shared backend.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const ON_CALL_APP_URL = 'https://oncallallday.com';
export const ON_CALL_CONFIRM_URL = `${ON_CALL_APP_URL}/auth/confirm`;

// Existing CRM/webhook delivery remains non-blocking and isolated from booking success.
const N8N_BASE = 'https://dorsey.app.n8n.cloud/webhook';

export const signUp = async (email: string, password: string, fullName: string, role: 'customer' | 'provider') => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: ON_CALL_CONFIRM_URL,
      // Shared Auth tenant; this tag routes profile creation into oc_users only.
      data: { full_name: fullName, app: 'on_call' },
    },
  });
  if (error) throw error;

  fetch(`${N8N_BASE}/on-call-new-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      full_name: fullName,
      requested_role: role,
      user_id: data.user?.id || '',
    }),
  }).catch(() => {});

  return data;
};

export const resendConfirmation = async (email: string) => {
  const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: ON_CALL_CONFIRM_URL } });
  if (error) throw error;
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

export const getOcUserId = async (authId: string): Promise<string | null> => {
  const { data } = await supabase
    .from('oc_users')
    .select('id')
    .eq('auth_id', authId)
    .single();
  return data?.id || null;
};

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

  const { data: profile } = await supabase
    .from('oc_users')
    .select('full_name, email')
    .eq('id', ocUserId)
    .single();

  fetch(`${N8N_BASE}/on-call-service-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      booking_id: data.id,
      customer_id: booking.customer_id,
      customer_email: profile?.email || '',
      customer_name: profile?.full_name || '',
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

export const applyAsProvider = async (providerData: {
  user_id: string;
  full_name: string;
  email: string;
  phone?: string;
  skills: string[];
  service_area?: string;
}) => {
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
  const { data: payment } = await supabase
    .from('oc_booking_payments')
    .select('id,status')
    .eq('booking_id', bookingId)
    .maybeSingle();
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
