import { supabase } from './supabase'

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
    user?: {
      full_name: string | null
    } | null
  } | null
}

export async function loadMarketplaceCatalog() {
  const [categoriesResult, servicesResult] = await Promise.all([
    supabase.from('oc_service_categories').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('oc_service_catalog').select('*').eq('is_active', true).order('category_id').order('sort_order'),
  ])
  if (categoriesResult.error) throw categoriesResult.error
  if (servicesResult.error) throw servicesResult.error
  return {
    categories: (categoriesResult.data || []) as MarketplaceCategory[],
    services: (servicesResult.data || []) as MarketplaceService[],
  }
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
  const { data, error } = await supabase.rpc('oc_request_catalog_service', {
    p_service_id: input.serviceId,
    p_address: input.address,
    p_lat: input.latitude ?? null,
    p_lng: input.longitude ?? null,
    p_scheduled_at: input.scheduledAt ?? null,
    p_recurring_rule: input.recurringRule ?? null,
    p_notes: input.notes ?? null,
  })
  if (error) throw error
  return data as MarketplaceBooking
}

export async function cancelMarketplaceBooking(bookingId: string) {
  const { data, error } = await supabase.rpc('oc_customer_cancel', { p_booking_id: bookingId })
  if (error) throw error
  const { data: payment } = await supabase.from('oc_booking_payments').select('id,status').eq('booking_id', bookingId).maybeSingle()
  if (payment && !['captured','transferred','partially_refunded','refunded','canceled'].includes(payment.status)) {
    const result = await supabase.functions.invoke('oc-cancel-payment', { body: { bookingId } })
    if (result.error) throw new Error(`Booking canceled, but payment authorization needs attention: ${result.error.message}`)
  }
  return data as MarketplaceBooking
}

export async function rateMarketplaceBooking(bookingId: string, rating: number) {
  const { data, error } = await supabase.rpc('oc_rate_booking', { p_booking_id: bookingId, p_rating: rating })
  if (error) throw error
  return data as MarketplaceBooking
}

export function bookingStage(status: string) {
  return ({
    pending: 'requested',
    matching: 'matching',
    assigned: 'assigned',
    en_route: 'en_route',
    on_site: 'on_site',
    working: 'working',
    completed: 'completed',
    canceled: 'canceled',
  } as Record<string,string>)[status] || 'requested'
}
