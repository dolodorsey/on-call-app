import { assertOnCallServiceSupply, supabase } from './supabase'

export type MarketplaceCategory = {
  id: string
  name: string
  description: string | null
  icon_key: string | null
  sort_order: number
}

export type MarketplaceService = {
  id: string
  category_id: string
  name: string
  description: string | null
  base_price: number
  pricing_unit: string
  duration_minutes: number | null
  on_demand_available: boolean
  scheduled_available: boolean
  recurring_available: boolean
  icon_key: string | null
  image_url: string | null
  sort_order: number
}

export type MarketplaceBooking = {
  id: string
  service_id: string | null
  service_name: string
  category_name: string | null
  status: string
  address: string | null
  lat: number | null
  lng: number | null
  market_city?: string | null
  market_state?: string | null
  total_price: number
  scheduled_at: string | null
  request_type: string | null
  recurring_rule: string | null
  pricing_unit: string | null
  duration_minutes: number | null
  customer_notes: string | null
  provider_id: string | null
  created_at: string
  completed_at: string | null
  rating: number | null
  provider?: {
    id: string
    rating: number | null
    total_jobs: number | null
    user?: { full_name: string | null } | null
  } | null
}

export type CancellationQuote = {
  bookingId: string
  status: string
  canCancel: boolean
  feeAmount: number
  providerCompensation: number
  reason: string
  policyVersion: number
}

type ServiceMarket = { city: string; state: string; aliases: string[] }

const SERVICE_MARKETS: ServiceMarket[] = [
  { city:'Atlanta', state:'GA', aliases:['atlanta','atl'] },
  { city:'Charlotte', state:'NC', aliases:['charlotte'] },
  { city:'Dallas', state:'TX', aliases:['dallas'] },
  { city:'Houston', state:'TX', aliases:['houston'] },
  { city:'Las Vegas', state:'NV', aliases:['las vegas','vegas'] },
  { city:'Los Angeles', state:'CA', aliases:['los angeles'] },
  { city:'Miami', state:'FL', aliases:['miami'] },
  { city:'New York', state:'NY', aliases:['new york','nyc'] },
  { city:'Phoenix', state:'AZ', aliases:['phoenix'] },
  { city:'Washington', state:'DC', aliases:['washington dc','washington, dc','district of columbia'] },
]

function normalizeAddress(value: string) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
}

export function resolveServiceMarket(address: string): ServiceMarket | null {
  const normalized = normalizeAddress(address)
  for (const market of SERVICE_MARKETS) {
    const cityMatch = market.aliases.some(alias => normalized.includes(normalizeAddress(alias)))
    const stateMatch = new RegExp(`(^|\\s)${market.state.toLowerCase()}(\\s|$)`).test(normalized)
    if (cityMatch && stateMatch) return market
  }
  return null
}

export async function loadMarketplaceCatalog() {
  const [categoriesResult, servicesResult] = await Promise.all([
    supabase.from('oc_service_categories').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('oc_service_catalog').select('*').eq('is_active', true).order('category_id').order('sort_order'),
  ])
  if (categoriesResult.error) throw categoriesResult.error
  if (servicesResult.error) throw servicesResult.error
  return { categories: (categoriesResult.data || []) as MarketplaceCategory[], services: (servicesResult.data || []) as MarketplaceService[] }
}

export async function loadMarketplaceProfile(authId: string) {
  const { data, error } = await supabase.from('oc_users').select('*').eq('auth_id', authId).single()
  if (error) throw error
  return data
}

export async function loadMarketplaceBookings(customerId: string) {
  const { data, error } = await supabase
    .from('oc_bookings')
    .select('*,provider:oc_provider_profiles!oc_bookings_provider_id_fkey(id,rating,total_jobs,user:oc_users!oc_provider_profiles_user_id_fkey(full_name))')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as MarketplaceBooking[]
}

export async function createMarketplaceBooking(input: {
  serviceId: string
  address: string
  latitude?: number | null
  longitude?: number | null
  scheduledAt?: string | null
  recurringRule?: string | null
  notes?: string | null
}) {
  const market = resolveServiceMarket(input.address)
  if (!market) throw new Error('Enter a full service address including a supported ON CALL city and state, such as Atlanta, GA.')
  await assertOnCallServiceSupply(input.serviceId, input.scheduledAt || undefined)
  const { data, error } = await supabase.rpc('oc_request_market_service', {
    p_service_id: input.serviceId,
    p_address: input.address,
    p_market_city: market.city,
    p_market_state: market.state,
    p_lat: input.latitude ?? null,
    p_lng: input.longitude ?? null,
    p_scheduled_at: input.scheduledAt ?? null,
    p_recurring_rule: input.recurringRule ?? null,
    p_notes: input.notes ?? null,
  })
  if (error) throw error
  return data as MarketplaceBooking
}

export async function getMarketplaceCancellationQuote(bookingId: string) {
  const { data, error } = await supabase.functions.invoke('oc-cancel-booking', { body: { bookingId, action: 'quote' } })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data as CancellationQuote
}

export async function cancelMarketplaceBooking(bookingId: string) {
  const quote = await getMarketplaceCancellationQuote(bookingId)
  if (!quote.canCancel) throw new Error(quote.reason || 'Booking can no longer be self-canceled.')
  const fee = Number(quote.feeAmount || 0)
  const message = fee > 0
    ? `Cancel this service for a $${fee.toFixed(2)} late cancellation fee?\n\n${quote.reason}. $${Number(quote.providerCompensation || 0).toFixed(2)} of the fee is allocated to provider compensation.`
    : `Cancel this ON CALL service at no charge?\n\n${quote.reason}.`
  if (!window.confirm(message)) throw new Error('Cancellation was not confirmed.')
  const { data, error } = await supabase.functions.invoke('oc-cancel-booking', {
    body: { bookingId, action: 'cancel', expectedFeeAmount: fee, reason: quote.reason },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  const { data: booking, error: refreshError } = await supabase
    .from('oc_bookings')
    .select('*,provider:oc_provider_profiles!oc_bookings_provider_id_fkey(id,rating,total_jobs,user:oc_users!oc_provider_profiles_user_id_fkey(full_name))')
    .eq('id', bookingId)
    .single()
  if (refreshError) throw refreshError
  return booking as MarketplaceBooking
}

export async function rateMarketplaceBooking(bookingId: string, rating: number) {
  const { data, error } = await supabase.rpc('oc_rate_booking', { p_booking_id: bookingId, p_rating: rating })
  if (error) throw error
  return data as MarketplaceBooking
}

export function bookingStage(status: string) {
  return ({ pending:'requested',matching:'matching',assigned:'assigned',en_route:'en_route',on_site:'on_site',working:'working',completed:'completed',canceled:'canceled' } as Record<string,string>)[status] || 'requested'
}
