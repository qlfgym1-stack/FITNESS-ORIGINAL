import { useState, useMemo, useEffect } from 'react'
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
import { formatCurrency, formatDate, getDaysRemaining, getStatusColor, toUpper } from '@/lib/utils'
import type { SubscriptionType, MemberSubscription } from '@/types/supabase'

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

  const subTypeSchema = useMemo(() => z.object({
    name: z.string().min(1, t('errors.nameRequired')),
    description: z.string().optional().or(z.literal('')),
    duration_days: z.coerce.number().min(1, t('errors.durationMin')),
    price: z.coerce.number().min(0, t('errors.priceMin')),
    max_classes: z.coerce.number().min(0).optional().or(z.literal('')),
  }), [t])

  type SubTypeForm = z.infer<typeof subTypeSchema>

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

  const { data: memberSubs, isLoading: subsLoading, isError: subsError, error: subsQueryError } = useQuery({
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

  useEffect(() => {
    if (subsError && subsQueryError) {
      toast({ variant: 'destructive', title: t('errors.generic'), description: subsQueryError.message })
    }
  }, [subsError, subsQueryError])

  const createTypeMutation = useMutation({
    mutationFn: async (values: SubTypeForm) => {
      if (!orgId) throw new Error('No organization')
      const { error } = await supabase.from('subscription_types').insert({
        ...values,
        organization_id: orgId,
      } as any)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subscription-types'] }); queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] }); closeTypeDialog(); toast({ title: t('subscriptions.typeCreated') }) },
    onError: (err) => toast({ variant: 'destructive', title: t('errors.generic'), description: err.message }),
  })

  const updateTypeMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: SubTypeForm }) => {
      const { error } = await supabase.from('subscription_types').update({
        ...values,
        description: values.description || null,
        max_classes: values.max_classes !== '' ? Number(values.max_classes) : null,
      }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subscription-types'] }); queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] }); closeTypeDialog(); toast({ title: t('subscriptions.typeUpdated') }) },
    onError: (err) => toast({ variant: 'destructive', title: t('errors.generic'), description: err.message }),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('subscription_types').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, is_active }) => {
      await queryClient.cancelQueries({ queryKey: ['subscription-types', orgId] })
      const previous = queryClient.getQueriesData({ queryKey: ['subscription-types', orgId] })
      queryClient.setQueryData(['subscription-types', orgId], (old: any) =>
        old?.map((t: any) => (t.id === id ? { ...t, is_active } : t))
      )
      return { previous }
    },
    onError: (err, vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['subscription-types', orgId], context.previous)
      }
      toast({ title: t('errors.generic'), description: err.message, variant: 'destructive' })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-types', orgId] })
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list', orgId] })
    },
  })

  const cancelSubMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('member_subscriptions').update({ status: 'cancelled' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['member-subscriptions'] }); queryClient.invalidateQueries({ queryKey: ['expiring-subscriptions'] }); queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }); setCancelOpen(false); setCancellingSub(null); toast({ title: t('subscriptions.subscriptionCancelled') }) },
    onError: (err) => toast({ variant: 'destructive', title: t('errors.generic'), description: err.message }),
  })

  const renewSubMutation = useMutation({
    mutationFn: async (sub: MemberSubWithDetails) => {
      if (!orgId) throw new Error('No organization')
      const startDate = new Date()
      const endDate = new Date(startDate)
      const typeDef = subTypes?.find(t => t.id === sub.subscription_type_id)
      endDate.setDate(endDate.getDate() + (typeDef?.duration_days ?? 30))

      const { error } = await (supabase.rpc as any)('renew_subscription', {
        p_old_subscription_id: sub.id,
        p_organization_id: orgId,
        p_member_id: sub.member_id,
        p_subscription_type_id: sub.subscription_type_id,
        p_start_date: startDate.toISOString().split('T')[0],
        p_end_date: endDate.toISOString().split('T')[0],
        p_total_amount: sub.total_amount,
        p_amount_paid: sub.total_amount,
      })
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['member-subscriptions'] }); queryClient.invalidateQueries({ queryKey: ['expiring-subscriptions'] }); queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }); setRenewOpen(false); setRenewingSub(null); toast({ title: t('subscriptions.subscriptionRenewed') }) },
    onError: (err) => toast({ variant: 'destructive', title: t('errors.generic'), description: err.message }),
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
      max_classes: type.max_classes ?? '',
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
      <PageHeader title={t('subscriptions.title')} description={t('subscriptions.description')} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="types">{t('subscriptions.subscriptionTypes')}</TabsTrigger>
          <TabsTrigger value="members">{t('subscriptions.memberSubscriptions')}</TabsTrigger>
        </TabsList>

        <TabsContent value="types">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">{t('subscriptions.typesDefined').replace('{count}', String(subTypes?.length ?? 0))}</p>
                <Button onClick={openAddTypeDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('subscriptions.addType')}
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('subscriptions.name')}</TableHead>
                    <TableHead>{t('subscriptions.descriptionLabel')}</TableHead>
                    <TableHead>{t('subscriptions.duration')}</TableHead>
                    <TableHead>{t('subscriptions.price')}</TableHead>
                    <TableHead>{t('subscriptions.maxClasses')}</TableHead>
                    <TableHead>{t('subscriptions.active')}</TableHead>
                    <TableHead className="text-right">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typesLoading && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
                  )}
                  {!typesLoading && subTypes?.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t('subscriptions.noSubscriptionTypes')}</TableCell></TableRow>
                  )}
                  {subTypes?.map((type) => (
                    <TableRow key={type.id}>
                      <TableCell className="font-medium">{toUpper(type.name)}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">{toUpper(type.description ?? '-')}</TableCell>
                      <TableCell>{type.duration_days} {t('subscriptions.days')}</TableCell>
                      <TableCell>{formatCurrency(type.price)}</TableCell>
                      <TableCell>{type.max_classes ?? t('subscriptions.unlimited')}</TableCell>
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
                  <Input placeholder={t('subscriptions.searchByMemberName')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder={t('common.status')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('subscriptions.allStatus')}</SelectItem>
                    <SelectItem value="active">{t('common.active')}</SelectItem>
                    <SelectItem value="pending_payment">{t('subscriptions.pendingPayment')}</SelectItem>
                    <SelectItem value="expired">{t('common.expired')}</SelectItem>
                    <SelectItem value="cancelled">{t('subscriptions.cancelled')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('subscriptions.member')}</TableHead>
                    <TableHead>{t('subscriptions.type')}</TableHead>
                    <TableHead>{t('subscriptions.startDate')}</TableHead>
                    <TableHead>{t('subscriptions.endDate')}</TableHead>
                    <TableHead>{t('payments.total')}</TableHead>
                    <TableHead>{t('subscriptions.paid')}</TableHead>
                    <TableHead>{t('subscriptions.balance')}</TableHead>
                    <TableHead>{t('subscriptions.status')}</TableHead>
                    <TableHead className="text-right">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subsLoading && (
                    <TableRow><TableCell colSpan={9} className="text-center py-8"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
                  )}
                  {!subsLoading && memberSubs?.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">{t('subscriptions.noSubscriptionsFound')}</TableCell></TableRow>
                  )}
                  {memberSubs?.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">{toUpper(sub.member_name)}</TableCell>
                      <TableCell>{toUpper(sub.type_name)}</TableCell>
                      <TableCell>{formatDate(sub.start_date)}</TableCell>
                      <TableCell>{formatDate(sub.end_date)}</TableCell>
                      <TableCell>{formatCurrency(sub.total_amount)}</TableCell>
                      <TableCell>{formatCurrency(sub.amount_paid)}</TableCell>
                      <TableCell>{formatCurrency(sub.total_amount - sub.amount_paid)}</TableCell>
                      <TableCell><Badge className={getStatusColor(sub.status)}>{toUpper(sub.status)}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {sub.status === 'active' && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => { setRenewingSub(sub); setRenewOpen(true) }} title={t('subscriptions.renew')}>
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => { setCancellingSub(sub); setCancelOpen(true) }} title={t('subscriptions.cancel')}>
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
            <DialogTitle>{editingType ? t('subscriptions.editSubscriptionType') : t('subscriptions.addSubscriptionType')}</DialogTitle>
            <DialogDescription>{t('subscriptions.defineSubscriptionType')}</DialogDescription>
          </DialogHeader>
          <Form {...typeForm}>
            <form onSubmit={typeForm.handleSubmit(onTypeSubmit)} className="space-y-4">
              <FormField control={typeForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>{t('subscriptions.name')}</FormLabel><FormControl><Input placeholder={t('subscriptions.typeNamePlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={typeForm.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>{t('subscriptions.descriptionLabel')}</FormLabel><FormControl><Input placeholder={t('subscriptions.descriptionPlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={typeForm.control} name="duration_days" render={({ field }) => (
                  <FormItem><FormLabel>{t('subscriptions.durationDays')}</FormLabel><FormControl><Input type="number" min={1} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={typeForm.control} name="price" render={({ field }) => (
                  <FormItem><FormLabel>{t('subscriptions.price')}</FormLabel><FormControl><Input type="number" min={0} step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={typeForm.control} name="max_classes" render={({ field }) => (
                <FormItem><FormLabel>{t('subscriptions.maxClassesLabel')}</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeTypeDialog}>{t('common.cancel')}</Button>
                <Button type="submit" disabled={createTypeMutation.isPending || updateTypeMutation.isPending}>
                  {(createTypeMutation.isPending || updateTypeMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingType ? t('subscriptions.saveChanges') : t('subscriptions.createType')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('subscriptions.cancelSubscription')}</DialogTitle>
            <DialogDescription>
              {t('subscriptions.cancelConfirmMessage').replace('{name}', toUpper(cancellingSub?.member_name ?? '')).replace('{type}', toUpper(cancellingSub?.type_name ?? ''))}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCancelOpen(false); setCancellingSub(null) }}>{t('subscriptions.noKeepIt')}</Button>
            <Button variant="destructive" onClick={() => cancellingSub && cancelSubMutation.mutate(cancellingSub.id)} disabled={cancelSubMutation.isPending}>
              {cancelSubMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('subscriptions.yesCancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('subscriptions.renewSubscription')}</DialogTitle>
            <DialogDescription>
              {t('subscriptions.renewConfirmMessage').replace('{name}', toUpper(renewingSub?.member_name ?? '')).replace('{type}', toUpper(renewingSub?.type_name ?? ''))}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRenewOpen(false); setRenewingSub(null) }}>{t('common.cancel')}</Button>
            <Button onClick={() => renewingSub && renewSubMutation.mutate(renewingSub)} disabled={renewSubMutation.isPending}>
              {renewSubMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('subscriptions.renew')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
