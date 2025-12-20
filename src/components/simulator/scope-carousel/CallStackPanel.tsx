import { useActiveScope } from "@/contexts/ActiveScopeContext"
import { formatJSValue } from "@/utils/formatJSValue"
import { cn } from "@/lib/utils"
import { ChevronRight, Play, Layers } from "lucide-react"

interface CallStackPanelProps {
  className?: string
  compact?: boolean
}

const CallStackPanel = ({ className, compact = false }: CallStackPanelProps) => {
  const { 
    frames, 
    activeFrameIndex, 
    setActiveFrame, 
    hasFrames,
    isAtDeepest 
  } = useActiveScope()

  if (!hasFrames) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center text-slate-400 p-4",
        className
      )}>
        <Layers className="w-8 h-8 mb-2 opacity-50" />
        <span className="text-sm">No active call stack</span>
      </div>
    )
  }

  return (
    <div className={cn(
      "flex flex-col bg-slate-50 border-r border-slate-200",
      className
    )}>
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-200 bg-slate-100">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Call Stack
          </span>
          <span className="ml-auto text-xs text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">
            {frames.length}
          </span>
        </div>
      </div>

      {/* Stack Frames */}
      <div className="flex-1 overflow-auto">
        <div className="py-1">
          {frames.map((frame, index) => {
            const isActive = index === activeFrameIndex
            const isDeepest = index === frames.length - 1
            const fnName = frame.fnNode.id?.name || "anonymous"
            
            // Format arguments for display
            const argsPreview = frame.fnNode.params.map((param, i) => {
              const argVal = frame.args[i]
              const formatted = argVal 
                ? formatJSValue(argVal, frame.heapAtCall)
                : { display: "undefined" }
              return {
                name: (param as any).name || `arg${i}`,
                value: formatted.display
              }
            })

            return (
              <button
                key={`${frame.callNodeKey}-${index}`}
                onClick={() => setActiveFrame(index)}
                className={cn(
                  "w-full text-left px-2 py-1.5 transition-all duration-150",
                  "hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400",
                  "flex items-center gap-1 group",
                  isActive && "bg-blue-50 hover:bg-blue-100 border-l-2 border-blue-500",
                  !isActive && "border-l-2 border-transparent"
                )}
                aria-label={`Navigate to ${fnName} scope`}
                aria-current={isActive ? "true" : undefined}
              >
                {/* Depth indicator */}
                <div 
                  className="flex items-center shrink-0"
                  style={{ paddingLeft: compact ? 0 : `${index * 8}px` }}
                >
                  {index > 0 && !compact && (
                    <ChevronRight className="w-3 h-3 text-slate-300" />
                  )}
                </div>

                {/* Frame content */}
                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                  {/* Execution indicator */}
                  {isDeepest && (
                    <Play 
                      className={cn(
                        "w-3 h-3 shrink-0 fill-current",
                        isActive ? "text-blue-500" : "text-green-500"
                      )} 
                    />
                  )}

                  {/* Function name */}
                  <span className={cn(
                    "font-mono text-sm font-medium truncate",
                    isActive ? "text-blue-700" : "text-purple-600"
                  )}>
                    {fnName}
                  </span>

                  {/* Arguments preview */}
                  {!compact && (
                    <span className="text-slate-400 text-xs truncate">
                      ({argsPreview.map((a, i) => (
                        <span key={i}>
                          <span className="text-slate-500">{a.name}</span>
                          <span className="text-slate-400">=</span>
                          <span className="text-slate-600">{a.value}</span>
                          {i < argsPreview.length - 1 && ", "}
                        </span>
                      ))})
                    </span>
                  )}
                </div>

                {/* Frame index badge */}
                <span className={cn(
                  "text-[10px] px-1 py-0.5 rounded shrink-0",
                  isActive 
                    ? "bg-blue-200 text-blue-700" 
                    : "bg-slate-200 text-slate-500 group-hover:bg-slate-300"
                )}>
                  {index + 1}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default CallStackPanel

