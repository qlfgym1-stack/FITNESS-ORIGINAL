import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@/hooks/useQuery'
import { useSupabase } from '@/hooks/useSupabase'
import { useAuth } from '@/stores/auth'
import { useToast } from '@/components/ui/toast'
import { useT } from '@/i18n'
import { PageHeader } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Loader2, Download } from 'lucide-react'
import { formatCurrency, toUpper } from '@/lib/utils'
import type { SubscriptionType } from '@/types/supabase'
import { usePagination } from '@/hooks/usePagination'
import { useExportCsv } from '@/hooks/useExportCsv'
import { Pagination } from '@/components/ui/pagination'

export default function Subscriptions() {
  const t = useT()
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { organization } = useAuth()
  const { toast } = useToast()
  const nav = useNavigate()
  const orgId = organization?.id

  const subTypeSchema = useMemo(() => z.object({
    name: z.string().min(1, t('errors.nameRequired')),
    description: z.string().optional().or(z.literal('')),
    duration_days: z.coerce.number().min(1, t('errors.durationMin')),
    price: z.coerce.number().min(0, t('errors.priceMin')),
    max_classes: z.coerce.number().min(0).optional().or(z.literal('')),
  }), [t])

  type SubTypeForm = z.infer<typeof subTypeSchema>

  const [typeDialogOpen, setTypeDialogOpen] = useState(false)
  const [editingType, setEditingType] = useState<SubscriptionType | null>(null)

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
    onError: (err: Error) => toast({ variant: 'destructive', title: t('errors.generic'), description: err.message }),
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
    onError: (err: Error) => toast({ variant: 'destructive', title: t('errors.generic'), description: err.message }),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('subscription_types').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await queryClient.cancelQueries({ queryKey: ['subscription-types', orgId] })
      const previous = queryClient.getQueriesData({ queryKey: ['subscription-types', orgId] })
      queryClient.setQueryData(['subscription-types', orgId], (old: any) =>
        old?.map((t: any) => (t.id === id ? { ...t, is_active } : t))
      )
      return { previous }
    },
    onError: (err: Error, vars: { id: string; is_active: boolean }, context: { previous: unknown } | undefined) => {
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

  const { page: typePage, setPage: setTypePage, totalPages: typeTotalPages, paginatedData: paginatedTypes } = usePagination(subTypes, 20)

  const { exportCsv: exportTypesCsv } = useExportCsv(
    (subTypes ?? []).map((type: SubscriptionType) => ({ name: type.name, description: type.description ?? '', duration_days: type.duration_days, price: type.price, max_classes: type.max_classes ?? 'Unlimited', active: type.is_active ? 'Yes' : 'No' })),
    'subscription-types',
    [
      { key: 'name', label: t('subscriptions.name') },
      { key: 'description', label: t('subscriptions.descriptionLabel') },
      { key: 'duration_days', label: t('subscriptions.duration') },
      { key: 'price', label: t('subscriptions.price') },
      { key: 'max_classes', label: t('subscriptions.maxClasses') },
      { key: 'active', label: t('subscriptions.active') },
    ]
  )

  return (
    <div>
      <PageHeader title={t('subscriptions.title')} description={t('subscriptions.description')} />

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">{t('subscriptions.typesDefined').replace('{count}', String(subTypes?.length ?? 0))}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => exportTypesCsv()}>
                <Download className="mr-2 h-4 w-4" />
                {t('common.export') || 'Export'}
              </Button>
              <Button onClick={openAddTypeDialog}>
                <Plus className="mr-2 h-4 w-4" />
                {t('subscriptions.addType')}
              </Button>
            </div>
          </div>
          <div className="hidden md:block">
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
                  {!typesLoading && paginatedTypes?.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t('subscriptions.noSubscriptionTypes')}</TableCell></TableRow>
                  )}
                  {paginatedTypes?.map((type) => (
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
              </div>
              <div className="md:hidden space-y-3">
                {paginatedTypes?.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">{t('common.noResults')}</p>
                ) : (
                  paginatedTypes?.map(type => (
                    <Card key={type.id} className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">{toUpper(type.name)}</span>
                        <Switch checked={type.is_active} onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: type.id, is_active: checked })} className="ml-auto" />
                      </div>
                      <p className="text-sm text-muted-foreground">{type.duration_days} {t('subscriptions.days')} | {formatCurrency(type.price)}</p>
                      <div className="flex justify-end mt-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditTypeDialog(type)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </div>
              <Pagination page={typePage} totalPages={typeTotalPages} totalItems={subTypes?.length ?? 0} pageSize={20} onPageChange={setTypePage} />
            </CardContent>
          </Card>

      {/* Subscription Type Dialog */}
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
    </div>
  )
}

