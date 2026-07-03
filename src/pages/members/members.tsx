import { useState, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@/hooks/useQuery'
import { useSupabase } from '@/hooks/useSupabase'
import { useAuth } from '@/stores/auth'
import { useT } from '@/i18n'
import { useToast } from '@/components/ui/toast'
import { PageHeader } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Search, Plus, Download, Upload, Pencil, Trash2, ChevronLeft, ChevronRight, Camera, Loader2 } from 'lucide-react'
import { formatDate, getInitials, getStatusColor } from '@/lib/utils'
import * as XLSX from 'xlsx'
import type { Member } from '@/types/supabase'

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
})

type MemberForm = z.infer<typeof memberSchema>

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (data: any[]) => void
}

function ImportDialog({ open, onOpenChange, onImport }: ImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(sheet)
      onImport(json)
      onOpenChange(false)
    }
    reader.readAsArrayBuffer(file)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Members from Excel</DialogTitle>
          <DialogDescription>Upload an .xlsx or .xls file with member data.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function Members() {
  const t = useT()
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { organization } = useAuth()
  const { toast } = useToast()
  const orgId = organization?.id

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [genderFilter, setGenderFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [deletingMember, setDeletingMember] = useState<Member | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const pageSize = 10

  const form = useForm<MemberForm>({
    resolver: zodResolver(memberSchema),
    defaultValues: { first_name: '', last_name: '', email: '', phone: '', gender: '', birth_date: '', address: '', emergency_contact: '', emergency_phone: '' },
  })

  const { data: membersData, isLoading } = useQuery({
    queryKey: ['members', orgId, search, statusFilter, genderFilter, page],
    queryFn: async () => {
      if (!orgId) return { data: [], count: 0 }
      let query = supabase.from('members').select('*', { count: 'exact' }).eq('organization_id', orgId).order('created_at', { ascending: false })

      if (search) {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
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

  const createMutation = useMutation({
    mutationFn: async (values: MemberForm) => {
      if (!orgId) throw new Error('No organization')
      let photo_url: string | null = null
      if (photoFile) {
        const ext = photoFile.name.split('.').pop()
        const filePath = `members/${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage.from('photos').upload(filePath, photoFile)
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('photos').getPublicUrl(filePath)
          photo_url = urlData.publicUrl
        }
      }
      const { error } = await supabase.from('members').insert({ ...values, organization_id: orgId, photo_url } as any)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['members'] }); closeDialog(); toast({ title: 'Member added' }) },
    onError: (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: MemberForm }) => {
      if (!orgId) throw new Error('No organization')
      let photo_url: string | null = editingMember?.photo_url ?? null
      if (photoFile) {
        const ext = photoFile.name.split('.').pop()
        const filePath = `members/${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage.from('photos').upload(filePath, photoFile)
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('photos').getPublicUrl(filePath)
          photo_url = urlData.publicUrl
        }
      }
      const { error } = await supabase.from('members').update({ ...values, photo_url, email: values.email || null, phone: values.phone || null, gender: values.gender || null, birth_date: values.birth_date || null, address: values.address || null, emergency_contact: values.emergency_contact || null, emergency_phone: values.emergency_phone || null }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['members'] }); closeDialog(); toast({ title: 'Member updated' }) },
    onError: (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('members').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['members'] }); setDeleteOpen(false); setDeletingMember(null); toast({ title: 'Member deleted' }) },
    onError: (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  })

  function openAddDialog() {
    setEditingMember(null)
    setPhotoFile(null)
    form.reset({ first_name: '', last_name: '', email: '', phone: '', gender: '', birth_date: '', address: '', emergency_contact: '', emergency_phone: '' })
    setDialogOpen(true)
  }

  function openEditDialog(member: Member) {
    setEditingMember(member)
    setPhotoFile(null)
    form.reset({
      first_name: member.first_name,
      last_name: member.last_name,
      email: member.email ?? '',
      phone: member.phone ?? '',
      gender: member.gender ?? '',
      birth_date: member.birth_date ?? '',
      address: member.address ?? '',
      emergency_contact: member.emergency_contact ?? '',
      emergency_phone: member.emergency_phone ?? '',
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingMember(null)
    setPhotoFile(null)
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
    const members = rows.map((r: any) => ({
      organization_id: orgId,
      first_name: r.first_name || r.FirstName || r.firstName || '',
      last_name: r.last_name || r.LastName || r.lastName || '',
      email: r.email || r.Email || null,
      phone: r.phone || r.Phone || null,
      gender: r.gender || r.Gender || null,
      status: 'active' as const,
    }))
    const { error } = await supabase.from('members').insert(members)
    if (error) {
      toast({ variant: 'destructive', title: 'Import Error', description: error.message })
      return
    }
    queryClient.invalidateQueries({ queryKey: ['members'] })
    toast({ title: `Imported ${members.length} members` })
  }, [orgId, supabase, queryClient, toast])

  function handleExport() {
    if (!membersData?.data.length) return
    const ws = XLSX.utils.json_to_sheet(membersData.data.map((m: Member) => ({
      'First Name': m.first_name,
      'Last Name': m.last_name,
      Email: m.email ?? '',
      Phone: m.phone ?? '',
      Gender: m.gender ?? '',
      Status: m.status,
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Members')
    XLSX.writeFile(wb, 'members.xlsx')
  }

  function capturePhoto() {
    photoRef.current?.click()
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) setPhotoFile(file)
  }

  const totalPages = Math.ceil((membersData?.count ?? 0) / pageSize)

  return (
    <div>
      <PageHeader
        title="Members"
        description="Manage your gym members"
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Member
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search members..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0) }}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={genderFilter} onValueChange={(v) => { setGenderFilter(v); setPage(0) }}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Gender" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genders</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Photo</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Visit</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && membersData?.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No members found</TableCell>
                </TableRow>
              )}
              {membersData?.data.map((member: Member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={member.photo_url ?? undefined} />
                      <AvatarFallback>{getInitials(member.first_name, member.last_name)}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{member.first_name} {member.last_name}</TableCell>
                  <TableCell>{member.email ?? '-'}</TableCell>
                  <TableCell>{member.phone ?? '-'}</TableCell>
                  <TableCell><Badge className={getStatusColor(member.status)}>{member.status}</Badge></TableCell>
                  <TableCell>{member.last_visit ? formatDate(member.last_visit) : '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, membersData?.count ?? 0)} of {membersData?.count ?? 0}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingMember ? 'Edit Member' : 'Add Member'}</DialogTitle>
            <DialogDescription>Fill in the member details below.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="flex items-center gap-4 pb-2">
                <Avatar className="h-16 w-16">
                  {photoFile ? (
                    <AvatarImage src={URL.createObjectURL(photoFile)} />
                  ) : editingMember?.photo_url ? (
                    <AvatarImage src={editingMember.photo_url} />
                  ) : (
                    <AvatarFallback className="text-lg">{editingMember ? getInitials(editingMember.first_name, editingMember.last_name) : '?'}</AvatarFallback>
                  )}
                </Avatar>
                <div>
                  <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
                  <Button type="button" variant="outline" size="sm" onClick={capturePhoto}>
                    <Camera className="mr-2 h-4 w-4" />
                    {photoFile ? 'Change Photo' : 'Upload Photo'}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">Supports camera capture</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="first_name" render={({ field }) => (
                  <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="last_name" render={({ field }) => (
                  <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem><FormLabel>Gender</FormLabel><FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="birth_date" render={({ field }) => (
                  <FormItem><FormLabel>Birth Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="emergency_contact" render={({ field }) => (
                  <FormItem><FormLabel>Emergency Contact</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="emergency_phone" render={({ field }) => (
                  <FormItem><FormLabel>Emergency Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingMember ? 'Save Changes' : 'Add Member'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deletingMember?.first_name} {deletingMember?.last_name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeletingMember(null) }}>Cancel</Button>
            <Button variant="destructive" onClick={() => deletingMember && deleteMutation.mutate(deletingMember.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImport={handleImport} />
    </div>
  )
}
