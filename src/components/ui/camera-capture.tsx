import { useState, useRef, useCallback, useEffect } from "react"
import { useSupabase } from "@/hooks/useSupabase"
import { IS_MOCK } from "@/lib/config"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { Camera, Loader2, RotateCcw, Check } from "lucide-react"

interface CameraCaptureProps {
  memberId: string
  onPhotoUploaded: (url: string) => void
}

export function CameraCapture({ memberId, onPhotoUploaded }: CameraCaptureProps) {
  const supabase = useSupabase()
  const { toast } = useToast()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [active, setActive] = useState(false)
  const [captured, setCaptured] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    return () => { stopCamera() }
  }, [])

  useEffect(() => {
    if (active && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [active])

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      setActive(true)
      setCaptured(null)
    } catch (e) {
      setActive(false)
      toast({ title: "Erreur caméra", description: e instanceof Error ? e.message : "Impossible d'accéder à la caméra", variant: "destructive" })
    }
  }

  function capture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = 640
    canvas.height = 480
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0, 640, 480)
    const dataUrl = canvas.toDataURL("image/png")
    setCaptured(dataUrl)
    stopCamera()
    setActive(false)
  }

  const upload = useCallback(async () => {
    if (!captured) return
    setUploading(true)
    try {
      const res = await fetch(captured)
      const blob = await res.blob()
      const uid = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const filePath = `${memberId}/${uid}.png`
      if (IS_MOCK) {
        onPhotoUploaded(URL.createObjectURL(blob))
        return
      }
      const { error: uploadError } = await supabase.storage.from("photos").upload(filePath, blob, {
        contentType: "image/png",
      })
      if (uploadError) {
        toast({ title: "Erreur upload", description: uploadError.message, variant: "destructive" })
        return
      }
      const { data: urlData } = supabase.storage.from("photos").getPublicUrl(filePath)
      onPhotoUploaded(urlData.publicUrl)
    } catch (e) {
      toast({ title: "Erreur", description: e instanceof Error ? e.message : "Échec de l'envoi", variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }, [captured, memberId, onPhotoUploaded, supabase, toast])

  function handleCancel() {
    stopCamera()
    setActive(false)
    setCaptured(null)
  }

  return (
    <div className="space-y-3">
      <canvas ref={canvasRef} className="hidden" />
      {!active && !captured && (
        <Button type="button" variant="outline" className="w-full" onClick={startCamera}>
          <Camera className="mr-2 h-4 w-4" />
          Prendre une photo
        </Button>
      )}
      {active && (
        <div className="space-y-2">
          <div className="relative rounded-lg overflow-hidden bg-black">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-48 object-cover" />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={capture}>
              <Camera className="mr-2 h-4 w-4" />
              Capturer
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
              Annuler
            </Button>
          </div>
        </div>
      )}
      {captured && (
        <div className="space-y-2">
          <div className="relative rounded-lg overflow-hidden bg-muted">
            <img src={captured} alt="Photo capturée" className="w-full h-48 object-cover" />
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" className="flex-1" onClick={upload} disabled={uploading}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              {uploading ? "Upload..." : "Enregistrer"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={startCamera}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reprendre
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
