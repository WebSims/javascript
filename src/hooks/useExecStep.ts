import { useEffect, useState, useMemo, RefObject } from 'react'
import { useSimulatorStore } from './useSimulatorStore'
import { useExpansionContext } from '@/contexts/ExpansionContext'
import { ESNode } from 'hermes-parser'
import { BUBBLE_UP_TYPE, EXEC_STEP_TYPE, FunctionObject } from '@/types/simulator'
import * as ESTree from 'estree'

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

        // Traverse steps from start to current to build the stack of active function calls
        for (let i = 0; i <= currentIndex; i++) {
            const step = steps[i]

            if (
                step.type === EXEC_STEP_TYPE.PUSH_SCOPE &&
                step.memoryChange?.type === "push_scope" &&
                step.memoryChange.kind === "function"
            ) {
                // Find the function that was called
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
                                        // Get the function body range (not the whole function, just the body)
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
    
    // Check if node is inside any active function body
    for (const bodyRange of bodyRanges) {
        if (nodeRange[0] >= bodyRange[0] && nodeRange[1] <= bodyRange[1]) {
            return true
        }
    }
    return false
}

export const useExecStep = (node?: ESNode, ref?: RefObject<HTMLElement | null>, options?: { suppressInFunctionBody?: boolean }) => {
    const { currentStep } = useSimulatorStore()
    const { isInsideExpansion } = useExpansionContext()
    const [isExecuting, setIsExecuting] = useState(false)
    const [isExecuted, setIsExecuted] = useState(false)
    const [isEvaluating, setIsEvaluating] = useState(false)
    const [isEvaluated, setIsEvaluated] = useState(false)
    const [isErrorThrown, setIsErrorThrown] = useState(false)

    // Get active function body ranges to suppress highlighting
    const bodyRanges = useActiveFunctionBodyRanges()
    
    // By default, suppress highlighting in function bodies (can be overridden with options)
    // But NEVER suppress if we're inside an expansion (popover)
    const shouldSuppress = !isInsideExpansion && options?.suppressInFunctionBody !== false

    const stepRange = currentStep?.node?.range
    const nodeRange = node?.range

    // Check if this node is inside an active function body
    const isSuppressed = shouldSuppress && isInsideSuppressedRange(nodeRange as [number, number] | undefined, bodyRanges)

    const checkExecuting = (node: ESNode): boolean => {
        if (isSuppressed) return false
        if (stepRange && nodeRange) {
            return (
                stepRange[0] === nodeRange[0] &&
                stepRange[1] === nodeRange[1] &&
                currentStep.node.type === node.type &&
                (currentStep.type === EXEC_STEP_TYPE.EXECUTING || currentStep.type === EXEC_STEP_TYPE.PUSH_SCOPE || currentStep.type === EXEC_STEP_TYPE.HOISTING)
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
                currentStep.type === EXEC_STEP_TYPE.EXECUTED
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
                (currentStep.type === EXEC_STEP_TYPE.EVALUATING || currentStep.type === EXEC_STEP_TYPE.FUNCTION_CALL)
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
            ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
    }, [isExecuting, isExecuted, isEvaluating, isEvaluated, ref, isSuppressed])

    return {
        currentStep,
        isExecuting,
        isExecuted,
        isEvaluating,
        isEvaluated,
        isErrorThrown,
    }
}
