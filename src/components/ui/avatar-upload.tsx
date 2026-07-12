import { useState, useRef, useCallback } from 'react'
import { useSupabase } from '@/hooks/useSupabase'
import { IS_MOCK } from '@/lib/config'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Camera, Loader2, User } from 'lucide-react'
import { getInitials } from '@/lib/utils'

interface AvatarUploadProps {
  memberId: string
  currentUrl?: string | null
  firstName?: string
  lastName?: string
  onUploadComplete: (url: string) => void
}

export function useAvatarUpload({ memberId, currentUrl, onUploadComplete }: Pick<AvatarUploadProps, 'memberId' | 'currentUrl' | 'onUploadComplete'>) {
  const supabase = useSupabase()
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
      const filePath = `${memberId}/${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('photos').upload(filePath, file)
      if (uploadError) {
        setUploadError(uploadError.message)
        return
      }
      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(filePath)
      const url = urlData.publicUrl
      setAvatarUrl(url)
      onUploadComplete(url)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [memberId, onUploadComplete, supabase])

  return { uploading, uploadError, avatarUrl, setAvatarUrl, upload }
}

export function AvatarUpload({ memberId, currentUrl, firstName, lastName, onUploadComplete }: AvatarUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const { uploading, avatarUrl, upload } = useAvatarUpload({ memberId, currentUrl, onUploadComplete })

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
    </div>
  )
}
