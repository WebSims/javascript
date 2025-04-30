import { useEffect, useState, RefObject } from 'react'
import { useSimulatorStore } from './useSimulatorStore'
import { ESNode } from 'hermes-parser'

export const useExecStep = (node?: ESNode, ref?: RefObject<HTMLElement | null>) => {
    const { currentExecStep } = useSimulatorStore()
    const [isExecuting, setIsExecuting] = useState(false)
    const [isExecuted, setIsExecuted] = useState(false)
    const [isEvaluating, setIsEvaluating] = useState(false)
    const [isEvaluated, setIsEvaluated] = useState(false)

    const checkExecuting = (node: ESNode): boolean => {
        if (!currentExecStep || !node) return false
        if (currentExecStep.node && node.range) {
            return (
                currentExecStep.node.range[0] === node.range[0] &&
                currentExecStep.node.range[1] === node.range[1] &&
                currentExecStep.node.type === node.type &&
                currentExecStep.executing
            )
        }
        return false
    }

    const checkExecuted = (node: ESNode): boolean => {
        if (!currentExecStep || !node) return false
        if (currentExecStep.node && node.range) {
            return (
                currentExecStep.node.range[0] === node.range[0] &&
                currentExecStep.node.range[1] === node.range[1] &&
                currentExecStep.node.type === node.type &&
                currentExecStep.executed
            )
        }
        return false
    }

    const checkEvaluating = (node: ESNode): boolean => {
        if (!currentExecStep || !node) return false
        if (currentExecStep.node && node.range) {
            return (
                currentExecStep.node.range[0] === node.range[0] &&
                currentExecStep.node.range[1] === node.range[1] &&
                currentExecStep.node.type === node.type &&
                currentExecStep.evaluating
            )
        }
        return false
    }

    const checkEvaluated = (node: ESNode): boolean => {
        if (!currentExecStep || !node) return false
        if (currentExecStep.node && node.range) {
            return (
                currentExecStep.node.range[0] === node.range[0] &&
                currentExecStep.node.range[1] === node.range[1] &&
                currentExecStep.node.type === node.type &&
                currentExecStep.evaluated
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
    }
} 