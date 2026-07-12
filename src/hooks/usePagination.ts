import { useState, useMemo } from 'react'

export function usePagination<T = any>(data: T[] | undefined, pageSize: number = 20) {
  const [page, setPage] = useState(0)
  const totalPages = Math.max(1, Math.ceil((data?.length ?? 0) / pageSize))
  const paginatedData = useMemo(() => data?.slice(page * pageSize, (page + 1) * pageSize) ?? [], [data, page, pageSize]) as T[]
  return { page, setPage, totalPages, paginatedData, pageSize, totalItems: data?.length ?? 0 }
}
