import { useEffect, useState, useMemo, RefObject } from "react"
import { useSimulatorStore } from "./useSimulatorStore"
import { useExpansionContext } from "@/contexts/ExpansionContext"
import { ESNode } from "hermes-parser"
import { EXEC_STEP_TYPE, BUBBLE_UP_TYPE, JSValue, ExecStep, FunctionObject } from "@/types/simulator"
import { formatJSValue, FormattedValue } from "@/utils/formatJSValue"
import * as ESTree from "estree"

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

/**
 * Get active function body ranges that should have suppressed highlighting in main code
 */
const useActiveFunctionBodyRanges = () => {
    const { currentStep, steps } = useSimulatorStore()

    return useMemo(() => {
        if (!currentStep || !steps.length) {
            return []
        }

        const currentIndex = currentStep.index
        const bodyRanges: [number, number][] = []

        for (let i = 0; i <= currentIndex; i++) {
            const step = steps[i]

            if (
                step.type === EXEC_STEP_TYPE.PUSH_SCOPE &&
                step.memoryChange?.type === "push_scope" &&
                step.memoryChange.kind === "function"
            ) {
                for (let j = i - 1; j >= 0; j--) {
                    const prevStep = steps[j]
                    if (
                        prevStep.type === EXEC_STEP_TYPE.FUNCTION_CALL &&
                        prevStep.node.type === "CallExpression"
                    ) {
                        const callExpr = prevStep.node as ESTree.CallExpression
                        if (callExpr.callee.type === "Identifier") {
                            const funcName = callExpr.callee.name
                            const scopes = prevStep.memorySnapshot.scopes
                            const heap = prevStep.memorySnapshot.heap
                            
                            for (let s = scopes.length - 1; s >= 0; s--) {
                                const variable = scopes[s].variables[funcName]
                                if (variable && variable.value.type === "reference") {
                                    const heapObj = heap[variable.value.ref]
                                    if (heapObj && heapObj.type === "function") {
                                        const functionNode = (heapObj as FunctionObject).node
                                        const bodyWithRange = functionNode.body as ESTree.BlockStatement & { range?: [number, number] }
                                        if (functionNode && functionNode.body && bodyWithRange.range) {
                                            bodyRanges.push(bodyWithRange.range)
                                        }
                                        break
                                    }
                                }
                            }
                        }
                        break
                    }
                }
            }

            if (
                step.type === EXEC_STEP_TYPE.POP_SCOPE &&
                step.memoryChange?.type === "pop_scope" &&
                step.memoryChange.kind === "function"
            ) {
                bodyRanges.pop()
            }
        }

        return bodyRanges
    }, [currentStep, steps])
}

/**
 * Check if a node range is inside any of the suppressed body ranges
 */
const isInsideSuppressedRange = (nodeRange: [number, number] | undefined, bodyRanges: [number, number][]) => {
    if (!nodeRange || bodyRanges.length === 0) return false
    
    for (const bodyRange of bodyRanges) {
        if (nodeRange[0] >= bodyRange[0] && nodeRange[1] <= bodyRange[1]) {
            return true
        }
    }
    return false
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
    const { currentStep, steps } = useSimulatorStore()
    const { isInsideExpansion } = useExpansionContext()
    const [isExecuting, setIsExecuting] = useState(false)
    const [isExecuted, setIsExecuted] = useState(false)
    const [isEvaluating, setIsEvaluating] = useState(false)
    const [isEvaluated, setIsEvaluated] = useState(false)
    const [isErrorThrown, setIsErrorThrown] = useState(false)

    // Get active function body ranges to suppress highlighting
    const bodyRanges = useActiveFunctionBodyRanges()

    const stepRange = currentStep?.node?.range
    const nodeRange = node?.range

    // Check if this node is inside an active function body
    // But NEVER suppress if we're inside an expansion (popover)
    const isSuppressed = !isInsideExpansion && isInsideSuppressedRange(nodeRange as [number, number] | undefined, bodyRanges)

    const checkExecuting = (node: ESNode): boolean => {
        if (isSuppressed) return false
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
        if (isSuppressed) return false
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
        if (isSuppressed) return false
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
        if (isSuppressed) return false
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
        if (isSuppressed) return false
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
    }, [currentStep, node, isSuppressed])

    useEffect(() => {
        // Only scroll if not suppressed
        if (!isSuppressed && (isExecuting || isExecuted || isEvaluating || isEvaluated) && ref?.current) {
            ref.current.scrollIntoView({ behavior: "smooth", block: "center" })
        }
    }, [isExecuting, isExecuted, isEvaluating, isEvaluated, ref, isSuppressed])

    // Find the evaluated value from current or previous steps
    const { evaluatedValue, rawValue, wasEvaluated } = useMemo(() => {
        if (!node || !currentStep || !steps.length) {
            return { evaluatedValue: null, rawValue: null, wasEvaluated: false }
        }

        const currentIndex = currentStep.index

        // Search backwards from current step to find when this node was evaluated
        for (let i = currentIndex; i >= 0; i--) {
            const step = steps[i]
            
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
    }, [node, currentStep, steps])

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
