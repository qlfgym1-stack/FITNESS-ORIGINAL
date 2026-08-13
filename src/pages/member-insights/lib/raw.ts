export interface AttendanceRow {
  member_id: string | null
  check_in: string
  check_out: string | null
  type: string | null
}

export interface PaymentRow {
  id: string
  member_id: string
  subscription_id: string | null
  amount: number
  payment_method: string
  payment_date: string
  status: string
}

export interface SubscriptionRow {
  id: string
  member_id: string
  subscription_type_id: string
  start_date: string
  end_date: string
  total_amount: number
  amount_paid: number
  status: string
  type_name: string
  type_duration: number
  type_price: number
}

export interface MemberRow {
  id: string
  first_name: string
  last_name: string
  full_name: string | null
  status: string
  last_visit: string | null
  created_at: string
  coach_id: string | null
  corporate_id: string | null
}

export interface PosTransactionRow {
  id: string
  member_id: string | null
  total: number
  created_at: string
  items: Array<{ id: string; name: string; price: number; quantity: number }> | null
}

export interface CoachRow {
  id: string
  full_name: string
}
