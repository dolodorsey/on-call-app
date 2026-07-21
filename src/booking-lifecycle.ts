import { supabase } from './supabase';

type BookingStatus = 'en_route' | 'arrived' | 'in_progress' | 'completed';

export async function advanceBookingStatus(input: {
  bookingId: string;
  status: BookingStatus;
  lat?: number;
  lng?: number;
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await supabase.rpc('oc_advance_booking_status', {
    p_booking_id: input.bookingId,
    p_new_status: input.status,
    p_lat: input.lat ?? null,
    p_lng: input.lng ?? null,
    p_metadata: input.metadata ?? {},
  });
  if (error) throw error;
  return data;
}

export async function cancelBooking(bookingId: string, reason: string) {
  const { data, error } = await supabase.rpc('oc_cancel_booking', {
    p_booking_id: bookingId,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

export async function rateCompletedBooking(input: {
  bookingId: string;
  rating: number;
  review?: string;
  tags?: string[];
}) {
  const { data, error } = await supabase.rpc('oc_rate_completed_booking', {
    p_booking_id: input.bookingId,
    p_rating: input.rating,
    p_review: input.review ?? null,
    p_tags: input.tags ?? [],
  });
  if (error) throw error;
  return data;
}
