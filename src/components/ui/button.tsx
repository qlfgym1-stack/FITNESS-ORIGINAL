import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "btn-shine relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:translate-y-[1px] active:shadow-none",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-br from-[#2563EB] via-primary to-secondary text-primary-foreground shadow-[0_4px_14px_-2px_rgba(37,99,235,0.55)] hover:shadow-[0_8px_24px_-4px_rgba(37,99,235,0.65)] hover:-translate-y-0.5",
        destructive:
          "bg-gradient-to-br from-[#ef4444] to-[#b91c1c] text-destructive-foreground shadow-[0_4px_14px_-2px_rgba(239,68,68,0.5)] hover:shadow-[0_8px_24px_-4px_rgba(239,68,68,0.6)] hover:-translate-y-0.5",
        outline:
          "border border-border bg-background/60 backdrop-blur-sm text-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary hover:-translate-y-0.5 hover:shadow-[0_6px_16px_-6px_rgba(37,99,235,0.35)]",
        secondary:
          "bg-secondary/90 text-secondary-foreground shadow-[0_4px_12px_-4px_rgba(37,99,235,0.5)] hover:bg-secondary hover:-translate-y-0.5",
        ghost: "text-foreground hover:bg-accent/40 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-lg px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
