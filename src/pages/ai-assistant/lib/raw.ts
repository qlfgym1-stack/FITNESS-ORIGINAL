export interface AttendanceRow {
  check_in: string | null
  check_out: string | null
  type: string | null
}

export interface PosItem {
  id: string
  name: string
  price: number
  quantity: number
}

export interface PosTransactionRow {
  id: string
  total: number
  created_at: string
  items: PosItem[] | null
}

export interface ProductRow {
  id: string
  name: string
  price: number
  cost: number | null
  stock: number | null
  category: string | null
}

export interface PaymentRow {
  amount: number
  payment_date: string
}

export interface SubscriptionRow {
  id: string
  total_amount: number
  amount_paid: number
  status: string
  start_date: string
  end_date: string
  member_id: string
  member_name: string
  type_name: string
}

export interface MemberRow {
  id: string
  status: string
  created_at: string
  last_visit: string | null
}

export interface ExpenseRow {
  amount: number
  expense_date: string
}

export interface SalaryPaymentRow {
  amount: number
  payment_date: string
}
