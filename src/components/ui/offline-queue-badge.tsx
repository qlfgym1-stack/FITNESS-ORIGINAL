import { useState } from "react"
import { useOfflineQueue } from "@/stores/offline-queue"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CloudOff, Trash2, RefreshCw } from "lucide-react"

export function OfflineQueueBadge() {
  const { queue, removeFromQueue, clearQueue } = useOfflineQueue()
  const [open, setOpen] = useState(false)

  if (queue.length === 0) return null

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="relative gap-1.5 mr-2 h-8"
        onClick={() => setOpen(true)}
      >
        <CloudOff className="h-4 w-4 text-amber-500" />
        <span className="text-xs font-medium text-amber-600">
          {queue.length} en attente
        </span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>File d&apos;attente hors-ligne</DialogTitle>
            <DialogDescription>
              {queue.length} opération{queue.length > 1 ? "s" : ""} en attente de synchronisation
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{item.operation}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.table} ·{" "}
                      {new Date(item.timestamp).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => removeFromQueue(item.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                clearQueue()
                setOpen(false)
              }}
            >
              Tout synchroniser
              <RefreshCw className="ml-2 h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
