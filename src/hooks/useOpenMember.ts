import { useCallback } from "react"
import { useNavigate } from "react-router-dom"

export function useOpenMember() {
  const navigate = useNavigate()
  return useCallback((memberId: string | null | undefined) => {
    if (!memberId) return
    navigate(`/members?id=${encodeURIComponent(memberId)}`)
  }, [navigate])
}
