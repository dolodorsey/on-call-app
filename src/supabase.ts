import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'ON CALL requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. ' +
      'Hard-coded production credentials are not permitted.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

type Json = Record<string, unknown>;

type MarketplaceService = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  pricing_model: 'fixed' | 'hourly' | 'quote';
  base_price: number | null;
  minimum_price: number | null;
  duration_minutes: number | null;
  emergency_eligible: boolean;
  scheduled_eligible: boolean;
  category: {
    id: string;
    slug: string;
    name: string;
    icon: string | null;
  } | null;
};

const ensureData = <T>({ data, error }: { data: T; error: Error | null }): T => {
  if (error) throw error;
  return data;
};

const getCurrentOcUserId = async (): Promise<string> => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('Authentication required');

  const { data, error } = await supabase
    .from('oc_users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error('No ON CALL profile exists for this account');
  return data.id;
};

const enqueueIntegrationEvent = async (
  eventType: string,
  aggregateType: string,
  aggregateId: string | null,
  payload: Json
): Promise<string> => {
  const { data, error } = await supabase.rpc('oc_enqueue_integration_event', {
    p_event_type: eventType,
    p_aggregate_type: aggregateType,
    p_aggregate_id: aggregateId,
    p_payload: payload,
  });
  if (error) throw error;
  return data as string;
};

// ── Auth helpers ──
export const signUp = async (
  email: string,
  password: string,
  fullName: string,
  role: 'customer' | 'provider'
) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role },
    },
  });
  if (error) throw error;

  // Profile creation is handled by the database auth trigger. The durable
  // integration event is queued after the user has a signed-in session.
  if (data.session && data.user) {
    await enqueueIntegrationEvent('user.created', 'oc_user', null, {
      auth_user_id: data.user.id,
      email,
      full_name: fullName,
      role,
    });
  }

  return data;
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getUser = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
};

export const getSession = async () => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
};

export const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
};

// ── Catalog helpers ──
export const getServiceCatalog = async (): Promise<MarketplaceService[]> => {
  const { data, error } = await supabase
    .from('oc_services')
    .select(
      'id, slug, name, description, pricing_model, base_price, minimum_price, duration_minutes, emergency_eligible, scheduled_eligible, category:oc_service_categories(id, slug, name, icon)'
    )
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data || []) as unknown as MarketplaceService[];
};

const resolveServiceId = async (
  serviceId: string | undefined,
  serviceName: string
): Promise<string | null> => {
  if (serviceId) return serviceId;

  const { data, error } = await supabase
    .from('oc_services')
    .select('id')
    .ilike('name', serviceName.trim())
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.id || null;
};

// Lookup oc_users.id from auth.users.id (auth_id).
export const getOcUserId = async (authId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('oc_users')
    .select('id')
    .eq('auth_id', authId)
    .single();
  if (error) return null;
  return data?.id || null;
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
  notes?: string;
}) => {
  const ocUserId = await getOcUserId(booking.customer_id);
  if (!ocUserId) throw new Error('No ON CALL customer profile found for this account');

  const resolvedServiceId = await resolveServiceId(
    booking.service_id,
    booking.service_name
  );

  const { data, error } = await supabase
    .from('oc_bookings')
    .insert({
      customer_id: ocUserId,
      service_id: resolvedServiceId,
      service_name: booking.service_name,
      category_name: booking.category_name || 'Home Services',
      status: 'pending',
      booking_type: booking.scheduled_at ? 'scheduled' : 'on_demand',
      address: booking.address,
      lat: booking.lat ?? null,
      lng: booking.lng ?? null,
      total_price: booking.total_price,
      estimated_price: booking.total_price,
      scheduled_at: booking.scheduled_at || null,
      notes: booking.notes || null,
    })
    .select()
    .single();

  if (error) throw error;

  await enqueueIntegrationEvent('booking.created', 'oc_booking', data.id, {
    booking_id: data.id,
    customer_id: ocUserId,
    service_id: resolvedServiceId,
    service_name: booking.service_name,
    category_name: booking.category_name || 'Home Services',
    total_price: booking.total_price,
    address: booking.address,
    booking_type: booking.scheduled_at ? 'scheduled' : 'on_demand',
    scheduled_at: booking.scheduled_at || null,
  });

  return data;
};

export const dispatchBooking = async (
  bookingId: string,
  options: { radiusMiles?: number; offerTtlSeconds?: number } = {}
): Promise<number> => {
  const { data, error } = await supabase.rpc('oc_dispatch_booking', {
    p_booking_id: bookingId,
    p_radius_miles: options.radiusMiles ?? 20,
    p_offer_ttl_seconds: options.offerTtlSeconds ?? 60,
  });
  if (error) throw error;
  return Number(data || 0);
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

export const getBookingEvents = async (bookingId: string) => {
  const { data, error } = await supabase
    .from('oc_booking_events')
    .select(
      'id, event_type, old_status, new_status, actor_type, metadata, lat, lng, created_at'
    )
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true });
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
  user_id: string;
  full_name: string;
  email: string;
  phone?: string;
  skills: string[];
  service_area?: string;
}) => {
  const ocUserId = await getOcUserId(providerData.user_id);
  if (!ocUserId) throw new Error('No ON CALL user profile found');

  const { data, error } = await supabase
    .from('oc_provider_profiles')
    .upsert({
      user_id: ocUserId,
      skills: providerData.skills,
      service_area_radius: 25,
      is_available: false,
      background_check_status: 'pending',
    })
    .select('id, user_id, background_check_status')
    .single();

  if (error) throw error;

  await enqueueIntegrationEvent('provider.application.created', 'oc_provider', data.id, {
    provider_id: data.id,
    user_id: ocUserId,
    full_name: providerData.full_name,
    email: providerData.email,
    phone: providerData.phone || null,
    skills: providerData.skills,
    service_area: providerData.service_area || null,
  });

  return data;
};

export const toggleAvailability = async (
  authUserId: string,
  isAvailable: boolean
) => {
  const ocUserId = await getOcUserId(authUserId);
  if (!ocUserId) throw new Error('No ON CALL user profile found');

  const { error } = await supabase
    .from('oc_provider_profiles')
    .update({ is_available: isAvailable })
    .eq('user_id', ocUserId);

  if (error) throw error;
};

export const updateProviderLocation = async (location: {
  lat: number;
  lng: number;
  heading?: number;
  accuracyMeters?: number;
  isOnline?: boolean;
}) => {
  const { data, error } = await supabase.rpc('oc_update_provider_location', {
    p_lat: location.lat,
    p_lng: location.lng,
    p_heading: location.heading ?? null,
    p_accuracy_meters: location.accuracyMeters ?? null,
    p_is_online: location.isOnline ?? true,
  });
  if (error) throw error;
  return data;
};

export const getProviderOffers = async () => {
  const { data, error } = await supabase
    .from('oc_booking_offers')
    .select(
      'id, booking_id, status, distance_miles, eta_minutes, payout_amount, offered_at, expires_at, booking:oc_bookings(id, service_name, category_name, address, estimated_price, scheduled_at, notes)'
    )
    .eq('status', 'offered')
    .gt('expires_at', new Date().toISOString())
    .order('offered_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const acceptBookingOffer = async (offerId: string) => {
  const { data, error } = await supabase.rpc('oc_accept_booking_offer', {
    p_offer_id: offerId,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data;
};

export const declineBookingOffer = async (
  offerId: string,
  reason: string | null = null
) => {
  const { data, error } = await supabase.rpc('oc_decline_booking_offer', {
    p_offer_id: offerId,
    p_reason: reason,
  });
  if (error) throw error;
  return Boolean(data);
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

export function subscribeToBooking(
  bookingId: string,
  onChange: (payload: unknown) => void
) {
  const channel = supabase
    .channel(`oc-booking-${bookingId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'oc_bookings',
        filter: `id=eq.${bookingId}`,
      },
      onChange
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'oc_booking_events',
        filter: `booking_id=eq.${bookingId}`,
      },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export const getCurrentProfileId = getCurrentOcUserId;
