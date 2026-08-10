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
export const stripeClientPublishableKeyConfigured = Boolean(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
export const hostedCheckoutFallbackConfigured = true;
export type MarketplacePaymentsHealth = {
  ready: boolean;
  stripe_server_credential: boolean;
  webhook_signature_secret: boolean;
  payments: string;
  webhooks: string;
  message: string;
};
export type OnCallServiceCoverage = {
  service_id: string;
  service_name: string;
  verified_supply_count: number;
  live_supply_count: number;
  has_verified_supply: boolean;
  has_live_supply: boolean;
};

let paymentHealthCache: { value: MarketplacePaymentsHealth; checkedAt: number } | null = null;
export const getMarketplacePaymentsHealth = async (force = false): Promise<MarketplacePaymentsHealth> => {
  if (!force && paymentHealthCache && Date.now() - paymentHealthCache.checkedAt < 30_000) return paymentHealthCache.value;
  const response = await fetch(`${supabaseUrl}/functions/v1/marketplace-payments-health`, { headers: { apikey: supabaseAnonKey }, cache: 'no-store' });
  const data = await response.json().catch(() => ({})) as Partial<MarketplacePaymentsHealth>;
  const value: MarketplacePaymentsHealth = {
    ready: Boolean(data.ready),
    stripe_server_credential: Boolean(data.stripe_server_credential),
    webhook_signature_secret: Boolean(data.webhook_signature_secret),
    payments: String(data.payments || 'unavailable'),
    webhooks: String(data.webhooks || 'unavailable'),
    message: String(data.message || 'ON CALL payment runtime is not ready.'),
  };
  paymentHealthCache = { value, checkedAt: Date.now() };
  return value;
};

export const assertMarketplacePaymentsReady = async () => {
  const health = await getMarketplacePaymentsHealth(true);
  if (!health.ready) throw new Error('ON CALL payments are temporarily unavailable while secure Stripe server credentials are being restored. No charge was attempted.');
  return health;
};

export const getOnCallServiceCoverage = async (serviceId?: string): Promise<OnCallServiceCoverage | OnCallServiceCoverage[] | null> => {
  const { data, error } = await supabase.rpc('oc_public_service_coverage_v2');
  if (error) throw new Error('ON CALL provider coverage could not be confirmed. No booking was created.');
  const rows = (data || []) as OnCallServiceCoverage[];
  if (!serviceId) return rows;
  return rows.find((row) => row.service_id === serviceId) || null;
};

export const assertOnCallServiceSupply = async (serviceId: string, scheduledAt?: string) => {
  const coverage = await getOnCallServiceCoverage(serviceId) as OnCallServiceCoverage | null;
  if (!coverage?.has_verified_supply) {
    throw new Error('No verified ON CALL provider can fulfill this service yet. No booking was created.');
  }
  if (!scheduledAt && !coverage.has_live_supply) {
    throw new Error('No verified ON CALL provider is on duty for this service right now. Schedule ahead or choose another service. No booking was created.');
  }
  return coverage;
};

export const signUp = async (email: string, password: string, fullName: string, role: 'customer' | 'provider') => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: ON_CALL_CONFIRM_URL,
      data: { full_name: fullName, app: 'on_call', requested_role: role },
    },
  });
  if (error) throw error;
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

export const signOut = async () => { await supabase.auth.signOut(); };
export const getUser = async () => { const { data: { user } } = await supabase.auth.getUser(); return user; };
export const getSession = async () => { const { data: { session } } = await supabase.auth.getSession(); return session; };
export const resetPassword = async (email: string) => { const { error } = await supabase.auth.resetPasswordForEmail(email); if (error) throw error; };

export const getOcUserId = async (authId: string): Promise<string | null> => {
  const { data } = await supabase.from('oc_users').select('id').eq('auth_id', authId).single();
  return data?.id || null;
};

const legacyResolveMarket = (address: string) => {
  const normalized = String(address || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const markets = [
    ['Atlanta','GA',['atlanta','atl']],['Charlotte','NC',['charlotte']],['Dallas','TX',['dallas']],['Houston','TX',['houston']],
    ['Las Vegas','NV',['las vegas','vegas']],['Los Angeles','CA',['los angeles']],['Miami','FL',['miami']],['New York','NY',['new york','nyc']],
    ['Phoenix','AZ',['phoenix']],['Washington','DC',['washington dc','washington','district of columbia']],
  ] as const;
  return markets.find(([,state,aliases]) => aliases.some(alias => normalized.includes(alias)) && new RegExp(`(^|\\s)${state.toLowerCase()}(\\s|$)`).test(normalized)) || null;
};

// Compatibility helper for older call sites. It still uses the controlled catalog/market
// RPC and now preflights the same verified/live provider supply enforced by the database.
export const createBooking = async (booking: {
  customer_id: string; service_id?: string; service_name: string; category_name: string; address: string;
  lat?: number; lng?: number; total_price: number; scheduled_at?: string;
}) => {
  const ocUserId = await getOcUserId(booking.customer_id);
  if (!ocUserId) throw new Error('No ON CALL customer profile found for this account');
  let serviceId = booking.service_id || '';
  if (!serviceId) {
    const { data: service, error: serviceError } = await supabase.from('oc_service_catalog').select('id').eq('name', booking.service_name).eq('is_active', true).limit(1).maybeSingle();
    if (serviceError) throw serviceError;
    serviceId = service?.id || '';
  }
  if (!serviceId) throw new Error('Selected ON CALL service is not in the active catalog.');
  await assertOnCallServiceSupply(serviceId, booking.scheduled_at);
  const market = legacyResolveMarket(booking.address);
  if (!market) throw new Error('Enter a full service address including a supported ON CALL city and state.');
  const { data, error } = await supabase.rpc('oc_request_market_service', {
    p_service_id: serviceId,
    p_address: booking.address,
    p_market_city: market[0],
    p_market_state: market[1],
    p_lat: booking.lat ?? null,
    p_lng: booking.lng ?? null,
    p_scheduled_at: booking.scheduled_at ?? null,
    p_recurring_rule: null,
    p_notes: null,
  });
  if (error) throw error;
  return data;
};

export const getBookings = async (authUserId: string) => {
  const ocUserId = await getOcUserId(authUserId); if (!ocUserId) return [];
  const { data, error } = await supabase.from('oc_bookings').select('*').eq('customer_id', ocUserId).order('created_at', { ascending: false });
  if (error) throw error; return data || [];
};

export const getProfile = async (authUserId: string) => {
  const { data, error } = await supabase.from('oc_users').select('*').eq('auth_id', authUserId).single();
  if (error) throw error; return data;
};

export const applyAsProvider = async () => { throw new Error('Use the verified ON CALL provider application at /apply. Provider profiles are activated server-side only after application approval.'); };

export const toggleAvailability = async (_authUserId: string, isAvailable: boolean) => {
  const { data, error } = await supabase.rpc('oc_provider_set_presence', { p_available: isAvailable, p_lat: null, p_lng: null, p_accuracy_meters: null, p_heading: null, p_speed_mph: null });
  if (error) throw error; return data;
};

export const getProviderProfile = async (authUserId: string) => {
  const ocUserId = await getOcUserId(authUserId); if (!ocUserId) return null;
  const { data, error } = await supabase.from('oc_provider_profiles').select('*').eq('user_id', ocUserId).single();
  if (error) return null; return data;
};

export const getProviderBookings = async () => {
  const { data, error } = await supabase.from('oc_bookings').select('*').order('created_at', { ascending: false });
  if (error) throw error; return data || [];
};

export const getAvailableOffers = async () => {
  const { data, error } = await supabase.rpc('oc_provider_opportunities'); if (error) throw error; return data || [];
};

export const acceptOffer = async (bookingId: string) => {
  const { data, error } = await supabase.rpc('oc_accept_offer', { p_booking_id: bookingId }); if (error) throw error; return data;
};

export const transitionBooking = async (bookingId: string, status: string) => {
  if (status === 'completed') {
    await assertMarketplacePaymentsReady();
    const { data, error } = await supabase.functions.invoke('oc-complete-service', { body: { bookingId } });
    if (error) throw error; if (!data?.ok) throw new Error(data?.error || 'Service completion needs attention'); return data.booking;
  }
  const { data, error } = await supabase.rpc('oc_provider_transition', { p_booking_id: bookingId, p_status: status });
  if (error) throw error; return data;
};

export const createBookingPayment = async (bookingId: string) => {
  await assertMarketplacePaymentsReady();
  if (stripeClientPublishableKeyConfigured) {
    const { data, error } = await supabase.functions.invoke('oc-create-payment', { body: { bookingId } });
    if (error) throw error;
    return data as { paymentId: string; clientSecret: string; status: string };
  }
  if (!hostedCheckoutFallbackConfigured) throw new Error('ON CALL secure checkout is unavailable. No charge was attempted.');
  const { data, error } = await supabase.functions.invoke('oc-create-checkout', { body: { bookingId, successUrl: `${ON_CALL_APP_URL}/?payment=authorized`, cancelUrl: `${ON_CALL_APP_URL}/?payment=canceled` } });
  if (error) throw error;
  if (data?.alreadyAuthorized) throw new Error('This ON CALL service is already payment-authorized.');
  if (!data?.checkoutUrl) throw new Error(data?.error || 'Secure hosted checkout could not be opened.');
  window.location.assign(data.checkoutUrl);
  return await new Promise<never>(() => {});
};

export const getBookingPayments = async () => {
  const { data, error } = await supabase.from('oc_booking_payments').select('*,booking:oc_bookings(service_name,status,created_at)').order('created_at', { ascending: false });
  if (error) throw error; return data || [];
};

export const startProviderOnboarding = async () => {
  await assertMarketplacePaymentsReady();
  const { data, error } = await supabase.functions.invoke('oc-connect-onboarding', { body: {} });
  if (error) throw error; if (!data?.url) throw new Error('Payout onboarding link was not created'); window.location.assign(data.url);
};

export const cancelBooking = async (bookingId: string, reason = 'Customer canceled from app') => {
  const { data: quote, error: quoteError } = await supabase.functions.invoke('oc-cancel-booking', { body: { bookingId, action: 'quote' } });
  if (quoteError) throw quoteError; if (quote?.error) throw new Error(quote.error); if (!quote?.canCancel) throw new Error(quote?.reason || 'Booking cannot be canceled');
  if (Number(quote.feeAmount || 0) > 0) await assertMarketplacePaymentsReady();
  const { data, error } = await supabase.functions.invoke('oc-cancel-booking', { body: { bookingId, action: 'cancel', expectedFeeAmount: Number(quote.feeAmount || 0), reason } });
  if (error) throw error; if (data?.error) throw new Error(data.error); return data?.booking || data;
};

export const rateBooking = async (bookingId: string, rating: number) => {
  const { data, error } = await supabase.rpc('oc_rate_booking', { p_booking_id: bookingId, p_rating: rating }); if (error) throw error; return data;
};
