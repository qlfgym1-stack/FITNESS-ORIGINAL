import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@/hooks/useQuery'
import { useSupabase } from '@/hooks/useSupabase'
import { useAuth } from '@/stores/auth'
import { useT } from '@/i18n'
import { useToast } from '@/components/ui/toast'
import { PageHeader } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Search, Loader2, XCircle, RefreshCw } from 'lucide-react'
import { formatCurrency, formatDate, getDaysRemaining, getStatusColor } from '@/lib/utils'
import type { SubscriptionType, MemberSubscription } from '@/types/supabase'

const subTypeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().or(z.literal('')),
  duration_days: z.coerce.number().min(1, 'Duration must be at least 1 day'),
  price: z.coerce.number().min(0, 'Price must be 0 or more'),
  max_classes: z.coerce.number().min(0).optional().or(z.literal('')),
})

type SubTypeForm = z.infer<typeof subTypeSchema>

interface MemberSubWithDetails extends MemberSubscription {
  member_name?: string
  type_name?: string
}

export default function Subscriptions() {
  const t = useT()
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { organization } = useAuth()
  const { toast } = useToast()
  const orgId = organization?.id

  const [tab, setTab] = useState('types')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeDialogOpen, setTypeDialogOpen] = useState(false)
  const [editingType, setEditingType] = useState<SubscriptionType | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancellingSub, setCancellingSub] = useState<MemberSubWithDetails | null>(null)
  const [renewOpen, setRenewOpen] = useState(false)
  const [renewingSub, setRenewingSub] = useState<MemberSubWithDetails | null>(null)

  const typeForm = useForm<SubTypeForm>({
    resolver: zodResolver(subTypeSchema),
    defaultValues: { name: '', description: '', duration_days: 30, price: 0, max_classes: '' },
  })

  const { data: subTypes, isLoading: typesLoading } = useQuery({
    queryKey: ['subscription-types', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase.from('subscription_types').select('*').eq('organization_id', orgId).order('name')
      return (data ?? []) as SubscriptionType[]
    },
    enabled: !!orgId,
  })

  const { data: memberSubs, isLoading: subsLoading } = useQuery({
    queryKey: ['member-subscriptions', orgId, statusFilter, search],
    queryFn: async () => {
      if (!orgId) return []
      let query = supabase
        .from('member_subscriptions')
        .select('*, members!inner(first_name, last_name), subscription_types!inner(name)')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })

      if (statusFilter !== 'all') query = query.eq('status', statusFilter as any)
      if (search) {
        query = query.or(`members.first_name.ilike.%${search}%,members.last_name.ilike.%${search}%`)
      }

      const { data } = await query
      return (data ?? []).map((sub: any) => ({
        ...sub,
        member_name: `${sub.members?.first_name ?? ''} ${sub.members?.last_name ?? ''}`,
        type_name: sub.subscription_types?.name ?? '',
      })) as MemberSubWithDetails[]
    },
    enabled: !!orgId,
  })

  const createTypeMutation = useMutation({
    mutationFn: async (values: SubTypeForm) => {
      if (!orgId) throw new Error('No organization')
      const { error } = await supabase.from('subscription_types').insert({
        ...values,
        organization_id: orgId,
      } as any)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subscription-types'] }); closeTypeDialog(); toast({ title: 'Subscription type created' }) },
    onError: (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  })

  const updateTypeMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: SubTypeForm }) => {
      const { error } = await supabase.from('subscription_types').update({
        ...values,
        description: values.description || null,
        max_classes: values.max_classes ? Number(values.max_classes) : null,
      }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subscription-types'] }); closeTypeDialog(); toast({ title: 'Subscription type updated' }) },
    onError: (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('subscription_types').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subscription-types'] }) },
    onError: (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  })

  const cancelSubMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('member_subscriptions').update({ status: 'cancelled' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['member-subscriptions'] }); setCancelOpen(false); setCancellingSub(null); toast({ title: 'Subscription cancelled' }) },
    onError: (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  })

  const renewSubMutation = useMutation({
    mutationFn: async (sub: MemberSubWithDetails) => {
      if (!orgId) throw new Error('No organization')
      const startDate = new Date()
      const endDate = new Date(startDate)
      const typeDef = subTypes?.find(t => t.id === sub.subscription_type_id)
      endDate.setDate(endDate.getDate() + (typeDef?.duration_days ?? 30))

      const { error: updateError } = await supabase.from('member_subscriptions').update({ status: 'expired' }).eq('id', sub.id)
      if (updateError) throw updateError

      const { error } = await supabase.from('member_subscriptions').insert({
        organization_id: orgId,
        member_id: sub.member_id,
        subscription_type_id: sub.subscription_type_id,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        total_amount: sub.total_amount,
        amount_paid: 0,
        status: 'active',
      })
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['member-subscriptions'] }); setRenewOpen(false); setRenewingSub(null); toast({ title: 'Subscription renewed' }) },
    onError: (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  })

  function openAddTypeDialog() {
    setEditingType(null)
    typeForm.reset({ name: '', description: '', duration_days: 30, price: 0, max_classes: '' })
    setTypeDialogOpen(true)
  }

  function openEditTypeDialog(type: SubscriptionType) {
    setEditingType(type)
    typeForm.reset({
      name: type.name,
      description: type.description ?? '',
      duration_days: type.duration_days,
      price: type.price,
      max_classes: type.max_classes?.toString() ?? '' as any,
    })
    setTypeDialogOpen(true)
  }

  function closeTypeDialog() {
    setTypeDialogOpen(false)
    setEditingType(null)
  }

  function onTypeSubmit(values: SubTypeForm) {
    if (editingType) {
      updateTypeMutation.mutate({ id: editingType.id, values })
    } else {
      createTypeMutation.mutate(values)
    }
  }

  return (
    <div>
      <PageHeader title="Subscriptions" description="Manage subscription types and member subscriptions" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="types">Subscription Types</TabsTrigger>
          <TabsTrigger value="members">Member Subscriptions</TabsTrigger>
        </TabsList>

        <TabsContent value="types">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">{subTypes?.length ?? 0} types defined</p>
                <Button onClick={openAddTypeDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Type
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Max Classes</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typesLoading && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
                  )}
                  {!typesLoading && subTypes?.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No subscription types</TableCell></TableRow>
                  )}
                  {subTypes?.map((type) => (
                    <TableRow key={type.id}>
                      <TableCell className="font-medium">{type.name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">{type.description ?? '-'}</TableCell>
                      <TableCell>{type.duration_days} days</TableCell>
                      <TableCell>{formatCurrency(type.price)}</TableCell>
                      <TableCell>{type.max_classes ?? 'Unlimited'}</TableCell>
                      <TableCell>
                        <Switch checked={type.is_active} onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: type.id, is_active: checked })} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEditTypeDialog(type)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by member name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subsLoading && (
                    <TableRow><TableCell colSpan={9} className="text-center py-8"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
                  )}
                  {!subsLoading && memberSubs?.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No subscriptions found</TableCell></TableRow>
                  )}
                  {memberSubs?.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">{sub.member_name}</TableCell>
                      <TableCell>{sub.type_name}</TableCell>
                      <TableCell>{formatDate(sub.start_date)}</TableCell>
                      <TableCell>{formatDate(sub.end_date)}</TableCell>
                      <TableCell>{formatCurrency(sub.total_amount)}</TableCell>
                      <TableCell>{formatCurrency(sub.amount_paid)}</TableCell>
                      <TableCell>{formatCurrency(sub.total_amount - sub.amount_paid)}</TableCell>
                      <TableCell><Badge className={getStatusColor(sub.status)}>{sub.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {sub.status === 'active' && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => { setRenewingSub(sub); setRenewOpen(true) }} title="Renew">
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => { setCancellingSub(sub); setCancelOpen(true) }} title="Cancel">
                                <XCircle className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingType ? 'Edit Subscription Type' : 'Add Subscription Type'}</DialogTitle>
            <DialogDescription>Define the subscription type details.</DialogDescription>
          </DialogHeader>
          <Form {...typeForm}>
            <form onSubmit={typeForm.handleSubmit(onTypeSubmit)} className="space-y-4">
              <FormField control={typeForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="e.g. Monthly Basic" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={typeForm.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Input placeholder="Optional description" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={typeForm.control} name="duration_days" render={({ field }) => (
                  <FormItem><FormLabel>Duration (days)</FormLabel><FormControl><Input type="number" min={1} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={typeForm.control} name="price" render={({ field }) => (
                  <FormItem><FormLabel>Price</FormLabel><FormControl><Input type="number" min={0} step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={typeForm.control} name="max_classes" render={({ field }) => (
                <FormItem><FormLabel>Max Classes (leave empty for unlimited)</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeTypeDialog}>Cancel</Button>
                <Button type="submit" disabled={createTypeMutation.isPending || updateTypeMutation.isPending}>
                  {(createTypeMutation.isPending || updateTypeMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingType ? 'Save Changes' : 'Create Type'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel {cancellingSub?.member_name}&apos;s &ldquo;{cancellingSub?.type_name}&rdquo; subscription?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCancelOpen(false); setCancellingSub(null) }}>No, Keep It</Button>
            <Button variant="destructive" onClick={() => cancellingSub && cancelSubMutation.mutate(cancellingSub.id)} disabled={cancelSubMutation.isPending}>
              {cancelSubMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renew Subscription</DialogTitle>
            <DialogDescription>
              Renew {renewingSub?.member_name}&apos;s &ldquo;{renewingSub?.type_name}&rdquo; subscription? A new subscription will be created.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRenewOpen(false); setRenewingSub(null) }}>Cancel</Button>
            <Button onClick={() => renewingSub && renewSubMutation.mutate(renewingSub)} disabled={renewSubMutation.isPending}>
              {renewSubMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Renew
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
