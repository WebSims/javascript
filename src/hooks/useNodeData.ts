import { useEffect, useState, useMemo, RefObject } from "react"
import { useSimulatorStore } from "./useSimulatorStore"
import { ESNode } from "hermes-parser"
import { EXEC_STEP_TYPE, BUBBLE_UP_TYPE, JSValue } from "@/types/simulator"
import { formatJSValue, FormattedValue } from "@/utils/formatJSValue"

export type NodeData = {
    isExecuting: boolean
    isExecuted: boolean
    isEvaluating: boolean
    isEvaluated: boolean
    isErrorThrown: boolean
    evaluatedValue: FormattedValue | null
    rawValue: JSValue | null
}

/**
 * Custom hook to get rendering data for an AST node
 * Provides execution state and evaluated value for display
 * 
 * @param node - The AST node to track
 * @param ref - Optional ref for scroll behavior
 * @returns NodeData with execution state and evaluated value
 */
export const useNodeData = (node?: ESNode, ref?: RefObject<HTMLElement | null>): NodeData => {
    const { currentStep } = useSimulatorStore()
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
        if (node) {
            setIsExecuting(checkExecuting(node))
            setIsExecuted(checkExecuted(node))
            setIsEvaluating(checkEvaluating(node))
            setIsEvaluated(checkEvaluated(node))
            setIsErrorThrown(checkErrorThrown(node))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentStep, node])

    useEffect(() => {
        if ((isExecuting || isExecuted || isEvaluating || isEvaluated) && ref?.current) {
            ref.current.scrollIntoView({ behavior: "smooth", block: "center" })
        }
    }, [isExecuting, isExecuted, isEvaluating, isEvaluated, ref])

    // Get the evaluated value when node is evaluated
    const { evaluatedValue, rawValue } = useMemo(() => {
        if (!isEvaluated || !currentStep) {
            return { evaluatedValue: null, rawValue: null }
        }

        // When a node is evaluated, the value is pushed to memval
        // Look for the push operation in memvalChanges
        const pushChange = currentStep.memvalChanges.find(change => change.type === "push")
        
        if (pushChange) {
            const heap = currentStep.memorySnapshot.heap
            return {
                evaluatedValue: formatJSValue(pushChange.value, heap),
                rawValue: pushChange.value
            }
        }

        // Fallback: get the last value from memval stack
        const memval = currentStep.memorySnapshot.memval
        if (memval.length > 0) {
            const lastValue = memval[memval.length - 1]
            const heap = currentStep.memorySnapshot.heap
            return {
                evaluatedValue: formatJSValue(lastValue, heap),
                rawValue: lastValue
            }
        }

        return { evaluatedValue: null, rawValue: null }
    }, [isEvaluated, currentStep])

    return {
        isExecuting,
        isExecuted,
        isEvaluating,
        isEvaluated,
        isErrorThrown,
        evaluatedValue,
        rawValue
    }
}
