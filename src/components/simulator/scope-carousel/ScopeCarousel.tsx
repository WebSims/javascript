import { useEffect, useCallback, useRef } from "react"
import { useActiveScope } from "@/contexts/ActiveScopeContext"
import { RenderDepthContext } from "@/contexts/RenderDepthContext"
import CodeArea from "@/components/simulator/code-area/CodeArea"
import { formatJSValue } from "@/utils/formatJSValue"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Crosshair } from "lucide-react"
import { ESNode } from "hermes-parser"

interface ScopeCarouselProps {
  className?: string
  showHeader?: boolean
  showNavigation?: boolean
  showDots?: boolean
}

// Separate component to properly use hook
const DotIndicators = ({ count, activeIndex }: { count: number; activeIndex: number }) => {
  const { setActiveFrame } = useActiveScope()
  
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: count }).map((_, index) => (
        <button
          key={index}
          onClick={() => setActiveFrame(index)}
          className={cn(
            "w-2 h-2 rounded-full transition-all duration-200",
            index === activeIndex 
              ? "bg-blue-500 scale-125" 
              : "bg-slate-300 hover:bg-slate-400"
          )}
          aria-label={`Go to frame ${index + 1}`}
        />
      ))}
    </div>
  )
}

const ScopeCarousel = ({ 
  className, 
  showHeader = true,
  showNavigation = true,
  showDots = true 
}: ScopeCarouselProps) => {
  const { 
    frames, 
    activeFrameIndex, 
    activeFrame,
    hasFrames,
    isAtDeepest,
    isAtRoot,
    navigateNext,
    navigatePrev,
    navigateToDeepest,
    totalFrames
  } = useActiveScope()

  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)
  const touchEndX = useRef<number | null>(null)

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!hasFrames) return
      
      // Check if focus is inside an input/textarea
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault()
        navigatePrev()
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault()
        navigateNext()
      } else if (e.key === "Home") {
        e.preventDefault()
        navigateToDeepest()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [hasFrames, navigateNext, navigatePrev, navigateToDeepest])

  // Touch/swipe handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchEndX.current = null
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (touchStartX.current === null || touchEndX.current === null) return
    
    const diff = touchStartX.current - touchEndX.current
    const threshold = 50 // minimum swipe distance

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        navigateNext()
      } else {
        navigatePrev()
      }
    }

    touchStartX.current = null
    touchEndX.current = null
  }, [navigateNext, navigatePrev])

  if (!hasFrames || !activeFrame) {
    return null
  }

  const fnName = activeFrame.fnNode.id?.name || "anonymous"
  
  // Format parameters with values
  const paramsWithValues = activeFrame.fnNode.params.map((param, i) => {
    const argVal = activeFrame.args[i]
    const formatted = argVal 
      ? formatJSValue(argVal, activeFrame.heapAtCall)
      : { display: "undefined" }
    return {
      name: (param as any).name || `arg${i}`,
      value: formatted.display
    }
  })

  // Get previous and next frame names for nav hints
  const prevFrame = activeFrameIndex > 0 ? frames[activeFrameIndex - 1] : null
  const nextFrame = activeFrameIndex < totalFrames - 1 ? frames[activeFrameIndex + 1] : null
  const prevName = prevFrame?.fnNode.id?.name || "anonymous"
  const nextName = nextFrame?.fnNode.id?.name || "anonymous"

  return (
    <div 
      ref={containerRef}
      className={cn(
        "flex flex-col h-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden",
        className
      )}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header with function name and params */}
      {showHeader && (
        <div className="bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-200 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            {/* Nav left */}
            {showNavigation && (
              <button
                onClick={navigatePrev}
                disabled={isAtRoot}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
                  "hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400",
                  isAtRoot && "opacity-30 cursor-not-allowed"
                )}
                aria-label="Previous scope"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline text-slate-500 truncate max-w-[80px]">
                  {prevFrame ? prevName : ""}
                </span>
              </button>
            )}

            {/* Center - Function signature */}
            <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
              <span className="text-purple-600 font-mono font-bold text-sm truncate">
                {fnName}
              </span>
              <span className="text-slate-500 font-mono text-sm">(</span>
              <div className="flex items-center gap-1 overflow-hidden">
                {paramsWithValues.map((p, i) => (
                  <span key={i} className="flex items-center whitespace-nowrap">
                    <span className="text-blue-600 font-mono text-xs">
                      {p.name}
                    </span>
                    <span className="text-slate-400 mx-0.5">=</span>
                    <span className="bg-slate-200/70 text-slate-700 px-1 py-0.5 rounded text-xs font-mono">
                      {p.value}
                    </span>
                    {i < paramsWithValues.length - 1 && (
                      <span className="text-slate-400 mr-1">,</span>
                    )}
                  </span>
                ))}
              </div>
              <span className="text-slate-500 font-mono text-sm">)</span>
            </div>

            {/* Nav right */}
            {showNavigation && (
              <button
                onClick={navigateNext}
                disabled={isAtDeepest}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
                  "hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400",
                  isAtDeepest && "opacity-30 cursor-not-allowed"
                )}
                aria-label="Next scope"
              >
                <span className="hidden sm:inline text-slate-500 truncate max-w-[80px]">
                  {nextFrame ? nextName : ""}
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Scope content */}
      <div className="flex-1 overflow-auto p-2">
        <RenderDepthContext.Provider value={activeFrameIndex + 1}>
          <CodeArea 
            ast={activeFrame.fnNode.body as ESNode} 
            parent={activeFrame.fnNode}
          />
        </RenderDepthContext.Provider>
      </div>

      {/* Footer with dot indicators and quick actions */}
      {(showDots || showNavigation) && totalFrames > 1 && (
        <div className="border-t border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center justify-center gap-3">
            {/* Dot indicators */}
            {showDots && (
              <DotIndicators 
                count={totalFrames} 
                activeIndex={activeFrameIndex} 
              />
            )}

            {/* Quick action: Jump to executing frame */}
            {!isAtDeepest && (
              <button
                onClick={navigateToDeepest}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded text-xs",
                  "bg-green-100 text-green-700 hover:bg-green-200 transition-colors",
                  "focus:outline-none focus:ring-2 focus:ring-green-400"
                )}
                aria-label="Jump to currently executing frame"
              >
                <Crosshair className="w-3 h-3" />
                <span className="hidden sm:inline">Jump to execution</span>
              </button>
            )}

            {/* Position indicator */}
            <span className="text-xs text-slate-400">
              {activeFrameIndex + 1} / {totalFrames}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default ScopeCarousel

