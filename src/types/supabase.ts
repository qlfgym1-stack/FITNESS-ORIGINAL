export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: { id: string; name: string; slug: string; logo_url: string | null; address: string | null; phone: string | null; email: string | null; created_at: string }
        Insert: { id?: string; name: string; slug: string; logo_url?: string | null; address?: string | null; phone?: string | null; email?: string | null; created_at?: string }
        Update: { id?: string; name?: string; slug?: string; logo_url?: string | null; address?: string | null; phone?: string | null; email?: string | null; created_at?: string }
        Relationships: []
      }
      user_roles: {
        Row: { id: string; user_id: string; organization_id: string; role: 'admin' | 'super_admin' | 'coach' | 'staff'; created_at: string }
        Insert: { id?: string; user_id: string; organization_id: string; role: 'admin' | 'super_admin' | 'coach' | 'staff'; created_at?: string }
        Update: { id?: string; user_id?: string; organization_id?: string; role?: 'admin' | 'super_admin' | 'coach' | 'staff'; created_at?: string }
        Relationships: []
      }
      members: {
        Row: { id: string; organization_id: string; first_name: string; last_name: string; email: string | null; phone: string | null; gender: string | null; birth_date: string | null; address: string | null; emergency_contact: string | null; emergency_phone: string | null; photo_url: string | null; status: 'active' | 'inactive' | 'suspended' | 'blocked'; last_visit: string | null; notes: string | null; created_at: string; updated_at: string; member_number: string | null }
        Insert: { id?: string; organization_id: string; first_name: string; last_name: string; email?: string | null; phone?: string | null; gender?: string | null; birth_date?: string | null; address?: string | null; emergency_contact?: string | null; emergency_phone?: string | null; photo_url?: string | null; status?: 'active' | 'inactive' | 'suspended' | 'blocked'; last_visit?: string | null; notes?: string | null; created_at?: string; updated_at?: string; member_number?: string | null }
        Update: { id?: string; organization_id?: string; first_name?: string; last_name?: string; email?: string | null; phone?: string | null; gender?: string | null; birth_date?: string | null; address?: string | null; emergency_contact?: string | null; emergency_phone?: string | null; photo_url?: string | null; status?: 'active' | 'inactive' | 'suspended' | 'blocked'; last_visit?: string | null; notes?: string | null; created_at?: string; updated_at?: string; member_number?: string | null }
        Relationships: []
      }
      subscription_types: {
        Row: { id: string; organization_id: string; name: string; description: string | null; duration_days: number; price: number; max_classes: number | null; is_active: boolean; created_at: string }
        Insert: { id?: string; organization_id: string; name: string; description?: string | null; duration_days: number; price: number; max_classes?: number | null; is_active?: boolean; created_at?: string }
        Update: { id?: string; organization_id?: string; name?: string; description?: string | null; duration_days?: number; price?: number; max_classes?: number | null; is_active?: boolean; created_at?: string }
        Relationships: []
      }
      member_subscriptions: {
        Row: { id: string; organization_id: string; member_id: string; subscription_type_id: string; start_date: string; end_date: string; total_amount: number; amount_paid: number; status: 'active' | 'expired' | 'cancelled' | 'pending_payment'; created_at: string }
        Insert: { id?: string; organization_id: string; member_id: string; subscription_type_id: string; start_date: string; end_date: string; total_amount: number; amount_paid?: number; status?: 'active' | 'expired' | 'cancelled' | 'pending_payment'; created_at?: string }
        Update: { id?: string; organization_id?: string; member_id?: string; subscription_type_id?: string; start_date?: string; end_date?: string; total_amount?: number; amount_paid?: number; status?: 'active' | 'expired' | 'cancelled' | 'pending_payment'; created_at?: string }
        Relationships: []
      }
      payments: {
        Row: { id: string; organization_id: string; member_id: string; subscription_id: string | null; amount: number; payment_date: string; payment_method: 'cash' | 'card' | 'transfer' | 'other'; status: 'completed' | 'pending' | 'cancelled'; notes: string | null; created_at: string }
        Insert: { id?: string; organization_id: string; member_id: string; subscription_id?: string | null; amount: number; payment_date?: string; payment_method: 'cash' | 'card' | 'transfer' | 'other'; status?: 'completed' | 'pending' | 'cancelled'; notes?: string | null; created_at?: string }
        Update: { id?: string; organization_id?: string; member_id?: string; subscription_id?: string | null; amount?: number; payment_date?: string; payment_method?: 'cash' | 'card' | 'transfer' | 'other'; status?: 'completed' | 'pending' | 'cancelled'; notes?: string | null; created_at?: string }
        Relationships: []
      }
      classes: {
        Row: { id: string; organization_id: string; name: string; description: string | null; coach_id: string | null; start_time: string; end_time: string; max_capacity: number | null; color: string | null; recurring: boolean; day_of_week: number | null; created_at: string }
        Insert: { id?: string; organization_id: string; name: string; description?: string | null; coach_id?: string | null; start_time: string; end_time: string; max_capacity?: number | null; color?: string | null; recurring?: boolean; day_of_week?: number | null; created_at?: string }
        Update: { id?: string; organization_id?: string; name?: string; description?: string | null; coach_id?: string | null; start_time?: string; end_time?: string; max_capacity?: number | null; color?: string | null; recurring?: boolean; day_of_week?: number | null; created_at?: string }
        Relationships: []
      }
      class_enrollments: {
        Row: { id: string; class_id: string; member_id: string; status: 'confirmed' | 'cancelled' | 'attended'; created_at: string }
        Insert: { id?: string; class_id: string; member_id: string; status?: 'confirmed' | 'cancelled' | 'attended'; created_at?: string }
        Update: { id?: string; class_id?: string; member_id?: string; status?: 'confirmed' | 'cancelled' | 'attended'; created_at?: string }
        Relationships: []
      }
      attendance: {
        Row: { id: string; organization_id: string; member_id: string; check_in: string | null; check_out: string | null; type: 'check-in' | 'class'; class_id: string | null; source: 'rfid' | 'manual' | 'app'; access_control_id: string | null; created_at: string }
        Insert: { id?: string; organization_id: string; member_id: string; check_in?: string | null; check_out?: string | null; type?: 'check-in' | 'class'; class_id?: string | null; source?: 'rfid' | 'manual' | 'app'; access_control_id?: string | null; created_at?: string }
        Update: { id?: string; organization_id?: string; member_id?: string; check_in?: string | null; check_out?: string | null; type?: 'check-in' | 'class'; class_id?: string | null; source?: 'rfid' | 'manual' | 'app'; access_control_id?: string | null; created_at?: string }
        Relationships: []
      }
      rfid_cards: {
        Row: { id: string; member_id: string; rfid_uid: string; status: 'ACTIF' | 'REMPLACÉ' | 'DÉSACTIVÉ' | 'PERDU' | 'VOLÉ' | 'BLACKLISTÉ' | 'ARCHIVÉ'; assigned_at: string; replaced_at: string | null; replaced_by: string | null; reason: string | null; notes: string | null; created_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; member_id: string; rfid_uid: string; status?: 'ACTIF' | 'REMPLACÉ' | 'DÉSACTIVÉ' | 'PERDU' | 'VOLÉ' | 'BLACKLISTÉ' | 'ARCHIVÉ'; assigned_at?: string; replaced_at?: string | null; replaced_by?: string | null; reason?: string | null; notes?: string | null; created_by?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; member_id?: string; rfid_uid?: string; status?: 'ACTIF' | 'REMPLACÉ' | 'DÉSACTIVÉ' | 'PERDU' | 'VOLÉ' | 'BLACKLISTÉ' | 'ARCHIVÉ'; assigned_at?: string; replaced_at?: string | null; replaced_by?: string | null; reason?: string | null; notes?: string | null; created_by?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      rfid_read_logs: {
        Row: { id: string; card_uid: string; member_id: string | null; terminal: string; event_type: 'check-in' | 'check-out' | 'denied'; result: 'granted' | 'denied' | 'pending'; reason: string | null; user_id: string | null; read_at: string }
        Insert: { id?: string; card_uid: string; member_id?: string | null; terminal: string; event_type: 'check-in' | 'check-out' | 'denied'; result: 'granted' | 'denied' | 'pending'; reason?: string | null; user_id?: string | null; read_at?: string }
        Update: { id?: string; card_uid?: string; member_id?: string | null; terminal?: string; event_type?: 'check-in' | 'check-out' | 'denied'; result?: 'granted' | 'denied' | 'pending'; reason?: string | null; user_id?: string | null; read_at?: string }
        Relationships: []
      }
      rfid_audit_log: {
        Row: { id: string; member_id: string; old_rfid_uid: string | null; new_rfid_uid: string; action: 'ASSIGN' | 'REPLACE' | 'DEACTIVATE' | 'REACTIVATE' | 'ARCHIVE'; reason: string | null; notes: string | null; created_by: string | null; ip_address: string | null; created_at: string }
        Insert: { id?: string; member_id: string; old_rfid_uid?: string | null; new_rfid_uid: string; action: 'ASSIGN' | 'REPLACE' | 'DEACTIVATE' | 'REACTIVATE' | 'ARCHIVE'; reason?: string | null; notes?: string | null; created_by?: string | null; ip_address?: string | null; created_at?: string }
        Update: { id?: string; member_id?: string; old_rfid_uid?: string | null; new_rfid_uid?: string; action?: 'ASSIGN' | 'REPLACE' | 'DEACTIVATE' | 'REACTIVATE' | 'ARCHIVE'; reason?: string | null; notes?: string | null; created_by?: string | null; ip_address?: string | null; created_at?: string }
        Relationships: []
      }
      turnstile_status: {
        Row: { id: string; organization_id: string; terminal: string; status: 'online' | 'offline' | 'fault'; last_heartbeat: string | null; updated_at: string }
        Insert: { id?: string; organization_id: string; terminal: string; status?: 'online' | 'offline' | 'fault'; last_heartbeat?: string | null; updated_at?: string }
        Update: { id?: string; organization_id?: string; terminal?: string; status?: 'online' | 'offline' | 'fault'; last_heartbeat?: string | null; updated_at?: string }
        Relationships: []
      }
      manual_validations: {
        Row: { id: string; organization_id: string; member_id: string; user_id: string; reason: 'breakdown' | 'maintenance' | 'emergency' | 'test' | 'other'; reason_detail: string | null; terminal: string | null; validated_at: string }
        Insert: { id?: string; organization_id: string; member_id: string; user_id: string; reason: 'breakdown' | 'maintenance' | 'emergency' | 'test' | 'other'; reason_detail?: string | null; terminal?: string | null; validated_at?: string }
        Update: { id?: string; organization_id?: string; member_id?: string; user_id?: string; reason?: 'breakdown' | 'maintenance' | 'emergency' | 'test' | 'other'; reason_detail?: string | null; terminal?: string | null; validated_at?: string }
        Relationships: []
      }
      staff: {
        Row: { id: string; organization_id: string; user_id: string | null; first_name: string; last_name: string; email: string | null; phone: string | null; role: string | null; salary: number | null; hire_date: string | null; is_active: boolean; created_at: string }
        Insert: { id?: string; organization_id: string; user_id?: string | null; first_name: string; last_name: string; email?: string | null; phone?: string | null; role?: string | null; salary?: number | null; hire_date?: string | null; is_active?: boolean; created_at?: string }
        Update: { id?: string; organization_id?: string; user_id?: string | null; first_name?: string; last_name?: string; email?: string | null; phone?: string | null; role?: string | null; salary?: number | null; hire_date?: string | null; is_active?: boolean; created_at?: string }
        Relationships: []
      }
      staff_timesheet: {
        Row: { id: string; staff_id: string; organization_id: string; date: string; clock_in: string | null; clock_out: string | null; break_start: string | null; break_end: string | null; total_hours: number | null; notes: string | null }
        Insert: { id?: string; staff_id: string; organization_id: string; date: string; clock_in?: string | null; clock_out?: string | null; break_start?: string | null; break_end?: string | null; total_hours?: number | null; notes?: string | null }
        Update: { id?: string; staff_id?: string; organization_id?: string; date?: string; clock_in?: string | null; clock_out?: string | null; break_start?: string | null; break_end?: string | null; total_hours?: number | null; notes?: string | null }
        Relationships: []
      }
      staff_shifts: {
        Row: { id: string; staff_id: string; organization_id: string; date: string; start_time: string; end_time: string; notes: string | null; created_at: string }
        Insert: { id?: string; staff_id: string; organization_id: string; date: string; start_time: string; end_time: string; notes?: string | null; created_at?: string }
        Update: { id?: string; staff_id?: string; organization_id?: string; date?: string; start_time?: string; end_time?: string; notes?: string | null; created_at?: string }
        Relationships: []
      }
      staff_leaves: {
        Row: { id: string; staff_id: string; organization_id: string; start_date: string; end_date: string; type: 'vacation' | 'sick' | 'personal'; status: 'pending' | 'approved' | 'rejected'; reason: string | null; created_at: string }
        Insert: { id?: string; staff_id: string; organization_id: string; start_date: string; end_date: string; type: 'vacation' | 'sick' | 'personal'; status?: 'pending' | 'approved' | 'rejected'; reason?: string | null; created_at?: string }
        Update: { id?: string; staff_id?: string; organization_id?: string; start_date?: string; end_date?: string; type?: 'vacation' | 'sick' | 'personal'; status?: 'pending' | 'approved' | 'rejected'; reason?: string | null; created_at?: string }
        Relationships: []
      }
      equipment: {
        Row: { id: string; organization_id: string; name: string; description: string | null; category: string | null; quantity: number; available_quantity: number; status: string | null; purchase_date: string | null; last_maintenance: string | null; created_at: string }
        Insert: { id?: string; organization_id: string; name: string; description?: string | null; category?: string | null; quantity?: number; available_quantity?: number; status?: string | null; purchase_date?: string | null; last_maintenance?: string | null; created_at?: string }
        Update: { id?: string; organization_id?: string; name?: string; description?: string | null; category?: string | null; quantity?: number; available_quantity?: number; status?: string | null; purchase_date?: string | null; last_maintenance?: string | null; created_at?: string }
        Relationships: []
      }
      equipment_reservations: {
        Row: { id: string; organization_id: string; equipment_id: string; member_id: string; start_time: string; end_time: string; status: 'confirmed' | 'cancelled' | 'completed'; created_at: string }
        Insert: { id?: string; organization_id: string; equipment_id: string; member_id: string; start_time: string; end_time: string; status?: 'confirmed' | 'cancelled' | 'completed'; created_at?: string }
        Update: { id?: string; organization_id?: string; equipment_id?: string; member_id?: string; start_time?: string; end_time?: string; status?: 'confirmed' | 'cancelled' | 'completed'; created_at?: string }
        Relationships: []
      }
      inventory: {
        Row: { id: string; organization_id: string; name: string; category: string | null; quantity: number; unit: string | null; min_stock: number | null; price: number | null; supplier_id: string | null; image_url: string | null; created_at: string }
        Insert: { id?: string; organization_id: string; name: string; category?: string | null; quantity?: number; unit?: string | null; min_stock?: number | null; price?: number | null; supplier_id?: string | null; image_url?: string | null; created_at?: string }
        Update: { id?: string; organization_id?: string; name?: string; category?: string | null; quantity?: number; unit?: string | null; min_stock?: number | null; price?: number | null; supplier_id?: string | null; image_url?: string | null; created_at?: string }
        Relationships: []
      }
      stock_movements: {
        Row: { id: string; inventory_id: string; organization_id: string; type: 'in' | 'out'; quantity: number; notes: string | null; created_at: string }
        Insert: { id?: string; inventory_id: string; organization_id: string; type: 'in' | 'out'; quantity: number; notes?: string | null; created_at?: string }
        Update: { id?: string; inventory_id?: string; organization_id?: string; type?: 'in' | 'out'; quantity?: number; notes?: string | null; created_at?: string }
        Relationships: []
      }
      suppliers: {
        Row: { id: string; organization_id: string; name: string; contact_name: string | null; email: string | null; phone: string | null; address: string | null; created_at: string }
        Insert: { id?: string; organization_id: string; name: string; contact_name?: string | null; email?: string | null; phone?: string | null; address?: string | null; created_at?: string }
        Update: { id?: string; organization_id?: string; name?: string; contact_name?: string | null; email?: string | null; phone?: string | null; address?: string | null; created_at?: string }
        Relationships: []
      }
      purchase_orders: {
        Row: { id: string; organization_id: string; supplier_id: string | null; order_date: string; status: string | null; total_amount: number | null; notes: string | null; created_at: string }
        Insert: { id?: string; organization_id: string; supplier_id?: string | null; order_date?: string; status?: string | null; total_amount?: number | null; notes?: string | null; created_at?: string }
        Update: { id?: string; organization_id?: string; supplier_id?: string | null; order_date?: string; status?: string | null; total_amount?: number | null; notes?: string | null; created_at?: string }
        Relationships: []
      }
      products: {
        Row: { id: string; organization_id: string; name: string; category: string | null; price: number; cost: number | null; stock: number | null; image_url: string | null; barcode: string | null; is_active: boolean; created_at: string }
        Insert: { id?: string; organization_id: string; name: string; category?: string | null; price: number; cost?: number | null; stock?: number | null; image_url?: string | null; barcode?: string | null; is_active?: boolean; created_at?: string }
        Update: { id?: string; organization_id?: string; name?: string; category?: string | null; price?: number; cost?: number | null; stock?: number | null; image_url?: string | null; barcode?: string | null; is_active?: boolean; created_at?: string }
        Relationships: []
      }
      pos_sessions: {
        Row: { id: string; organization_id: string; staff_id: string | null; opened_at: string; closed_at: string | null; status: 'open' | 'closed'; total: number | null }
        Insert: { id?: string; organization_id: string; staff_id?: string | null; opened_at?: string; closed_at?: string | null; status?: 'open' | 'closed'; total?: number | null }
        Update: { id?: string; organization_id?: string; staff_id?: string | null; opened_at?: string; closed_at?: string | null; status?: 'open' | 'closed'; total?: number | null }
        Relationships: []
      }
      pos_transactions: {
        Row: { id: string; session_id: string; organization_id: string; member_id: string | null; items: Json; subtotal: number; discount: number | null; total: number; payment_method: string | null; payment_status: string | null; created_at: string }
        Insert: { id?: string; session_id: string; organization_id: string; member_id?: string | null; items: Json; subtotal: number; discount?: number | null; total: number; payment_method?: string | null; payment_status?: string | null; created_at?: string }
        Update: { id?: string; session_id?: string; organization_id?: string; member_id?: string | null; items?: Json; subtotal?: number; discount?: number | null; total?: number; payment_method?: string | null; payment_status?: string | null; created_at?: string }
        Relationships: []
      }
      badges: {
        Row: { id: string; organization_id: string; name: string; description: string | null; color: string | null; icon: string | null; is_active: boolean; created_at: string }
        Insert: { id?: string; organization_id: string; name: string; description?: string | null; color?: string | null; icon?: string | null; is_active?: boolean; created_at?: string }
        Update: { id?: string; organization_id?: string; name?: string; description?: string | null; color?: string | null; icon?: string | null; is_active?: boolean; created_at?: string }
        Relationships: []
      }
      member_badges: {
        Row: { id: string; member_id: string; badge_id: string; assigned_at: string }
        Insert: { id?: string; member_id: string; badge_id: string; assigned_at?: string }
        Update: { id?: string; member_id?: string; badge_id?: string; assigned_at?: string }
        Relationships: []
      }
      access_control: {
        Row: { id: string; organization_id: string; name: string; type: 'turnstile' | 'door' | 'barrier'; device_id: string | null; is_active: boolean; created_at: string }
        Insert: { id?: string; organization_id: string; name: string; type: 'turnstile' | 'door' | 'barrier'; device_id?: string | null; is_active?: boolean; created_at?: string }
        Update: { id?: string; organization_id?: string; name?: string; type?: 'turnstile' | 'door' | 'barrier'; device_id?: string | null; is_active?: boolean; created_at?: string }
        Relationships: []
      }
      access_logs: {
        Row: { id: string; access_control_id: string; member_id: string | null; status: 'granted' | 'denied'; timestamp: string }
        Insert: { id?: string; access_control_id: string; member_id?: string | null; status: 'granted' | 'denied'; timestamp?: string }
        Update: { id?: string; access_control_id?: string; member_id?: string | null; status?: 'granted' | 'denied'; timestamp?: string }
        Relationships: []
      }
      notifications: {
        Row: { id: string; organization_id: string; user_id: string | null; title: string; body: string | null; message: string; type: string; is_read: boolean; data: Json | null; created_at: string }
        Insert: { id?: string; organization_id: string; user_id?: string | null; title: string; body?: string | null; message: string; type: string; is_read?: boolean; data?: Json | null; created_at?: string }
        Update: { id?: string; organization_id?: string; user_id?: string | null; title?: string; body?: string | null; message?: string; type?: string; is_read?: boolean; data?: Json | null; created_at?: string }
        Relationships: []
      }
      licenses: {
        Row: { id: string; organization_id: string; license_key: string; type: string | null; issued_at: string; expires_at: string | null; is_active: boolean; created_at: string }
        Insert: { id?: string; organization_id: string; license_key: string; type?: string | null; issued_at?: string; expires_at?: string | null; is_active?: boolean; created_at?: string }
        Update: { id?: string; organization_id?: string; license_key?: string; type?: string | null; issued_at?: string; expires_at?: string | null; is_active?: boolean; created_at?: string }
        Relationships: []
      }
      settings: {
        Row: { id: string; organization_id: string; key: string; value: Json; created_at: string }
        Insert: { id?: string; organization_id: string; key: string; value: Json; created_at?: string }
        Update: { id?: string; organization_id?: string; key?: string; value?: Json; created_at?: string }
        Relationships: []
      }
      corporate: {
        Row: { id: string; organization_id: string; company_name: string; contact_name: string | null; email: string | null; phone: string | null; address: string | null; discount_rate: number | null; contract_start: string | null; contract_end: string | null; is_active: boolean; created_at: string }
        Insert: { id?: string; organization_id: string; company_name: string; contact_name?: string | null; email?: string | null; phone?: string | null; address?: string | null; discount_rate?: number | null; contract_start?: string | null; contract_end?: string | null; is_active?: boolean; created_at?: string }
        Update: { id?: string; organization_id?: string; company_name?: string; contact_name?: string | null; email?: string | null; phone?: string | null; address?: string | null; discount_rate?: number | null; contract_start?: string | null; contract_end?: string | null; is_active?: boolean; created_at?: string }
        Relationships: []
      }
      student_verifications: {
        Row: { id: string; organization_id: string; member_id: string; school_name: string; student_id: string | null; document_url: string | null; verified: boolean; verified_at: string | null; created_at: string }
        Insert: { id?: string; organization_id: string; member_id: string; school_name: string; student_id?: string | null; document_url?: string | null; verified?: boolean; verified_at?: string | null; created_at?: string }
        Update: { id?: string; organization_id?: string; member_id?: string; school_name?: string; student_id?: string | null; document_url?: string | null; verified?: boolean; verified_at?: string | null; created_at?: string }
        Relationships: []
      }
      recovery_codes: {
        Row: { user_id: string; code_hash: string; created_at: string; last_used_at: string | null }
        Insert: { user_id: string; code_hash: string; created_at?: string; last_used_at?: string | null }
        Update: { user_id?: string; code_hash?: string; created_at?: string; last_used_at?: string | null }
        Relationships: []
      }
      recovery_code_logs: {
        Row: { id: string; user_id: string; attempted_at: string; success: boolean; ip_address: string | null; user_agent: string | null }
        Insert: { id?: string; user_id: string; attempted_at?: string; success: boolean; ip_address?: string | null; user_agent?: string | null }
        Update: { id?: string; user_id?: string; attempted_at?: string; success?: boolean; ip_address?: string | null; user_agent?: string | null }
        Relationships: []
      }
      wedding_programs: {
        Row: { id: string; organization_id: string; name: string; description: string | null; duration_days: number; price: number; max_participants: number | null; is_active: boolean; created_at: string }
        Insert: { id?: string; organization_id: string; name: string; description?: string | null; duration_days: number; price: number; max_participants?: number | null; is_active?: boolean; created_at?: string }
        Update: { id?: string; organization_id?: string; name?: string; description?: string | null; duration_days?: number; price?: number; max_participants?: number | null; is_active?: boolean; created_at?: string }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Organization = Tables<'organizations'>
export type UserRole = Tables<'user_roles'>
export type Member = Tables<'members'>
export type SubscriptionType = Tables<'subscription_types'>
export type MemberSubscription = Tables<'member_subscriptions'>
export type Payment = Tables<'payments'>
export type Class = Tables<'classes'>
export type Attendance = Tables<'attendance'>
export type Staff = Tables<'staff'>
export type StaffTimesheet = Tables<'staff_timesheet'>
export type StaffShift = Tables<'staff_shifts'>
export type StaffLeave = Tables<'staff_leaves'>
export type Equipment = Tables<'equipment'>
export type EquipmentReservation = Tables<'equipment_reservations'>
export type Inventory = Tables<'inventory'>
export type Supplier = Tables<'suppliers'>
export type PurchaseOrder = Tables<'purchase_orders'>
export type Product = Tables<'products'>
export type PosSession = Tables<'pos_sessions'>
export type PosTransaction = Tables<'pos_transactions'>
export type Badge = Tables<'badges'>
export type AccessControl = Tables<'access_control'>
export type Notification = Tables<'notifications'>
export type License = Tables<'licenses'>
export type Setting = Tables<'settings'>
export type Corporate = Tables<'corporate'>
export type RfidCard = Tables<'rfid_cards'>
export type RfidCardAudit = Tables<'rfid_audit_log'>
export type RfidReadLog = Tables<'rfid_read_logs'>
export type TurnstileStatus = Tables<'turnstile_status'>
export type ManualValidation = Tables<'manual_validations'>
