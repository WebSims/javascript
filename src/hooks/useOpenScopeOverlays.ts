import { useMemo } from "react"
import { useSimulatorStore } from "@/hooks/useSimulatorStore"
import { useScopedStep } from "@/contexts/ScopedStepContext"
import { EXEC_STEP_TYPE, ScopeKind, ExecStep } from "@/types/simulator"

type ScopeOverlayEntry = {
  key: string
  kind: ScopeKind
}

const getRangeKey = (step: ExecStep): string => {
  const range = step.node?.range
  if (!range) return ""
  return `${range[0]}-${range[1]}`
}

export const useOpenScopeOverlays = () => {
  const { steps, currentStep: globalCurrentStep } = useSimulatorStore()
  const { step: scopedStep } = useScopedStep()
  const currentStep = scopedStep || globalCurrentStep

  return useMemo(() => {
    if (!currentStep || !steps.length) {
      return { scopeDepthsByKey: {} as Record<string, number[]> }
    }

    const endIndex = currentStep.index
    const safeStartIndex = 0

    const stack: ScopeOverlayEntry[] = []

    for (let i = safeStartIndex; i <= endIndex; i++) {
      const step = steps[i]
      if (!step) continue

      if (
        step.type === EXEC_STEP_TYPE.PUSH_SCOPE &&
        step.memoryChange.type === "push_scope"
      ) {
        const key = getRangeKey(step)
        if (!key) continue
        stack.push({ key, kind: step.memoryChange.kind })
      }

      if (
        step.type === EXEC_STEP_TYPE.POP_SCOPE &&
        step.memoryChange.type === "pop_scope"
      ) {
        const kind = step.memoryChange.kind
        const lastMatchIndex = (() => {
          for (let j = stack.length - 1; j >= 0; j--) {
            if (stack[j].kind === kind) return j
          }
          return -1
        })()

        if (lastMatchIndex !== -1) {
          stack.splice(lastMatchIndex, 1)
        }
      }
    }

    const scopeDepthsByKey = stack.reduce<Record<string, number[]>>((acc, s, i) => {
      const existing = acc[s.key] || []
      acc[s.key] = [...existing, i]
      return acc
    }, {})

    return { scopeDepthsByKey }
  }, [currentStep, steps])
}


