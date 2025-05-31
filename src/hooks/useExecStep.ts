import { useEffect, useState, RefObject } from 'react'
import { useSimulatorStore } from './useSimulatorStore'
import { ESNode } from 'hermes-parser'
import { BUBBLE_UP_TYPE, EXEC_STEP_TYPE } from '@/types/simulation'

export const useExecStep = (node?: ESNode, ref?: RefObject<HTMLElement | null>) => {
    const { currentExecStep } = useSimulatorStore()
    const [isExecuting, setIsExecuting] = useState(false)
    const [isExecuted, setIsExecuted] = useState(false)
    const [isEvaluating, setIsEvaluating] = useState(false)
    const [isEvaluated, setIsEvaluated] = useState(false)
    const [isErrorThrown, setIsErrorThrown] = useState(false)

    const stepRange = currentExecStep?.node?.range
    const nodeRange = node?.range

    const checkExecuting = (node: ESNode): boolean => {
        if (stepRange && nodeRange) {
            return (
                stepRange[0] === nodeRange[0] &&
                stepRange[1] === nodeRange[1] &&
                currentExecStep.node.type === node.type &&
                currentExecStep.type === EXEC_STEP_TYPE.EXECUTING
            )
        }
        return false
    }

    const checkExecuted = (node: ESNode): boolean => {
        if (stepRange && nodeRange) {
            return (
                stepRange[0] === nodeRange[0] &&
                stepRange[1] === nodeRange[1] &&
                currentExecStep.node.type === node.type &&
                currentExecStep.type === EXEC_STEP_TYPE.EXECUTED
            )
        }
        return false
    }

    const checkEvaluating = (node: ESNode): boolean => {
        if (stepRange && nodeRange) {
            return (
                stepRange[0] === nodeRange[0] &&
                stepRange[1] === nodeRange[1] &&
                currentExecStep.node.type === node.type &&
                (currentExecStep.type === EXEC_STEP_TYPE.EVALUATING || currentExecStep.type === EXEC_STEP_TYPE.FUNCTION_CALL)
            )
        }
        return false
    }

    const checkEvaluated = (node: ESNode): boolean => {
        if (stepRange && nodeRange) {
            return (
                stepRange[0] === nodeRange[0] &&
                stepRange[1] === nodeRange[1] &&
                currentExecStep.node.type === node.type &&
                currentExecStep.type === EXEC_STEP_TYPE.EVALUATED
            )
        }
        return false
    }

    const checkErrorThrown = (node: ESNode): boolean => {
        if (stepRange && nodeRange) {
            return (
                stepRange[0] === nodeRange[0] &&
                stepRange[1] === nodeRange[1] &&
                currentExecStep.node.type === node.type &&
                currentExecStep.bubbleUp === BUBBLE_UP_TYPE.THROW
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
    }, [currentExecStep, node])

    useEffect(() => {
        if ((isExecuting || isExecuted || isEvaluating || isEvaluated) && ref?.current) {
            ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
    }, [isExecuting, isExecuted, isEvaluating, isEvaluated, ref])

    return {
        currentExecStep,
        isExecuting,
        isExecuted,
        isEvaluating,
        isEvaluated,
        isErrorThrown,
    }
} 