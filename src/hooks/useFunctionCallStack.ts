import { useMemo } from 'react'
import { useSimulatorStore } from './useSimulatorStore'
import { EXEC_STEP_TYPE, ExecStep, HeapObjectType, JSValue, HeapObject } from '@/types/simulator'
import * as ESTree from 'estree'
import { ESNode } from 'hermes-parser'

export interface CallFrame {
    callNodeKey: string // Unique key for the CallExpression node (e.g. range-based)
    fnNode: ESTree.Function & ESNode // The function definition node
    fnRef: JSValue // Reference to the function object in heap
    stepIndex: number // The index of the FUNCTION_CALL step
    heapAtCall: Record<number, HeapObject>
    memvalAtCall: JSValue[]
    args: JSValue[]
}

const getRangeKey = (node: ESTree.BaseNode): string => {
    if (node.range) {
        return `${node.range[0]}-${node.range[1]}`
    }
    return ''
}

export const useFunctionCallStack = () => {
    const { currentStep, steps } = useSimulatorStore()

    const frames = useMemo(() => {
        if (!currentStep || !steps.length) return []

        const resultFrames: CallFrame[] = []
        let openFunctionPopsToMatch = 0
        const currentIndex = currentStep.index

        // Traverse backwards from current step
        for (let i = currentIndex; i >= 0; i--) {
            const step = steps[i]

            // If we encounter a pop_scope for a function, we know we've exited a function call
            // We need to skip the corresponding function_call start
            if (step.type === EXEC_STEP_TYPE.POP_SCOPE &&
                step.memoryChange.type === 'pop_scope' &&
                step.memoryChange.kind === 'function') {
                openFunctionPopsToMatch++
                continue
            }

            // Found a function call start
            if (step.type === EXEC_STEP_TYPE.FUNCTION_CALL) {
                // If this matches a later pop_scope, we consume it and don't include this frame
                // because it's already returned
                if (openFunctionPopsToMatch > 0) {
                    openFunctionPopsToMatch--
                    continue
                }

                // This function call is currently active!
                const snapshot = step.memorySnapshot
                const memval = snapshot.memval
                
                // Based on execHandlers["CallExpression"]:
                // Stack state at FUNCTION_CALL: 
                // [..., arg1, arg2, argCount, fnRef] (top)
                
                // Let's verify what's on the stack. 
                // The handler does:
                // args.forEach(arg => this.pushMemval(arg))
                // this.pushMemval({ type: 'primitive', value: args.length })
                // this.pushMemval(fnRef)
                // this.addStep(astNode, EXEC_STEP_TYPE.FUNCTION_CALL)
                
                if (memval.length >= 2) {
                    const fnRef = memval[memval.length - 1]
                    const argsCountVal = memval[memval.length - 2]
                    
                    if (fnRef.type === 'reference' && 
                        argsCountVal.type === 'primitive' && 
                        typeof argsCountVal.value === 'number') {
                        
                        const heapObject = snapshot.heap[fnRef.ref]
                        
                        if (heapObject && heapObject.type === 'function' && heapObject.node) {
                            const argsCount = argsCountVal.value
                            // Args are below count and fnRef
                            // stack: [..., arg1, arg2, count, fnRef]
                            // slice args out
                            const argsStartIndex = memval.length - 2 - argsCount
                            const args = memval.slice(argsStartIndex, argsStartIndex + argsCount)

                            resultFrames.push({
                                callNodeKey: getRangeKey(step.node),
                                fnNode: heapObject.node as ESTree.Function & ESNode,
                                fnRef,
                                stepIndex: step.index,
                                heapAtCall: snapshot.heap,
                                memvalAtCall: memval,
                                args
                            })
                        }
                    }
                }
            }
        }
        
        // Reverse to get outer -> inner order
        return resultFrames.reverse()
    }, [currentStep, steps])

    return frames
}

