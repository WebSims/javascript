import { useMemo } from "react"
import { useSimulatorStore } from "@/hooks/useSimulatorStore"
import { useScopedStep } from "@/contexts/ScopedStepContext"
import { formatJSValue, type FormattedValue } from "@/utils/formatJSValue"

export const useInScopeVariableValue = (variableName?: string) => {
  const { currentStep: globalCurrentStep } = useSimulatorStore()
  const { step: scopedStep } = useScopedStep()
  const currentStep = scopedStep || globalCurrentStep

  return useMemo<FormattedValue | null>(() => {
    if (!currentStep) return null
    if (!variableName) return null

    const scopes = currentStep.memorySnapshot.scopes
    const heap = currentStep.memorySnapshot.heap

    for (let i = scopes.length - 1; i >= 0; i--) {
      const variable = scopes[i]?.variables?.[variableName]
      if (!variable) continue

      const jsValue = variable.value
      if (jsValue.type === "primitive" && jsValue.value === "not_initialized") {
        return { display: "<TDZ>", type: "primitive" }
      }

      return formatJSValue(jsValue, heap)
    }

    return null
  }, [currentStep, variableName])
}


