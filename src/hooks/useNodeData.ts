import { useEffect, useState, useMemo, RefObject } from "react"
import { useSimulatorStore } from "./useSimulatorStore"
import { ESNode } from "hermes-parser"
import { EXEC_STEP_TYPE, BUBBLE_UP_TYPE, JSValue, ExecStep } from "@/types/simulator"
import { formatJSValue, FormattedValue } from "@/utils/formatJSValue"
import { useExecutionUiEnabled } from "@/contexts/ExecutionUiContext"
import { useScopedStep } from "@/contexts/ScopedStepContext"

export type NodeData = {
    isExecuting: boolean
    isExecuted: boolean
    isEvaluating: boolean
    isEvaluated: boolean
    isErrorThrown: boolean
    wasEvaluated: boolean
    evaluatedValue: FormattedValue | null
    rawValue: JSValue | null
}

/**
 * Check if a step matches a node by range and type
 */
const isStepForNode = (step: ExecStep, node: ESNode): boolean => {
    const stepRange = step.node?.range
    const nodeRange = node?.range
    if (!stepRange || !nodeRange) return false
    return (
        stepRange[0] === nodeRange[0] &&
        stepRange[1] === nodeRange[1] &&
        step.node.type === node.type
    )
}

const getFunctionDepth = (step: ExecStep): number => {
    const scopes = step.memorySnapshot?.scopes || []
    return scopes.reduce((count, scope) => (scope.type === "function" ? count + 1 : count), 0)
}

/**
 * Custom hook to get rendering data for an AST node
 * Provides execution state and evaluated value for display
 * Persists evaluated values from previous steps
 * 
 * @param node - The AST node to track
 * @param ref - Optional ref for scroll behavior
 * @returns NodeData with execution state and evaluated value
 */
export const useNodeData = (node?: ESNode, ref?: RefObject<HTMLElement | null>): NodeData => {
    const { currentStep: globalCurrentStep, steps } = useSimulatorStore()
    const isExecutionUiEnabled = useExecutionUiEnabled()
    const scopedStepState = useScopedStep()
    const currentStep = scopedStepState.step || globalCurrentStep
    const [isExecuting, setIsExecuting] = useState(false)
    const [isExecuted, setIsExecuted] = useState(false)
    const [isEvaluating, setIsEvaluating] = useState(false)
    const [isEvaluated, setIsEvaluated] = useState(false)
    const [isErrorThrown, setIsErrorThrown] = useState(false)

    const stepRange = currentStep?.node?.range
    const nodeRange = node?.range

    const checkExecuting = (node: ESNode): boolean => {
        if (stepRange && nodeRange) {
            return (
                stepRange[0] === nodeRange[0] &&
                stepRange[1] === nodeRange[1] &&
                currentStep.node.type === node.type &&
                (currentStep.type === EXEC_STEP_TYPE.EXECUTING || 
                 currentStep.type === EXEC_STEP_TYPE.PUSH_SCOPE || 
                 currentStep.type === EXEC_STEP_TYPE.HOISTING)
            )
        }
        return false
    }

    const checkExecuted = (node: ESNode): boolean => {
        if (stepRange && nodeRange) {
            return (
                stepRange[0] === nodeRange[0] &&
                stepRange[1] === nodeRange[1] &&
                currentStep.node.type === node.type &&
                (currentStep.type === EXEC_STEP_TYPE.EXECUTED || 
                 currentStep.type === EXEC_STEP_TYPE.POP_SCOPE)
            )
        }
        return false
    }

    const checkEvaluating = (node: ESNode): boolean => {
        if (stepRange && nodeRange) {
            return (
                stepRange[0] === nodeRange[0] &&
                stepRange[1] === nodeRange[1] &&
                currentStep.node.type === node.type &&
                (currentStep.type === EXEC_STEP_TYPE.EVALUATING || 
                 currentStep.type === EXEC_STEP_TYPE.FUNCTION_CALL)
            )
        }
        return false
    }

    const checkEvaluated = (node: ESNode): boolean => {
        if (stepRange && nodeRange) {
            return (
                stepRange[0] === nodeRange[0] &&
                stepRange[1] === nodeRange[1] &&
                currentStep.node.type === node.type &&
                currentStep.type === EXEC_STEP_TYPE.EVALUATED
            )
        }
        return false
    }

    const checkErrorThrown = (node: ESNode): boolean => {
        if (stepRange && nodeRange) {
            return (
                stepRange[0] === nodeRange[0] &&
                stepRange[1] === nodeRange[1] &&
                currentStep.node.type === node.type &&
                currentStep.bubbleUp === BUBBLE_UP_TYPE.THROW
            )
        }
        return false
    }

    useEffect(() => {
        if (!isExecutionUiEnabled) {
            setIsExecuting(false)
            setIsExecuted(false)
            setIsEvaluating(false)
            setIsEvaluated(false)
            setIsErrorThrown(false)
            return
        }
        if (!currentStep) {
            setIsExecuting(false)
            setIsExecuted(false)
            setIsEvaluating(false)
            setIsEvaluated(false)
            setIsErrorThrown(false)
            return
        }
        if (node) {
            setIsExecuting(checkExecuting(node))
            setIsExecuted(checkExecuted(node))
            setIsEvaluating(checkEvaluating(node))
            setIsEvaluated(checkEvaluated(node))
            setIsErrorThrown(checkErrorThrown(node))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentStep, node, isExecutionUiEnabled])

    useEffect(() => {
        if (!isExecutionUiEnabled) return
        if ((isExecuting || isExecuted || isEvaluating || isEvaluated) && ref?.current) {
            ref.current.scrollIntoView({ behavior: "smooth", block: "center" })
        }
    }, [isExecuting, isExecuted, isEvaluating, isEvaluated, ref, isExecutionUiEnabled])

    // Find the evaluated value from current or previous steps
    const { evaluatedValue, rawValue, wasEvaluated } = useMemo(() => {
        if (!isExecutionUiEnabled) {
            return { evaluatedValue: null, rawValue: null, wasEvaluated: false }
        }
        if (!node || !currentStep || !steps.length) {
            return { evaluatedValue: null, rawValue: null, wasEvaluated: false }
        }

        const currentIndex = currentStep.index
        const startIndex = scopedStepState.startIndex ?? 0
        const selectedFunctionDepth = getFunctionDepth(currentStep)

        // Search backwards from current step to find when this node was evaluated
        for (let i = currentIndex; i >= startIndex; i--) {
            const step = steps[i]
            if (getFunctionDepth(step) > selectedFunctionDepth) continue
            
            // Check if this step is an EVALUATED step for our node
            if (step.type === EXEC_STEP_TYPE.EVALUATED && isStepForNode(step, node)) {
                // Found the evaluation step - get the value from memvalChanges
                const pushChange = step.memvalChanges.find(change => change.type === "push")
                
                if (pushChange) {
                    // Use the heap from the step where evaluation happened
                    const heap = step.memorySnapshot.heap
                    return {
                        evaluatedValue: formatJSValue(pushChange.value, heap),
                        rawValue: pushChange.value,
                        wasEvaluated: true
                    }
                }

                // For CallExpression: return value is at top of memval stack (pushed by ReturnStatement)
                // but not in memvalChanges (which was reset after ReturnStatement step)
                if (node.type === "CallExpression" && step.memorySnapshot.memval.length > 0) {
                    const returnValue = step.memorySnapshot.memval[step.memorySnapshot.memval.length - 1]
                    const heap = step.memorySnapshot.heap
                    return {
                        evaluatedValue: formatJSValue(returnValue, heap),
                        rawValue: returnValue,
                        wasEvaluated: true
                    }
                }
            }
        }

        return { evaluatedValue: null, rawValue: null, wasEvaluated: false }
    }, [node, currentStep, steps, isExecutionUiEnabled])

    return {
        isExecuting,
        isExecuted,
        isEvaluating,
        isEvaluated,
        isErrorThrown,
        wasEvaluated,
        evaluatedValue,
        rawValue
    }
}
