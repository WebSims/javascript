import {
  createContext,
  useContext,
  useCallback,
  useLayoutEffect,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { CallFrame } from "@/hooks/useFunctionCallStack"
import { useActiveScopeOptional } from "@/contexts/ActiveScopeContext"
import { useSimulatorStore } from "@/hooks/useSimulatorStore"

export type MorphPhase = "entering" | "active" | "exiting"

export type ScopeMorphEntry = {
  id: string
  frame: CallFrame
  callLabel: string
  originRect: DOMRect | null
  phase: MorphPhase
}

type RefRegistryEntry = {
  element: HTMLElement
  label: string
}

export type ScopeMorphState = {
  entries: ScopeMorphEntry[]
  containerRef: React.RefObject<HTMLDivElement | null>
  registerCallRef: (nodeKey: string, element: HTMLElement | null, label: string) => void
  activeCardIndex: number
  setActiveCardIndex: (index: number) => void
}

const ScopeMorphContext = createContext<ScopeMorphState>({
  entries: [],
  containerRef: { current: null },
  registerCallRef: () => {},
  activeCardIndex: -1,
  setActiveCardIndex: () => {},
})

export const useScopeMorph = () => useContext(ScopeMorphContext)

const buildCallLabel = (frame: CallFrame): string => {
  const fnName = frame.fnNode.id?.name ?? "anonymous"
  const paramNames = frame.fnNode.params.map((p: any) => {
    if (p.type === "Identifier") return p.name
    if (p.type === "AssignmentPattern" && p.left?.type === "Identifier") return p.left.name
    if (p.type === "RestElement" && p.argument?.type === "Identifier") return `...${p.argument.name}`
    return "..."
  })
  return `${fnName}(${paramNames.join(", ")})`
}

interface ScopeMorphProviderProps {
  children: ReactNode
}

export const ScopeMorphProvider = ({ children }: ScopeMorphProviderProps) => {
  const activeScope = useActiveScopeOptional()
  const { currentStep } = useSimulatorStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const refRegistryRef = useRef<Map<string, RefRegistryEntry>>(new Map())
  const [entries, setEntries] = useState<ScopeMorphEntry[]>([])
  const [activeCardIndex, setActiveCardIndex] = useState(-1)
  const prevFrameIdsRef = useRef<string[]>([])
  const prevStepIndexRef = useRef<number>(currentStep?.index ?? 0)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const frames = activeScope?.frames ?? []
  const frameIds = useMemo(
    () => frames.map(f => `${f.callNodeKey}@${f.stepIndex}`),
    [frames],
  )

  const registerCallRef = useCallback(
    (nodeKey: string, element: HTMLElement | null, label: string) => {
      if (element) {
        refRegistryRef.current.set(nodeKey, { element, label })
      } else {
        refRegistryRef.current.delete(nodeKey)
      }
    },
    [],
  )

  useLayoutEffect(() => {
    const prevIds = prevFrameIdsRef.current
    const currentIds = frameIds

    if (
      prevIds.length === currentIds.length &&
      prevIds.every((id, i) => id === currentIds[i])
    ) {
      prevStepIndexRef.current = currentStep?.index ?? 0
      return
    }

    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current)
      exitTimerRef.current = null
    }

    const stepDelta = Math.abs((currentStep?.index ?? 0) - prevStepIndexRef.current)
    const shouldAnimate = stepDelta === 1
    prevStepIndexRef.current = currentStep?.index ?? 0

    const isPush = currentIds.length > prevIds.length
    const isPop = currentIds.length < prevIds.length

    const buildActiveEntries = () =>
      frames.map((frame, i) => ({
        id: currentIds[i],
        frame,
        callLabel: buildCallLabel(frame),
        originRect: refRegistryRef.current.get(frame.callNodeKey)?.element?.getBoundingClientRect() ?? null,
        phase: "active" as MorphPhase,
      }))

    if (!shouldAnimate) {
      setEntries(buildActiveEntries())
      setActiveCardIndex(frames.length > 0 ? frames.length - 1 : -1)
      prevFrameIdsRef.current = currentIds
      return
    }

    if (isPush) {
      const newEntries: ScopeMorphEntry[] = []
      for (let i = prevIds.length; i < currentIds.length; i++) {
        const frame = frames[i]
        const refEntry = refRegistryRef.current.get(frame.callNodeKey)
        const originRect = refEntry?.element?.getBoundingClientRect() ?? null

        newEntries.push({
          id: currentIds[i],
          frame,
          callLabel: buildCallLabel(frame),
          originRect,
          phase: "entering",
        })
      }

      setEntries(prev => {
        const cleaned = prev.filter(e => e.phase !== "exiting")
        return [...cleaned, ...newEntries]
      })
      setActiveCardIndex(currentIds.length - 1)

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setEntries(prev =>
            prev.map(e =>
              e.phase === "entering" ? { ...e, phase: "active" as MorphPhase } : e,
            ),
          )
        })
      })
    } else if (isPop) {
      setEntries(prev => {
        const kept = prev.slice(0, currentIds.length)
        const removed = prev.slice(currentIds.length)
        return [
          ...kept.map(e => ({ ...e, phase: "active" as MorphPhase })),
          ...removed.map(e => ({
            ...e,
            phase: "exiting" as MorphPhase,
            originRect: refRegistryRef.current.get(e.frame.callNodeKey)?.element?.getBoundingClientRect() ?? e.originRect,
          })),
        ]
      })
      setActiveCardIndex(Math.max(-1, currentIds.length - 1))

      exitTimerRef.current = setTimeout(() => {
        setEntries(prev => prev.filter(e => e.phase !== "exiting"))
        exitTimerRef.current = null
      }, 900)
    } else {
      setEntries(buildActiveEntries())
      setActiveCardIndex(frames.length > 0 ? frames.length - 1 : -1)
    }

    prevFrameIdsRef.current = currentIds
  }, [frameIds, frames, currentStep])

  useEffect(() => {
    if (activeScope && activeScope.hasFrames) {
      setActiveCardIndex(activeScope.activeFrameIndex)
    } else if (!activeScope?.hasFrames && entries.every(e => e.phase === "exiting" || e.phase === "active")) {
      setActiveCardIndex(-1)
    }
  }, [activeScope?.activeFrameIndex, activeScope?.hasFrames])

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    }
  }, [])

  const value = useMemo<ScopeMorphState>(
    () => ({
      entries,
      containerRef,
      registerCallRef,
      activeCardIndex,
      setActiveCardIndex,
    }),
    [entries, registerCallRef, activeCardIndex],
  )

  return (
    <ScopeMorphContext.Provider value={value}>
      {children}
    </ScopeMorphContext.Provider>
  )
}

export default ScopeMorphContext
