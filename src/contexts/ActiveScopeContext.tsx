import { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from "react"
import { CallFrame, useFunctionCallStack } from "@/hooks/useFunctionCallStack"

interface ActiveScopeState {
  activeFrameIndex: number
  frames: CallFrame[]
  totalFrames: number
  activeFrame: CallFrame | null
  hasFrames: boolean
  isAtDeepest: boolean
  isAtRoot: boolean
  setActiveFrame: (index: number) => void
  navigateNext: () => void
  navigatePrev: () => void
  navigateToDeepest: () => void
  navigateToRoot: () => void
}

const ActiveScopeContext = createContext<ActiveScopeState | null>(null)

export const useActiveScope = () => {
  const context = useContext(ActiveScopeContext)
  if (!context) {
    throw new Error("useActiveScope must be used within an ActiveScopeProvider")
  }
  return context
}

export const useActiveScopeOptional = () => {
  return useContext(ActiveScopeContext)
}

interface ActiveScopeProviderProps {
  children: ReactNode
  autoFollowDeepest?: boolean
}

export const ActiveScopeProvider = ({ 
  children, 
  autoFollowDeepest = true 
}: ActiveScopeProviderProps) => {
  const frames = useFunctionCallStack()
  const [activeFrameIndex, setActiveFrameIndex] = useState(0)
  const [userHasNavigated, setUserHasNavigated] = useState(false)

  const totalFrames = frames.length
  const hasFrames = totalFrames > 0

  // Auto-follow deepest frame when execution changes (unless user manually navigated)
  useEffect(() => {
    if (autoFollowDeepest && !userHasNavigated && totalFrames > 0) {
      setActiveFrameIndex(totalFrames - 1)
    }
  }, [totalFrames, autoFollowDeepest, userHasNavigated])

  // Reset user navigation flag when frames change significantly
  useEffect(() => {
    if (totalFrames === 0) {
      setUserHasNavigated(false)
      setActiveFrameIndex(0)
    }
  }, [totalFrames])

  // Clamp activeFrameIndex when frames shrink
  useEffect(() => {
    if (activeFrameIndex >= totalFrames && totalFrames > 0) {
      setActiveFrameIndex(totalFrames - 1)
    }
  }, [activeFrameIndex, totalFrames])

  const setActiveFrame = useCallback((index: number) => {
    if (index >= 0 && index < totalFrames) {
      setActiveFrameIndex(index)
      setUserHasNavigated(true)
    }
  }, [totalFrames])

  const navigateNext = useCallback(() => {
    if (activeFrameIndex < totalFrames - 1) {
      setActiveFrameIndex(prev => prev + 1)
      setUserHasNavigated(true)
    }
  }, [activeFrameIndex, totalFrames])

  const navigatePrev = useCallback(() => {
    if (activeFrameIndex > 0) {
      setActiveFrameIndex(prev => prev - 1)
      setUserHasNavigated(true)
    }
  }, [activeFrameIndex])

  const navigateToDeepest = useCallback(() => {
    if (totalFrames > 0) {
      setActiveFrameIndex(totalFrames - 1)
      setUserHasNavigated(false)
    }
  }, [totalFrames])

  const navigateToRoot = useCallback(() => {
    setActiveFrameIndex(0)
    setUserHasNavigated(true)
  }, [])

  const value = useMemo<ActiveScopeState>(() => ({
    activeFrameIndex,
    frames,
    totalFrames,
    activeFrame: hasFrames ? frames[activeFrameIndex] ?? null : null,
    hasFrames,
    isAtDeepest: activeFrameIndex === totalFrames - 1,
    isAtRoot: activeFrameIndex === 0,
    setActiveFrame,
    navigateNext,
    navigatePrev,
    navigateToDeepest,
    navigateToRoot,
  }), [
    activeFrameIndex, 
    frames, 
    totalFrames, 
    hasFrames, 
    setActiveFrame, 
    navigateNext, 
    navigatePrev, 
    navigateToDeepest, 
    navigateToRoot
  ])

  return (
    <ActiveScopeContext.Provider value={value}>
      {children}
    </ActiveScopeContext.Provider>
  )
}

export default ActiveScopeContext

