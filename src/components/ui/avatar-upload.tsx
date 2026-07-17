import { useState, useRef, useCallback } from 'react'
import { useSupabase } from '@/hooks/useSupabase'
import { IS_MOCK } from '@/lib/config'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { Camera, Loader2, User } from 'lucide-react'
import { getInitials } from '@/lib/utils'

interface AvatarUploadProps {
  orgId: string
  memberId: string
  currentUrl?: string | null
  firstName?: string
  lastName?: string
  onUploadComplete: (url: string) => void
}

export function useAvatarUpload({ orgId, memberId, currentUrl, onUploadComplete }: Pick<AvatarUploadProps, 'orgId' | 'memberId' | 'currentUrl' | 'onUploadComplete'>) {
  const supabase = useSupabase()
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentUrl ?? null)

  const upload = useCallback(async (file: File) => {
    setUploading(true)
    setUploadError(null)
    try {
      if (IS_MOCK) {
        const url = URL.createObjectURL(file)
        setAvatarUrl(url)
        onUploadComplete(url)
        return
      }
      const ext = file.name.split('.').pop() || 'jpg'
      const filePath = `${orgId}/${memberId}/${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('photos').upload(filePath, file)
      if (uploadError) {
        setUploadError(uploadError.message)
        toast({ title: "Erreur upload", description: uploadError.message, variant: "destructive" })
        return
      }
      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(filePath)
      const url = urlData.publicUrl
      setAvatarUrl(url)
      onUploadComplete(url)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed'
      setUploadError(msg)
      toast({ title: "Erreur", description: msg, variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }, [orgId, memberId, onUploadComplete, supabase, toast])

  return { uploading, uploadError, avatarUrl, setAvatarUrl, upload }
}

export function AvatarUpload({ orgId, memberId, currentUrl, firstName, lastName, onUploadComplete }: AvatarUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const { uploading, uploadError, avatarUrl, upload } = useAvatarUpload({ orgId, memberId, currentUrl, onUploadComplete })

  function handleClick() {
    fileRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) upload(file)
  }

  return (
    <div className="relative group">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={handleClick}
        className="relative block w-32 h-32 rounded-lg overflow-hidden border border-border focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <Avatar className="w-32 h-32 rounded-lg">
          {avatarUrl ? (
            <AvatarImage src={avatarUrl} className="object-cover" />
          ) : null}
          <AvatarFallback className="rounded-lg bg-muted text-xl">
            {firstName && lastName ? getInitials(firstName, lastName) : <User className="h-8 w-8 text-muted-foreground" />}
          </AvatarFallback>
        </Avatar>
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {uploading ? (
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          ) : (
            <Camera className="h-6 w-6 text-white" />
          )}
        </div>
      </button>
      {uploadError && (
        <p className="text-xs text-destructive pt-1">{uploadError}</p>
      )}
    </div>
  )
}
