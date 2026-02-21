import React, { useMemo, useState, useCallback, useEffect } from "react"
import { useScopeMorph } from "@/contexts/ScopeMorphContext"
import { useSimulatorStore } from "@/hooks/useSimulatorStore"
import { useFunctionCallStack } from "@/hooks/useFunctionCallStack"
import CodeArea from "./CodeArea"
import ScopeCard from "./ScopeCard"

const ScopeCardStack: React.FC = () => {
  const { entries, containerRef, activeCardIndex } = useScopeMorph()
  const { steps, currentStep } = useSimulatorStore()
  const frames = useFunctionCallStack()
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null)

  const activeEntries = entries.filter(e => e.phase !== "exiting")
  const hasActiveCards = activeEntries.length > 0
  const allEntries = entries

  const updateContainerRect = useCallback(() => {
    if (containerRef.current) {
      setContainerRect(containerRef.current.getBoundingClientRect())
    }
  }, [containerRef])

  useEffect(() => {
    updateContainerRect()

    const observer = new ResizeObserver(() => {
      updateContainerRect()
    })

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [containerRef, updateContainerRect])

  const programPushDepth = useMemo(() => {
    if (!hasActiveCards) return 0
    return Math.min(activeCardIndex + 1, activeEntries.length)
  }, [hasActiveCards, activeCardIndex, activeEntries.length])

  const programStyle = useMemo((): React.CSSProperties => {
    if (!hasActiveCards) {
      return {
        opacity: 1,
        filter: "none",
      }
    }

    const d = Math.min(programPushDepth, 3)
    return {
      opacity: Math.max(0.3, 1 - d * 0.25),
      filter: `blur(${d * 1.2}px)`,
      pointerEvents: "none",
    }
  }, [hasActiveCards, programPushDepth])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
    >
      <div
        className="absolute inset-0"
        style={{
          ...programStyle,
          transition: "opacity 700ms ease, filter 700ms ease",
        }}
      >
        <CodeArea />
      </div>

      {allEntries.map((entry, i) => (
        <ScopeCard
          key={entry.id}
          entry={entry}
          cardIndex={i}
          activeCardIndex={activeCardIndex}
          totalEntries={activeEntries.length}
          frames={frames}
          steps={steps}
          currentStep={currentStep}
          containerRect={containerRect}
        />
      ))}
    </div>
  )
}

export default ScopeCardStack
