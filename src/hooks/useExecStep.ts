import { useEffect, useState, RefObject } from 'react'
import { useSimulatorStore } from './useSimulatorStore'
import { ESNode } from 'hermes-parser'
import { BUBBLE_UP_TYPE, EXEC_STEP_TYPE } from '@/types/simulator'
import { useExecutionUiEnabled } from '@/contexts/ExecutionUiContext'
import { useScopedStep } from '@/contexts/ScopedStepContext'

export const useExecStep = (node?: ESNode, ref?: RefObject<HTMLElement | null>) => {
    const { currentStep: globalCurrentStep } = useSimulatorStore()
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
                (currentStep.type === EXEC_STEP_TYPE.EXECUTING || currentStep.type === EXEC_STEP_TYPE.PUSH_SCOPE || currentStep.type === EXEC_STEP_TYPE.HOISTING)
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
                (currentStep.type === EXEC_STEP_TYPE.EXECUTED || currentStep.type === EXEC_STEP_TYPE.POP_SCOPE)
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
                (currentStep.type === EXEC_STEP_TYPE.EVALUATING || currentStep.type === EXEC_STEP_TYPE.FUNCTION_CALL)
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
            ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
    }, [isExecuting, isExecuted, isEvaluating, isEvaluated, ref, isExecutionUiEnabled])

    return {
        currentStep,
        isExecuting,
        isExecuted,
        isEvaluating,
        isEvaluated,
        isErrorThrown,
    }
} 