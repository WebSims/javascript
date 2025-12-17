import { useMemo } from "react"
import { useSimulatorStore } from "./useSimulatorStore"
import { ESNode } from "hermes-parser"
import * as ESTree from "estree"
import { EXEC_STEP_TYPE, Scope, Heap, FunctionObject, JSValue } from "@/types/simulator"

export type ActiveFunctionCall = {
    callExpressionRange: [number, number]
    functionDefinitionRange: [number, number] | null
    scopeIndex: number
    functionNode: ESTree.Function | null
    functionName: string
    pushStepIndex: number
    scope: Scope
    heap: Heap
    returnValue: JSValue | null  // The value being returned (from memval)
    isReturning: boolean  // True if return statement was just executed
    isScopeClosing: boolean  // True during POP_SCOPE step (scope is being removed)
}

type UseFunctionCallExpansionResult = {
    isExpanded: boolean
    activeFunctionCall: ActiveFunctionCall | null
    activeFunctionCalls: ActiveFunctionCall[]
    stackIndex: number
}

/**
 * Hook to manage function call inline expansion state
 * Tracks active function scopes and provides data for expansion display
 * Also tracks function definition ranges for highlighting connections
 * 
 * @param node - The CallExpression AST node
 * @returns Expansion state and active function call data
 */
export const useFunctionCallExpansion = (node?: ESNode): UseFunctionCallExpansionResult => {
    const { currentStep, steps } = useSimulatorStore()

    const result = useMemo(() => {
        if (!currentStep || !steps.length) {
            return {
                isExpanded: false,
                activeFunctionCall: null,
                activeFunctionCalls: [],
                stackIndex: -1
            }
        }

        const currentIndex = currentStep.index
        const activeFunctionCalls: ActiveFunctionCall[] = []

        // Check if current step is POP_SCOPE for a function (scope is closing)
        const isCurrentStepPopScope = 
            currentStep.type === EXEC_STEP_TYPE.POP_SCOPE &&
            currentStep.memoryChange?.type === "pop_scope" &&
            currentStep.memoryChange.kind === "function"

        // Traverse steps from start to current to build the stack of active function calls
        // If current step is POP_SCOPE, we traverse up to (but not including) the current step
        // so that the function call is still visible during the closing step
        const traverseEnd = isCurrentStepPopScope ? currentIndex - 1 : currentIndex

        for (let i = 0; i <= traverseEnd; i++) {
            const step = steps[i]

            // Check for function scope push
            if (
                step.type === EXEC_STEP_TYPE.PUSH_SCOPE &&
                step.memoryChange?.type === "push_scope" &&
                step.memoryChange.kind === "function"
            ) {
                // Find the CallExpression that triggered this scope
                // Look backwards to find the FUNCTION_CALL step
                let callExprRange: [number, number] | null = null
                let functionNode: ESTree.Function | null = null
                let functionDefinitionRange: [number, number] | null = null
                let functionName = "anonymous"

                for (let j = i - 1; j >= 0; j--) {
                    const prevStep = steps[j]
                    if (
                        prevStep.type === EXEC_STEP_TYPE.FUNCTION_CALL &&
                        prevStep.node.type === "CallExpression"
                    ) {
                        callExprRange = prevStep.node.range as [number, number]
                        
                        // Try to get the function node from the heap
                        const callExpr = prevStep.node as ESTree.CallExpression
                        if (callExpr.callee.type === "Identifier") {
                            functionName = callExpr.callee.name
                            const scopes = prevStep.memorySnapshot.scopes
                            const heap = prevStep.memorySnapshot.heap
                            
                            // Search scopes from innermost to outermost
                            for (let s = scopes.length - 1; s >= 0; s--) {
                                const variable = scopes[s].variables[functionName]
                                if (variable && variable.value.type === "reference") {
                                    const heapObj = heap[variable.value.ref]
                                    if (heapObj && heapObj.type === "function") {
                                        functionNode = (heapObj as FunctionObject).node
                                        // Get the function definition range
                                        if (functionNode && (functionNode as any).range) {
                                            functionDefinitionRange = (functionNode as any).range as [number, number]
                                        }
                                        break
                                    }
                                }
                            }
                        } else if (callExpr.callee.type === "MemberExpression") {
                            // Handle method calls like obj.method()
                            const memberExpr = callExpr.callee as ESTree.MemberExpression
                            if (memberExpr.property.type === "Identifier") {
                                functionName = memberExpr.property.name
                            }
                        }
                        break
                    }
                }

                if (callExprRange) {
                    activeFunctionCalls.push({
                        callExpressionRange: callExprRange,
                        functionDefinitionRange,
                        scopeIndex: step.scopeIndex,
                        functionNode,
                        functionName,
                        pushStepIndex: i,
                        scope: step.memoryChange.scope,
                        heap: step.memorySnapshot.heap,
                        returnValue: null,
                        isReturning: false,
                        isScopeClosing: false
                    })
                }
            }

            // Check for function scope pop (but not the current step if it's a POP_SCOPE)
            if (
                step.type === EXEC_STEP_TYPE.POP_SCOPE &&
                step.memoryChange?.type === "pop_scope" &&
                step.memoryChange.kind === "function"
            ) {
                // Remove the most recent function call from stack
                activeFunctionCalls.pop()
            }
        }

        // Check if this specific node has an active expansion
        let isExpanded = false
        let activeFunctionCall: ActiveFunctionCall | null = null
        let stackIndex = -1

        if (node && node.range) {
            const nodeRange = node.range as [number, number]
            
            // Find if this node matches any active function call
            for (let i = 0; i < activeFunctionCalls.length; i++) {
                const call = activeFunctionCalls[i]
                if (
                    call.callExpressionRange[0] === nodeRange[0] &&
                    call.callExpressionRange[1] === nodeRange[1]
                ) {
                    isExpanded = true
                    activeFunctionCall = call
                    stackIndex = i
                    
                    // Check if there's a return value on memval stack
                    const memval = currentStep.memorySnapshot.memval
                    const hasReturnValue = memval.length > 0
                    
                    // Check if a return statement was executed (current or previous step)
                    const isReturning = currentStep.node.type === "ReturnStatement" || 
                        (currentIndex > 0 && steps[currentIndex - 1]?.node.type === "ReturnStatement")
                    
                    // Check if this is the function whose scope is closing
                    const isScopeClosing = isCurrentStepPopScope && i === activeFunctionCalls.length - 1
                    
                    // Update scope and heap with current snapshot (if scope still exists)
                    const scopeExists = currentStep.memorySnapshot.scopes[call.scopeIndex]
                    
                    activeFunctionCall = {
                        ...call,
                        scope: scopeExists || call.scope,
                        heap: currentStep.memorySnapshot.heap,
                        returnValue: hasReturnValue ? memval[memval.length - 1] : null,
                        isReturning: (isReturning || isScopeClosing) && hasReturnValue,
                        isScopeClosing
                    }
                    break
                }
            }
        }

        return {
            isExpanded,
            activeFunctionCall,
            activeFunctionCalls,
            stackIndex
        }
    }, [currentStep, steps, node])

    return result
}

/**
 * Hook to get all active function calls (for use by FunctionDeclaration to check if it's being called)
 */
export const useActiveFunctionCalls = () => {
    const { currentStep, steps } = useSimulatorStore()

    const activeFunctionCalls = useMemo(() => {
        if (!currentStep || !steps.length) {
            return []
        }

        const currentIndex = currentStep.index
        const calls: ActiveFunctionCall[] = []

        // Traverse steps from start to current to build the stack of active function calls
        for (let i = 0; i <= currentIndex; i++) {
            const step = steps[i]

            if (
                step.type === EXEC_STEP_TYPE.PUSH_SCOPE &&
                step.memoryChange?.type === "push_scope" &&
                step.memoryChange.kind === "function"
            ) {
                let callExprRange: [number, number] | null = null
                let functionNode: ESTree.Function | null = null
                let functionDefinitionRange: [number, number] | null = null
                let functionName = "anonymous"

                for (let j = i - 1; j >= 0; j--) {
                    const prevStep = steps[j]
                    if (
                        prevStep.type === EXEC_STEP_TYPE.FUNCTION_CALL &&
                        prevStep.node.type === "CallExpression"
                    ) {
                        callExprRange = prevStep.node.range as [number, number]
                        const callExpr = prevStep.node as ESTree.CallExpression
                        
                        if (callExpr.callee.type === "Identifier") {
                            functionName = callExpr.callee.name
                            const scopes = prevStep.memorySnapshot.scopes
                            const heap = prevStep.memorySnapshot.heap
                            
                            for (let s = scopes.length - 1; s >= 0; s--) {
                                const variable = scopes[s].variables[functionName]
                                if (variable && variable.value.type === "reference") {
                                    const heapObj = heap[variable.value.ref]
                                    if (heapObj && heapObj.type === "function") {
                                        functionNode = (heapObj as FunctionObject).node
                                        if (functionNode && (functionNode as any).range) {
                                            functionDefinitionRange = (functionNode as any).range as [number, number]
                                        }
                                        break
                                    }
                                }
                            }
                        }
                        break
                    }
                }

                if (callExprRange) {
                    calls.push({
                        callExpressionRange: callExprRange,
                        functionDefinitionRange,
                        scopeIndex: step.scopeIndex,
                        functionNode,
                        functionName,
                        pushStepIndex: i,
                        scope: step.memoryChange.scope,
                        heap: currentStep.memorySnapshot.heap,
                        returnValue: null,
                        isReturning: false,
                        isScopeClosing: false
                    })
                }
            }

            if (
                step.type === EXEC_STEP_TYPE.POP_SCOPE &&
                step.memoryChange?.type === "pop_scope" &&
                step.memoryChange.kind === "function"
            ) {
                calls.pop()
            }
        }

        return calls
    }, [currentStep, steps])

    return activeFunctionCalls
}

