import { useEffect, useState } from 'react'
import { useSimulatorStore } from './useSimulatorStore'
import { ESNode } from 'hermes-parser'

export const useExecStep = (node?: ESNode) => {
    const { currentExecStep } = useSimulatorStore()
    const [isExecuting, setIsExecuting] = useState(false)

    const checkExecuting = (node: ESNode): boolean => {
        if (!currentExecStep || !node) return false

        if (currentExecStep.node && node.range) {
            return (
                currentExecStep.node.range[0] === node.range[0] &&
                currentExecStep.node.range[1] === node.range[1] &&
                currentExecStep.node.type === node.type
            )
        }

        // if (currentExecStep.nodes && currentExecStep.nodes.length > 0) {
        //     return currentExecStep.nodes.some(
        //         (stepNode: ESNode) => stepNode.range &&
        //             node.range &&
        //             stepNode.range[0] === node.range[0] &&
        //             stepNode.range[1] === node.range[1]
        //     )
        // }

        return false
    }

    useEffect(() => {
        if (node) {
            setIsExecuting(checkExecuting(node))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentExecStep])

    return {
        currentExecStep,
        isExecuting,
    }
} 