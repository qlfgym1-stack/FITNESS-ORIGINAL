import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@/hooks/useQuery'
import { useSupabase } from '@/hooks/useSupabase'
import { useAuth } from '@/stores/auth'
import { IS_MOCK } from '@/lib/config'
import { useT } from '@/i18n'
import { useToast } from '@/components/ui/toast'
import { PageHeader } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Download, Upload, Pencil, Trash2, Loader2, Shield, CreditCard, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react'
import { Pagination } from '@/components/ui/pagination'
import { useExportCsv } from '@/hooks/useExportCsv'
import { formatDate, getInitials, getStatusColor, toUpper, formatCurrency, formatPhone, isValidDzPhone, displayPhone } from '@/lib/utils'
import type { Member, SubscriptionType, RfidCard } from '@/types/supabase'
import { RfidManagementDialog, RfidCreateSection } from './rfid-management'
import { AvatarUpload } from '@/components/ui/avatar-upload'
import { CameraCapture } from '@/components/ui/camera-capture'

const MOCK_MEMBERS: Member[] = [
  { id: 'mock-1', organization_id: 'mock-org-id', first_name: 'Ahmed', last_name: 'Benali', email: 'ahmed@example.com', phone: '0555123456', gender: 'male', birth_date: '1990-05-15', address: 'Alger Centre', emergency_contact: 'Fatima Benali', emergency_phone: '0555654321', photo_url: null, status: 'active', last_visit: new Date().toISOString(), notes: null, created_at: new Date(Date.now() - 86400000 * 30).toISOString(), updated_at: new Date().toISOString(), member_number: 'QLF-00001', coach_id: null },
  { id: 'mock-2', organization_id: 'mock-org-id', first_name: 'Sara', last_name: 'Mansouri', email: 'sara@example.com', phone: '0666987654', gender: 'female', birth_date: '1995-08-22', address: 'Bab Ezzouar', emergency_contact: 'Karim Mansouri', emergency_phone: '0666543210', photo_url: null, status: 'active', last_visit: new Date(Date.now() - 86400000 * 2).toISOString(), notes: null, created_at: new Date(Date.now() - 86400000 * 60).toISOString(), updated_at: new Date().toISOString(), member_number: 'QLF-00002', coach_id: null },
  { id: 'mock-3', organization_id: 'mock-org-id', first_name: 'Mohamed', last_name: 'Hadj', email: 'mohamed@example.com', phone: '0777112233', gender: 'male', birth_date: '1988-12-01', address: 'Hydra', emergency_contact: 'Aicha Hadj', emergency_phone: '0777332211', photo_url: null, status: 'active', last_visit: new Date(Date.now() - 86400000 * 5).toISOString(), notes: null, created_at: new Date(Date.now() - 86400000 * 90).toISOString(), updated_at: new Date().toISOString(), member_number: 'QLF-00003', coach_id: null },
  { id: 'mock-4', organization_id: 'mock-org-id', first_name: 'Nadia', last_name: 'Bouzid', email: 'nadia@example.com', phone: '0555445566', gender: 'female', birth_date: '2000-03-10', address: 'Kouba', emergency_contact: 'Samir Bouzid', emergency_phone: '0555665544', photo_url: null, status: 'inactive', last_visit: new Date(Date.now() - 86400000 * 45).toISOString(), notes: null, created_at: new Date(Date.now() - 86400000 * 120).toISOString(), updated_at: new Date().toISOString(), member_number: 'QLF-00004', coach_id: null },
  { id: 'mock-5', organization_id: 'mock-org-id', first_name: 'Reda', last_name: 'Khelifi', email: 'reda@example.com', phone: '0666778899', gender: 'male', birth_date: '1992-07-20', address: 'Bir Mourad Rais', emergency_contact: 'Zineb Khelifi', emergency_phone: '0666998877', photo_url: null, status: 'active', last_visit: new Date(Date.now() - 86400000).toISOString(), notes: null, created_at: new Date(Date.now() - 86400000 * 15).toISOString(), updated_at: new Date().toISOString(), member_number: 'QLF-00005', coach_id: null },
  { id: 'mock-6', organization_id: 'mock-org-id', first_name: 'Amel', last_name: 'Zitouni', email: 'amel@example.com', phone: '0777001122', gender: 'female', birth_date: '1998-11-05', address: 'El Harrach', emergency_contact: 'Rachid Zitouni', emergency_phone: '0777221100', photo_url: null, status: 'active', last_visit: new Date().toISOString(), notes: null, created_at: new Date(Date.now() - 86400000 * 7).toISOString(), updated_at: new Date().toISOString(), member_number: 'QLF-00006', coach_id: null },
  { id: 'mock-7', organization_id: 'mock-org-id', first_name: 'Youcef', last_name: 'Belaid', email: 'youcef@example.com', phone: '0555889900', gender: 'male', birth_date: '1985-09-30', address: 'Ben Aknoun', emergency_contact: 'Meriem Belaid', emergency_phone: '0555009988', photo_url: null, status: 'inactive', last_visit: new Date(Date.now() - 86400000 * 60).toISOString(), notes: null, created_at: new Date(Date.now() - 86400000 * 200).toISOString(), updated_at: new Date().toISOString(), member_number: 'QLF-00007', coach_id: null },
  { id: 'mock-8', organization_id: 'mock-org-id', first_name: 'Lina', last_name: 'Toumi', email: 'lina@example.com', phone: '0666334455', gender: 'female', birth_date: '2002-01-15', address: 'Dely Ibrahim', emergency_contact: 'Hocine Toumi', emergency_phone: '0666554433', photo_url: null, status: 'active', last_visit: new Date(Date.now() - 86400000 * 3).toISOString(), notes: null, created_at: new Date(Date.now() - 86400000 * 45).toISOString(), updated_at: new Date().toISOString(), member_number: 'QLF-00008', coach_id: null },
  { id: 'mock-9', organization_id: 'mock-org-id', first_name: 'Karim', last_name: 'Saidi', email: 'karim@example.com', phone: '0777667788', gender: 'male', birth_date: '1991-04-18', address: 'Oued Smar', emergency_contact: 'Nora Saidi', emergency_phone: '0777887766', photo_url: null, status: 'active', last_visit: new Date(Date.now() - 86400000 * 10).toISOString(), notes: null, created_at: new Date(Date.now() - 86400000 * 80).toISOString(), updated_at: new Date().toISOString(), member_number: 'QLF-00009', coach_id: null },
  { id: 'mock-10', organization_id: 'mock-org-id', first_name: 'Samira', last_name: 'Guerfi', email: 'samira@example.com', phone: '0555112233', gender: 'female', birth_date: '1994-06-25', address: 'Bordj El Kiffan', emergency_contact: 'Ali Guerfi', emergency_phone: '0555332211', photo_url: null, status: 'active', last_visit: new Date(Date.now() - 86400000 * 1).toISOString(), notes: null, created_at: new Date(Date.now() - 86400000 * 35).toISOString(), updated_at: new Date().toISOString(), member_number: 'QLF-00010', coach_id: null },
  { id: 'mock-11', organization_id: 'mock-org-id', first_name: 'Hichem', last_name: 'Mazari', email: 'hichem@example.com', phone: '0666445566', gender: 'male', birth_date: '1987-10-12', address: 'Dar El Beida', emergency_contact: 'Salima Mazari', emergency_phone: '0666665544', photo_url: null, status: 'inactive', last_visit: new Date(Date.now() - 86400000 * 90).toISOString(), notes: null, created_at: new Date(Date.now() - 86400000 * 150).toISOString(), updated_at: new Date().toISOString(), member_number: 'QLF-00011', coach_id: null },
  { id: 'mock-12', organization_id: 'mock-org-id', first_name: 'Fatima', last_name: 'Ouali', email: 'fatima@example.com', phone: '0777556677', gender: 'female', birth_date: '1996-02-28', address: 'Birkhadem', emergency_contact: 'Mustapha Ouali', emergency_phone: '0777776655', photo_url: null, status: 'active', last_visit: new Date(Date.now() - 86400000 * 4).toISOString(), notes: null, created_at: new Date(Date.now() - 86400000 * 50).toISOString(), updated_at: new Date().toISOString(), member_number: 'QLF-00012', coach_id: null },
]

const memberSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  gender: z.string().optional().or(z.literal('')),
  birth_date: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  emergency_contact: z.string().optional().or(z.literal('')),
  emergency_phone: z.string().optional().or(z.literal('')),
  subscription_type_id: z.string().optional().or(z.literal('')),
  start_date: z.string().optional().or(z.literal('')),
  coach_id: z.string().optional().or(z.literal('')),
})

type MemberForm = z.infer<typeof memberSchema>

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (data: any[]) => void
  t: (key: string) => string
}

function ImportDialog({ open, onOpenChange, onImport, t: tFn }: ImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const ExcelJS = await import("exceljs")
    const reader = new FileReader()
    reader.onload = async (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer)
      const wb = new ExcelJS.default.Workbook()
      await wb.xlsx.load(data.buffer)
      const ws = wb.worksheets[0]
      const headers: string[] = []
      ws.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value ?? '')
      })
      const json: Record<string, unknown>[] = []
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return
        const obj: Record<string, unknown> = {}
        row.eachCell((cell, colNumber) => {
          obj[headers[colNumber - 1]] = cell.value ?? ''
        })
        json.push(obj)
      })
      onImport(json)
      onOpenChange(false)
    }
    reader.onerror = () => {
      console.error('Failed to read file')
    }
    reader.readAsArrayBuffer(file)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tFn('members.importFromExcel')}</DialogTitle>
          <DialogDescription>{tFn('members.importDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tFn('common.cancel')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const MOCK_SUBSCRIPTION_TYPES: SubscriptionType[] = [
  { id: 'mock-st-1', organization_id: 'mock-org', name: 'Séance Libre', description: 'Sans coach', duration_days: 1, price: 300, max_classes: 1, is_active: true, created_at: new Date().toISOString() },
  { id: 'mock-st-2', organization_id: 'mock-org', name: '1 Mois', description: 'Sans coach — 30 jours', duration_days: 30, price: 2400, max_classes: null, is_active: true, created_at: new Date().toISOString() },
  { id: 'mock-st-3', organization_id: 'mock-org', name: '3 Mois', description: 'Sans coach — 90 jours', duration_days: 90, price: 6600, max_classes: null, is_active: true, created_at: new Date().toISOString() },
  { id: 'mock-st-4', organization_id: 'mock-org', name: '6 Mois', description: 'Sans coach — 180 jours', duration_days: 180, price: 12000, max_classes: null, is_active: true, created_at: new Date().toISOString() },
  { id: 'mock-st-5', organization_id: 'mock-org', name: '12 Mois', description: 'Sans coach — 365 jours', duration_days: 365, price: 22800, max_classes: null, is_active: true, created_at: new Date().toISOString() },
  { id: 'mock-st-6', organization_id: 'mock-org', name: 'Séance Libre', description: 'Avec coach — 1 séance', duration_days: 1, price: 600, max_classes: 1, is_active: true, created_at: new Date().toISOString() },
  { id: 'mock-st-7', organization_id: 'mock-org', name: '1 Mois', description: 'Avec coach — 30 jours', duration_days: 30, price: 3000, max_classes: null, is_active: true, created_at: new Date().toISOString() },
  { id: 'mock-st-8', organization_id: 'mock-org', name: '3 Mois', description: 'Avec coach — 90 jours', duration_days: 90, price: 8400, max_classes: null, is_active: true, created_at: new Date().toISOString() },
  { id: 'mock-st-9', organization_id: 'mock-org', name: '6 Mois', description: 'Avec coach — 180 jours', duration_days: 180, price: 15000, max_classes: null, is_active: true, created_at: new Date().toISOString() },
  { id: 'mock-st-10', organization_id: 'mock-org', name: '12 Mois', description: 'Avec coach — 365 jours', duration_days: 365, price: 28800, max_classes: null, is_active: true, created_at: new Date().toISOString() },
]

export default function Members() {
  const t = useT()
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { organization, user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const orgId = organization?.id

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [genderFilter, setGenderFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [sortBy, setSortBy] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [deletingMember, setDeletingMember] = useState<Member | null>(null)
  const [avatarUploadedUrl, setAvatarUploadedUrl] = useState<string | null>(null)
  const photoUrlRef = useRef<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const tempMemberIdRef = useRef(crypto.randomUUID())
  const [mockMembers, setMockMembers] = useState<Member[]>(MOCK_MEMBERS)
  const [mockSubMap, setMockSubMap] = useState<Record<string, { id: string; subscription_type_id: string; name: string; status: string; total_amount: number }>>({
    'mock-1': { id: 'mock-ms-1', subscription_type_id: 'mock-st-2', name: '1 Mois', status: 'active', total_amount: 2400 },
    'mock-2': { id: 'mock-ms-2', subscription_type_id: 'mock-st-8', name: '3 Mois', status: 'active', total_amount: 8400 },
    'mock-3': { id: 'mock-ms-3', subscription_type_id: 'mock-st-5', name: '12 Mois', status: 'active', total_amount: 22800 },
    'mock-4': { id: 'mock-ms-4', subscription_type_id: 'mock-st-6', name: 'Séance Libre', status: 'expired', total_amount: 600 },
    'mock-5': { id: 'mock-ms-5', subscription_type_id: 'mock-st-10', name: '12 Mois', status: 'active', total_amount: 28800 },
    'mock-6': { id: 'mock-ms-6', subscription_type_id: 'mock-st-2', name: '1 Mois', status: 'active', total_amount: 2400 },
    'mock-7': { id: 'mock-ms-7', subscription_type_id: 'mock-st-6', name: 'Séance Libre', status: 'expired', total_amount: 600 },
    'mock-8': { id: 'mock-ms-8', subscription_type_id: 'mock-st-3', name: '3 Mois', status: 'active', total_amount: 6600 },
    'mock-9': { id: 'mock-ms-9', subscription_type_id: 'mock-st-5', name: '12 Mois', status: 'active', total_amount: 22800 },
    'mock-10': { id: 'mock-ms-10', subscription_type_id: 'mock-st-2', name: '1 Mois', status: 'active', total_amount: 2400 },
    'mock-11': { id: 'mock-ms-11', subscription_type_id: 'mock-st-6', name: 'Séance Libre', status: 'expired', total_amount: 600 },
    'mock-12': { id: 'mock-ms-12', subscription_type_id: 'mock-st-10', name: '12 Mois', status: 'active', total_amount: 28800 },
  })
  const [mockRfidMap, setMockRfidMap] = useState<Record<string, string>>({})
  const rfidManagementQuery = useQuery({
    queryKey: ['member-rfid-active', orgId],
    queryFn: async () => {
      if (!orgId || IS_MOCK) return {}
      const { data: members } = await supabase.from('members').select('id, rfid_cards(rfid_uid, status)').eq('organization_id', orgId)
      const map: Record<string, { rfid_uid: string; status: string } | null> = {}
      for (const m of (members || []) as any[]) {
        const cards = (m as any).rfid_cards
        const active = Array.isArray(cards) ? cards.find((c: any) => c.status === 'ACTIF') : null
        if (active) map[m.id] = { rfid_uid: active.rfid_uid, status: active.status }
      }
      return map
    },
    enabled: !!orgId && !IS_MOCK,
  })
  const [rfidUid, setRfidUid] = useState('')
  const [rfidDialogMember, setRfidDialogMember] = useState<{ id: string; name: string } | null>(null)
  const rfidData = rfidManagementQuery.data as Record<string, { rfid_uid: string; status: string } | null> || {}

  const pageSize = 10

  const { data: subscriptionTypes } = useQuery({
    queryKey: ['subscription-types', orgId],
    queryFn: async () => {
      if (!orgId) return []
      if (IS_MOCK) return MOCK_SUBSCRIPTION_TYPES
      const { data } = await supabase.from('subscription_types').select('*').eq('organization_id', orgId).eq('is_active', true).order('name')
      return (data ?? []) as SubscriptionType[]
    },
    enabled: !!orgId,
  })

  const { data: coaches } = useQuery({
    queryKey: ['coaches-list', orgId],
    queryFn: async () => {
      if (!orgId) return []
      if (IS_MOCK) return [{ id: 'mock-coach-1', first_name: 'Karim', last_name: 'Benali' }]
      const { data: staffList } = await supabase.from('staff').select('id, first_name, last_name').eq('organization_id', orgId).eq('is_active', true).order('first_name')
      return (staffList ?? []) as { id: string; first_name: string; last_name: string }[]
    },
    enabled: !!orgId,
  })

  const { data: memberSubMapQuery } = useQuery({
    queryKey: ['member-subscriptions-map', orgId],
    queryFn: async () => {
      if (!orgId) return {}
      const { data } = await supabase
        .from('member_subscriptions')
        .select('id, member_id, subscription_type_id, subscription_types!inner(name), status, total_amount')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
      const map: Record<string, { id: string; subscription_type_id: string; name: string; status: string; total_amount: number }> = {}
      for (const ms of (data || []) as any[]) {
        if (!map[ms.member_id]) {
          map[ms.member_id] = { id: ms.id, subscription_type_id: ms.subscription_type_id, name: ms.subscription_types?.name || '—', status: ms.status, total_amount: ms.total_amount }
        }
      }
      return map
    },
    enabled: !!orgId && !IS_MOCK,
  })
  const memberSubMap = IS_MOCK ? mockSubMap : (memberSubMapQuery ?? {})

  const form = useForm<MemberForm>({
    resolver: zodResolver(memberSchema),
    defaultValues: { first_name: '', last_name: '', email: '', phone: '', gender: '', birth_date: '', address: '', emergency_contact: '', emergency_phone: '', subscription_type_id: '', start_date: new Date().toISOString().split('T')[0], coach_id: '' },
  })

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data: membersData, isLoading } = useQuery({
    queryKey: ['members', orgId, debouncedSearch, statusFilter, genderFilter, page, sortBy, sortDir],
    queryFn: async () => {
      if (!orgId) return { data: [], count: 0 }
      if (IS_MOCK) {
        let filtered = [...mockMembers]
        if (search) {
          const q = search.toLowerCase()
          filtered = filtered.filter(m => m.first_name.toLowerCase().includes(q) || m.last_name.toLowerCase().includes(q) || (m.email && m.email.toLowerCase().includes(q)) || (m.phone && m.phone.includes(q)) || (m.member_number && m.member_number.toLowerCase().includes(q)))
        }
        if (statusFilter !== 'all') filtered = filtered.filter(m => m.status === statusFilter)
        if (genderFilter !== 'all') filtered = filtered.filter(m => m.gender === genderFilter)
        filtered.sort((a, b) => {
          const aVal = String(a[sortBy as keyof typeof a] ?? '')
          const bVal = String(b[sortBy as keyof typeof b] ?? '')
          return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
        })
        const from = page * pageSize
        const to = from + pageSize
        return { data: filtered.slice(from, to), count: filtered.length }
      }
      let query = supabase.from('members').select('*', { count: 'exact' }).eq('organization_id', orgId)
      query = query.order(sortBy, { ascending: sortDir === 'asc' })

      if (debouncedSearch) {
        query = query.or(`first_name.ilike.%${debouncedSearch}%,last_name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%,member_number.ilike.%${debouncedSearch}%`)
      }
      if (statusFilter !== 'all') query = query.eq('status', statusFilter as any)
      if (genderFilter !== 'all') query = query.eq('gender', genderFilter)

      const from = page * pageSize
      const to = from + pageSize - 1
      const { data, count } = await query.range(from, to)
      return { data: (data ?? []) as Member[], count: count ?? 0 }
    },
    enabled: !!orgId,
  })

  const { exportCsv } = useExportCsv(
    (membersData?.data ?? []).map((m: Member) => ({
      first_name: m.first_name,
      last_name: m.last_name,
      email: m.email ?? '',
      phone: formatPhone(m.phone) ?? '',
      gender: m.gender ?? '',
      status: m.status,
    })),
    'members',
    [
      { key: 'first_name', label: t('members.firstName') },
      { key: 'last_name', label: t('members.lastName') },
      { key: 'email', label: t('members.email') },
      { key: 'phone', label: t('members.phone') },
      { key: 'gender', label: t('members.gender') },
      { key: 'status', label: t('common.status') },
    ]
  )

  function handleSort(column: string) {
    setPage(0)
    if (sortBy === column) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortDir('asc')
    }
  }

  const createMutation = useMutation({
    mutationFn: async (values: MemberForm) => {
      if (!orgId) throw new Error('No organization')
      const photo_url: string | null = photoUrlRef.current
      if (IS_MOCK) {
        const memberId = `mock-${crypto.randomUUID()}`
        const nextNum = mockMembers.length + 1
        const memberNumber = `QLF-${String(nextNum).padStart(5, '0')}`
        const newMember: Member = {
          id: memberId,
          organization_id: orgId,
          first_name: values.first_name,
          last_name: values.last_name,
          email: values.email || null,
          phone: values.phone || null,
          gender: values.gender || null,
          birth_date: values.birth_date || null,
          address: values.address || null,
          emergency_contact: values.emergency_contact || null,
          emergency_phone: values.emergency_phone || null,
          photo_url,
          status: 'active',
          last_visit: null,
          notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          member_number: memberNumber,
          coach_id: values.coach_id || null,
        }
        setMockMembers(prev => [newMember, ...prev])
        if (values.subscription_type_id && values.start_date) {
          const typeDef = subscriptionTypes?.find(t => t.id === values.subscription_type_id)
          if (typeDef) {
            const subId = `mock-sub-${crypto.randomUUID()}`
            setMockSubMap(prev => ({ ...prev, [memberId]: { id: subId, subscription_type_id: values.subscription_type_id!, name: typeDef.name, status: 'pending_payment', total_amount: typeDef.price } }))
            if (rfidUid) setMockRfidMap(prev => ({ ...prev, [memberId]: rfidUid }))
            return { member_id: memberId, subscription_id: subId, total_amount: typeDef.price, subscription_name: typeDef.name, organization_id: orgId, first_name: values.first_name, last_name: values.last_name }
          }
        }
        if (rfidUid) setMockRfidMap(prev => ({ ...prev, [memberId]: rfidUid }))
        return null
      }
      if (values.subscription_type_id && values.start_date) {
        const { data, error } = await (supabase.rpc as any)('create_member_with_pending_subscription', {
          p_organization_id: orgId,
          p_first_name: values.first_name,
          p_last_name: values.last_name,
          p_email: values.email || null,
          p_phone: values.phone || null,
          p_gender: values.gender || null,
          p_birth_date: values.birth_date || null,
          p_address: values.address || null,
          p_emergency_contact: values.emergency_contact || null,
          p_emergency_phone: values.emergency_phone || null,
          p_photo_url: photo_url,
          p_subscription_type_id: values.subscription_type_id,
          p_start_date: values.start_date,
        })
        if (error) throw error
        if (values.coach_id) {
          await supabase.from('members').update({ coach_id: values.coach_id }).eq('id', data.member_id)
        }
        if (rfidUid) {
          await (supabase.rpc as any)('assign_rfid_card', {
            p_member_id: data.member_id, p_rfid_uid: rfidUid, p_created_by: user?.id || null,
          })
        }
        return data as { member_id: string; subscription_id: string; total_amount: number; subscription_name: string; organization_id: string; first_name: string; last_name: string }
      }
      const { subscription_type_id, start_date, ...memberFields } = values
      const { error } = await supabase.from('members').insert({ ...memberFields, organization_id: orgId, photo_url, email: values.email || null, phone: values.phone || null, gender: values.gender || null, birth_date: values.birth_date || null, address: values.address || null, emergency_contact: values.emergency_contact || null, emergency_phone: values.emergency_phone || null, coach_id: memberFields.coach_id || null } as any)
      if (error) throw error
      if (rfidUid) {
        const { data: newMember } = await supabase.from('members').select('id').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(1).single()
        if (newMember) {
          await (supabase.rpc as any)('assign_rfid_card', {
            p_member_id: newMember.id, p_rfid_uid: rfidUid, p_created_by: user?.id || null,
          })
        }
      }
      return null
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['members-list'] })
      queryClient.invalidateQueries({ queryKey: ['members-active'] })
      queryClient.invalidateQueries({ queryKey: ['inactive-members'] })
      queryClient.invalidateQueries({ queryKey: ['expiring-subscriptions'] })
      if (data) {
        closeDialog()
        navigate('/pos', { state: { pendingSubscription: data } })
      } else {
        closeDialog()
        toast({ title: t('members.memberAdded') })
      }
    },
    onError: (err) => toast({ variant: 'destructive', title: t('errors.generic'), description: err.message }),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: MemberForm }) => {
      if (!orgId) throw new Error('No organization')
      const photo_url: string | null = photoUrlRef.current ?? editingMember?.photo_url ?? null
      if (IS_MOCK) {
        setMockMembers(prev => prev.map(m => m.id === id ? { ...m, ...values, photo_url, updated_at: new Date().toISOString() } as Member : m))
        if (values.subscription_type_id && values.start_date) {
          const typeDef = subscriptionTypes?.find(t => t.id === values.subscription_type_id)
          if (typeDef) {
            const existingSub = mockSubMap[id]
            if (!existingSub || existingSub.subscription_type_id !== values.subscription_type_id) {
              const subId = `mock-sub-${crypto.randomUUID()}`
              setMockSubMap(prev => ({ ...prev, [id]: { id: subId, subscription_type_id: values.subscription_type_id!, name: typeDef.name, status: 'pending_payment', total_amount: typeDef.price } }))
              if (rfidUid) setMockRfidMap(prev => ({ ...prev, [id]: rfidUid }))
              return { member_id: id, subscription_id: subId, total_amount: typeDef.price, subscription_name: typeDef.name, organization_id: orgId, first_name: values.first_name, last_name: values.last_name }
            }
          }
        }
        if (rfidUid) setMockRfidMap(prev => ({ ...prev, [id]: rfidUid }))
        return null
      }
      const { subscription_type_id, start_date, ...memberFields } = values
      const { error } = await supabase.from('members').update({ ...memberFields, photo_url, email: memberFields.email || null, phone: memberFields.phone || null, gender: memberFields.gender || null, birth_date: memberFields.birth_date || null, address: memberFields.address || null, emergency_contact: memberFields.emergency_contact || null, emergency_phone: memberFields.emergency_phone || null, coach_id: memberFields.coach_id || null }).eq('id', id)
      if (error) throw error
      if (subscription_type_id && start_date) {
        const typeDef = subscriptionTypes?.find(t => t.id === subscription_type_id)
        if (typeDef) {
          const end = new Date(start_date)
          end.setDate(end.getDate() + typeDef.duration_days)
          const existingSub = memberSubMap ? (memberSubMap as Record<string, { id: string; subscription_type_id: string; name: string; status: string }>)[id] : null
          if (!existingSub || existingSub.subscription_type_id !== subscription_type_id) {
            const { data: subData, error: subError } = await supabase.from('member_subscriptions').insert({
              organization_id: orgId,
              member_id: id,
              subscription_type_id,
              start_date,
              end_date: end.toISOString().split('T')[0],
              total_amount: typeDef.price,
              amount_paid: 0,
              status: 'pending_payment',
            } as any).select().single()
            if (subError) throw subError
            if (rfidUid && rfidUid !== (rfidData[id]?.rfid_uid ?? '')) {
              try { await (supabase.rpc as any)('assign_rfid_card', { p_member_id: id, p_rfid_uid: rfidUid, p_created_by: user?.id || null }) } catch {}
            }
            return {
              member_id: id,
              subscription_id: subData.id,
              total_amount: typeDef.price,
              subscription_name: typeDef.name,
              organization_id: orgId,
              first_name: values.first_name,
              last_name: values.last_name,
            }
          }
        }
      }
      if (rfidUid && rfidUid !== (rfidData[id]?.rfid_uid ?? '')) {
        try { await (supabase.rpc as any)('assign_rfid_card', { p_member_id: id, p_rfid_uid: rfidUid, p_created_by: user?.id || null }) } catch {}
      }
      return null
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['members-list'] })
      queryClient.invalidateQueries({ queryKey: ['members-active'] })
      queryClient.invalidateQueries({ queryKey: ['inactive-members'] })
      queryClient.invalidateQueries({ queryKey: ['expiring-subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['member-subscriptions-map', orgId] })
      queryClient.invalidateQueries({ queryKey: ['member-rfid-active'] })
      if (data) {
        closeDialog()
        navigate('/pos', { state: { pendingSubscription: data } })
      } else {
        closeDialog()
        toast({ title: t('members.memberUpdated') })
      }
    },
    onError: (err) => toast({ variant: 'destructive', title: t('errors.generic'), description: err.message }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (IS_MOCK) {
        setMockMembers(prev => prev.filter(m => m.id !== id))
        return
      }
      const { error } = await supabase.from('members').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['members'] }); queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }); queryClient.invalidateQueries({ queryKey: ['members-list'] }); queryClient.invalidateQueries({ queryKey: ['members-active'] }); queryClient.invalidateQueries({ queryKey: ['inactive-members'] }); queryClient.invalidateQueries({ queryKey: ['expiring-subscriptions'] }); setDeleteOpen(false); setDeletingMember(null); toast({ title: t('members.memberDeleted') }) },
    onError: (err) => toast({ variant: 'destructive', title: t('errors.generic'), description: err.message }),
  })

  function openAddDialog() {
    setEditingMember(null)
    setAvatarUploadedUrl(null)
    setRfidUid('')
    form.reset({ first_name: '', last_name: '', email: '', phone: '', gender: '', birth_date: '', address: '', emergency_contact: '', emergency_phone: '', subscription_type_id: '', start_date: new Date().toISOString().split('T')[0], coach_id: '' })
    setDialogOpen(true)
  }

  function openEditDialog(member: Member) {
    setRfidUid(rfidData[member.id]?.rfid_uid ?? '')
    setEditingMember(member)
    setAvatarUploadedUrl(null)
    const sub = memberSubMap ? (memberSubMap as Record<string, { id: string; subscription_type_id: string; name: string; status: string }>)[member.id] : null
    form.reset({
      first_name: member.first_name,
      last_name: member.last_name,
      email: member.email ?? '',
      phone: formatPhone(member.phone) ?? '',
      gender: member.gender ?? '',
      birth_date: member.birth_date ?? '',
      address: member.address ?? '',
      emergency_contact: member.emergency_contact ?? '',
      emergency_phone: formatPhone(member.emergency_phone) ?? '',
      subscription_type_id: sub?.subscription_type_id ?? '',
      start_date: new Date().toISOString().split('T')[0],
      coach_id: member.coach_id ?? '',
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingMember(null)
    setAvatarUploadedUrl(null)
    photoUrlRef.current = null
    setPhotoUploading(false)
    setRfidUid('')
    tempMemberIdRef.current = crypto.randomUUID()
  }

  function onSubmit(values: MemberForm) {
    if (editingMember) {
      updateMutation.mutate({ id: editingMember.id, values })
    } else {
      createMutation.mutate(values)
    }
  }

  const handleImport = useCallback(async (rows: any[]) => {
    if (!orgId) return
    const imported = rows.map((r: any) => ({
      id: `mock-${crypto.randomUUID()}`,
      organization_id: orgId,
      first_name: r.first_name || r.FirstName || r.firstName || '',
      last_name: r.last_name || r.LastName || r.lastName || '',
      email: r.email || r.Email || null,
      phone: formatPhone(r.phone || r.Phone || null),
      gender: r.gender || r.Gender || null,
      photo_url: null,
      status: 'active' as const,
      last_visit: null,
      notes: null,
      birth_date: null,
      address: null,
      emergency_contact: null,
      emergency_phone: formatPhone(r.emergency_phone || r.EmergencyPhone || null),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      member_number: null,
    })) as Member[]
    if (IS_MOCK) {
      setMockMembers(prev => [...imported, ...prev])
      toast({ title: t('members.imported').replace('{count}', String(imported.length)) })
      return
    }
    const members = imported.map(({ id, last_visit, notes, created_at, updated_at, photo_url, ...rest }) => rest)
    const { error } = await supabase.from('members').insert(members)
    if (error) {
      toast({ variant: 'destructive', title: t('members.importError'), description: error.message })
      return
    }
    queryClient.invalidateQueries({ queryKey: ['members'] })
    toast({ title: t('members.imported').replace('{count}', String(imported.length)) })
  }, [orgId, supabase, queryClient, toast])

  async function handleExport() {
    exportCsv()
  }

  const totalPages = Math.ceil((membersData?.count ?? 0) / pageSize)

  return (
    <div>
      <PageHeader
        title={t('members.title')}
        description={t('members.description')}
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              {t('members.import')}
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              {t('members.export')}
            </Button>
            <Button onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              {t('members.add')}
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t('common.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0) }}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder={t('common.status')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                <SelectItem value="active">{t('common.active')}</SelectItem>
                <SelectItem value="inactive">{t('common.inactive')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={genderFilter} onValueChange={(v) => { setGenderFilter(v); setPage(0) }}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder={t('members.gender')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                <SelectItem value="male">{t('members.male')}</SelectItem>
                <SelectItem value="female">{t('members.female')}</SelectItem>
              </SelectContent>
            </Select>
            {(search || statusFilter !== 'all' || genderFilter !== 'all' || sortBy !== 'created_at' || sortDir !== 'desc') && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setDebouncedSearch(''); setStatusFilter('all'); setGenderFilter('all'); setSortBy('created_at'); setSortDir('desc'); setPage(0) }}>
                <X className="h-4 w-4 mr-1" />{t('common.reset')}
              </Button>
            )}
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('member_number')}>
                    <div className="flex items-center gap-1">
                      N°
                      {sortBy === 'member_number' ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="w-10">Photo</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('last_name')}>
                    <div className="flex items-center gap-1">
                      {t('members.name')}
                      {sortBy === 'last_name' ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('email')}>
                    <div className="flex items-center gap-1">
                      {t('members.email')}
                      {sortBy === 'email' ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('phone')}>
                    <div className="flex items-center gap-1">
                      {t('members.phone')}
                      {sortBy === 'phone' ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead>RFID</TableHead>
                  <TableHead>Abonnement</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-1">
                      {t('common.status')}
                      {sortBy === 'status' ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('last_visit')}>
                    <div className="flex items-center gap-1">
                      {t('members.lastVisit')}
                      {sortBy === 'last_visit' ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && membersData?.data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">{t('members.noData')}</TableCell>
                  </TableRow>
                )}
              {membersData?.data.map((member: Member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <code className="text-xs font-mono font-semibold bg-muted px-1.5 py-0.5 rounded">{member.member_number ?? '—'}</code>
                  </TableCell>
                  <TableCell>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.photo_url ?? undefined} />
                      <AvatarFallback className="text-[10px]">{getInitials(member.first_name, member.last_name)}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{toUpper(member.first_name)} {toUpper(member.last_name)}</TableCell>
                  <TableCell>{member.email ?? '-'}</TableCell>
                  <TableCell>{displayPhone(member.phone)}</TableCell>
                  <TableCell>
                    {rfidData[member.id] ? (
                      <Badge className={`font-mono text-xs ${rfidData[member.id]?.status === 'ACTIF' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                        {rfidData[member.id]?.rfid_uid}
                      </Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    {memberSubMap && (memberSubMap as Record<string, { name: string; status: string }>)[member.id] ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium">{(memberSubMap as Record<string, { name: string; status: string }>)[member.id].name}</span>
                        <span className={`text-[10px] ${(memberSubMap as Record<string, { name: string; status: string }>)[member.id].status === 'active' ? 'text-success' : 'text-muted-foreground'}`}>
                          {(memberSubMap as Record<string, { name: string; status: string }>)[member.id].status}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell><Badge className={getStatusColor(member.status)}>{toUpper(member.status)}</Badge></TableCell>
                  <TableCell>{member.last_visit ? formatDate(member.last_visit) : '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {memberSubMap && (memberSubMap as Record<string, { id: string; status: string; total_amount: number }>)[member.id]?.status === 'pending_payment' && (
                        <Button variant="ghost" size="icon" title={t('members.collectSubscription')} onClick={() => {
                          const sub = (memberSubMap as Record<string, { id: string; subscription_type_id: string; name: string; status: string; total_amount: number }>)[member.id]
                          navigate('/pos', { state: { pendingSubscription: { member_id: member.id, subscription_id: sub.id, total_amount: sub.total_amount, subscription_name: sub.name, organization_id: orgId, first_name: member.first_name, last_name: member.last_name } } })
                        }}>
                          <CreditCard className="h-4 w-4 text-primary" />
                        </Button>
                      )}
                      {(memberSubMap[member.id]?.status === 'active' || memberSubMap[member.id]?.status === 'expired') && (
                        <Button variant="ghost" size="icon" onClick={() => navigate('/subscriptions')} title="Renouveler">
                          <RefreshCw className="h-4 w-4 text-warning" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => setRfidDialogMember({ id: member.id, name: `${member.first_name} ${member.last_name}` })}>
                        <Shield className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(member)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setDeletingMember(member); setDeleteOpen(true) }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            </Table>
          </div>

          <div className="md:hidden space-y-3">
            {isLoading && (
              <div className="text-center py-8"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
            )}
            {!isLoading && membersData?.data.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">{t('members.noData')}</p>
            )}
            {membersData?.data.map((member: Member) => (
              <Card key={member.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.photo_url ?? undefined} />
                      <AvatarFallback>{getInitials(member.first_name, member.last_name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{toUpper(member.first_name)} {toUpper(member.last_name)}</p>
                      <p className="text-xs text-muted-foreground">N° {member.member_number ?? '—'} · {displayPhone(member.phone)}</p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(member.status)}>{toUpper(member.status)}</Badge>
                </div>
                <div className="mt-3 flex gap-2">
                  {memberSubMap && (memberSubMap as Record<string, { id: string; status: string; total_amount: number; name: string; subscription_type_id: string }>)[member.id]?.status === 'pending_payment' && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" title={t('members.collectSubscription')} onClick={() => {
                      const sub = (memberSubMap as Record<string, { id: string; subscription_type_id: string; name: string; status: string; total_amount: number }>)[member.id]
                      navigate('/pos', { state: { pendingSubscription: { member_id: member.id, subscription_id: sub.id, total_amount: sub.total_amount, subscription_name: sub.name, organization_id: orgId, first_name: member.first_name, last_name: member.last_name } } })
                    }}><CreditCard className="h-4 w-4 text-primary" /></Button>
                  )}
                  {(memberSubMap[member.id]?.status === 'active' || memberSubMap[member.id]?.status === 'expired') && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/subscriptions')} title="Renouveler">
                      <RefreshCw className="h-4 w-4 text-warning" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(member)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setDeletingMember(member); setDeleteOpen(true) }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </Card>
            ))}
          </div>

          <Pagination page={page} totalPages={totalPages} totalItems={membersData?.count ?? 0} pageSize={pageSize} onPageChange={setPage} />
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl flex flex-col max-h-[85vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editingMember ? t('members.edit') : t('members.add')}</DialogTitle>
            <DialogDescription>{t('members.fillDetails')}</DialogDescription>
          </DialogHeader>
          {editingMember && memberSubMap && (memberSubMap as Record<string, { id: string; status: string; total_amount: number; name: string; subscription_type_id: string }>)[editingMember.id]?.status === 'pending_payment' && (
            <div className="shrink-0 flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <CreditCard className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t('members.pendingPayment')}</p>
                <p className="text-xs text-muted-foreground truncate">{(memberSubMap as Record<string, { name: string }>)[editingMember.id].name}</p>
              </div>
              <Button size="sm" onClick={() => {
                const sub = (memberSubMap as Record<string, { id: string; subscription_type_id: string; name: string; status: string; total_amount: number }>)[editingMember.id]
                navigate('/pos', { state: { pendingSubscription: { member_id: editingMember.id, subscription_id: sub.id, total_amount: sub.total_amount, subscription_name: sub.name, organization_id: orgId, first_name: editingMember.first_name, last_name: editingMember.last_name } } })
              }}>
                <CreditCard className="mr-2 h-4 w-4" />
                {t('members.collectSubscription')}
              </Button>
            </div>
          )}
          <div className="overflow-y-auto flex-1 -mx-6 px-6">
          <Form {...form}>
            <form id="member-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-1">
              <div className="flex items-center gap-4 pb-2">
                <AvatarUpload
                  orgId={orgId!}
                  memberId={editingMember?.id ?? tempMemberIdRef.current}
                  currentUrl={editingMember?.photo_url}
                  firstName={editingMember?.first_name ?? form.watch('first_name')}
                  lastName={editingMember?.last_name ?? form.watch('last_name')}
                  onUploadComplete={(url) => { setAvatarUploadedUrl(url); photoUrlRef.current = url }}
                />
                <div className="flex-1 space-y-2">
                  <p className="text-xs text-muted-foreground">{t('members.supportsCamera')}</p>
                  <CameraCapture
                    orgId={orgId!}
                    memberId={editingMember?.id ?? tempMemberIdRef.current}
                    onPhotoUploaded={(url) => { setAvatarUploadedUrl(url); photoUrlRef.current = url }}
                    onUploading={setPhotoUploading}
                  />
                </div>
              </div>
              <RfidCreateSection rfidUid={rfidUid} onRfidChange={setRfidUid} />
              {subscriptionTypes && subscriptionTypes.length > 0 && (
                <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                  <h4 className="text-sm font-semibold">{t('subscriptions.title')}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="subscription_type_id" render={({ field }) => (
                      <FormItem><FormLabel>{t('subscriptions.type')}</FormLabel><FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger><SelectValue placeholder={t('common.all')} /></SelectTrigger>
                          <SelectContent>
                            {subscriptionTypes.map(st => (
                              <SelectItem key={st.id} value={st.id}>{st.description} — {formatCurrency(st.price)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="start_date" render={({ field }) => (
                      <FormItem><FormLabel>{t('subscriptions.startDate')}</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <p className="text-xs text-muted-foreground">{editingMember ? t('subscriptions.editSubscriptionType') : t('pos.subscriptionRedirect')}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="first_name" render={({ field }) => (
                  <FormItem><FormLabel>{t('members.firstName')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="last_name" render={({ field }) => (
                  <FormItem><FormLabel>{t('members.lastName')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>{t('members.email')}</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>{t('members.phone')}</FormLabel><FormControl><Input {...field} onBlur={() => field.onChange(formatPhone(field.value))} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem><FormLabel>{t('members.gender')}</FormLabel><FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder={t('members.selectGender')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">{t('members.male')}</SelectItem>
                        <SelectItem value="female">{t('members.female')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="birth_date" render={({ field }) => (
                  <FormItem><FormLabel>{t('members.birthDate')}</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <FormField control={form.control} name="coach_id" render={({ field }) => (
                  <FormItem><FormLabel>Coach</FormLabel><FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Aucun coach" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Aucun coach</SelectItem>
                        {(coaches ?? []).map(c => (
                          <SelectItem key={c.id} value={c.id}>{toUpper(c.first_name)} {toUpper(c.last_name)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem><FormLabel>{t('members.address')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="emergency_contact" render={({ field }) => (
                  <FormItem><FormLabel>{t('members.emergencyContact')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="emergency_phone" render={({ field }) => (
                  <FormItem><FormLabel>{t('members.emergencyPhone')}</FormLabel><FormControl><Input {...field} onBlur={() => field.onChange(formatPhone(field.value))} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              </form>
            </Form>
          </div>
          <DialogFooter className="shrink-0 border-t border-border/50 pt-4 mt-2">
            <Button type="button" variant="outline" onClick={closeDialog}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={photoUploading || createMutation.isPending || updateMutation.isPending} form="member-form">
              {photoUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingMember ? t('members.saveChanges') : t('members.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('members.delete')}</DialogTitle>
            <DialogDescription>
              {t('members.deleteConfirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeletingMember(null) }}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={() => deletingMember && deleteMutation.mutate(deletingMember.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImport={handleImport} t={t} />

      <RfidManagementDialog
        memberId={rfidDialogMember?.id || ''}
        memberName={rfidDialogMember?.name || ''}
        open={!!rfidDialogMember}
        onOpenChange={(open) => { if (!open) { setRfidDialogMember(null); rfidManagementQuery.refetch() } }}
      />
    </div>
  )
}
