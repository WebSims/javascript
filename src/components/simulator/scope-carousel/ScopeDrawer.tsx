import { useEffect, useState } from "react"
import { useActiveScope } from "@/contexts/ActiveScopeContext"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import ScopeCarousel from "./ScopeCarousel"
import { cn } from "@/lib/utils"
import { Layers, X, Minimize2 } from "lucide-react"

interface ScopeDrawerProps {
  className?: string
}

const ScopeDrawer = ({ className }: ScopeDrawerProps) => {
  const { hasFrames, totalFrames, activeFrameIndex, activeFrame } = useActiveScope()
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)

  // Auto-open when frames appear, auto-close when they disappear
  useEffect(() => {
    if (hasFrames && !isOpen) {
      setIsOpen(true)
      setIsMinimized(false)
    } else if (!hasFrames && isOpen) {
      setIsOpen(false)
      setIsMinimized(false)
    }
  }, [hasFrames])

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      setIsMinimized(false)
    }
  }

  const handleMinimize = () => {
    setIsMinimized(true)
    setIsOpen(false)
  }

  const handleRestore = () => {
    setIsMinimized(false)
    setIsOpen(true)
  }

  const fnName = activeFrame?.fnNode.id?.name || "anonymous"

  // Minimized pill that floats at bottom
  if (isMinimized && hasFrames) {
    return (
      <button
        onClick={handleRestore}
        className={cn(
          "fixed bottom-4 left-1/2 -translate-x-1/2 z-50",
          "flex items-center gap-2 px-4 py-2 rounded-full",
          "bg-blue-600 text-white shadow-lg",
          "hover:bg-blue-700 transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
        )}
        aria-label="Restore call stack view"
      >
        <Layers className="w-4 h-4" />
        <span className="font-mono text-sm">{fnName}</span>
        <span className="bg-blue-500 px-1.5 py-0.5 rounded text-xs">
          {activeFrameIndex + 1}/{totalFrames}
        </span>
      </button>
    )
  }

  if (!hasFrames) {
    return null
  }

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      <DrawerContent 
        className={cn(
          "max-h-[85vh] focus:outline-none",
          className
        )}
      >
        <DrawerHeader className="border-b border-slate-200 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-500" />
              <DrawerTitle className="text-base">
                Call Stack
              </DrawerTitle>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {totalFrames} {totalFrames === 1 ? "frame" : "frames"}
              </span>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                onClick={handleMinimize}
                className={cn(
                  "p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100",
                  "focus:outline-none focus:ring-2 focus:ring-blue-400"
                )}
                aria-label="Minimize call stack"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className={cn(
                  "p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100",
                  "focus:outline-none focus:ring-2 focus:ring-blue-400"
                )}
                aria-label="Close call stack"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-hidden p-2">
          <ScopeCarousel 
            className="h-full border-0 shadow-none"
            showHeader={true}
            showNavigation={true}
            showDots={true}
          />
        </div>
      </DrawerContent>
    </Drawer>
  )
}

export default ScopeDrawer

