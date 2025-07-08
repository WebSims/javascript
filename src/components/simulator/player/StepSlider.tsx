import React, { useMemo, useState, useCallback } from 'react'
import { EXEC_STEP_TYPE, ExecStep } from '@/types/simulator'
import { cn } from '@/lib/utils'
import { useSimulatorStore } from '@/hooks/useSimulatorStore'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { Slider } from '@/components/ui/slider'
import useElementSize from '@/hooks/useElementSize'

const STEP_CONFIG: Record<ExecStep['type'], {
    tooltip: string
}> = {
    [EXEC_STEP_TYPE.INITIAL]: {
        tooltip: 'Initial',
    },
    [EXEC_STEP_TYPE.PUSH_SCOPE]: {
        tooltip: 'Push Scope',
    },
    [EXEC_STEP_TYPE.HOISTING]: {
        tooltip: 'Hoisting',
    },
    [EXEC_STEP_TYPE.POP_SCOPE]: {
        tooltip: 'Pop Scope',
    },
    [EXEC_STEP_TYPE.EXECUTING]: {
        tooltip: 'Executing',
    },
    [EXEC_STEP_TYPE.EXECUTED]: {
        tooltip: 'Executed',
    },
    [EXEC_STEP_TYPE.EVALUATING]: {
        tooltip: 'Evaluating',
    },
    [EXEC_STEP_TYPE.EVALUATED]: {
        tooltip: 'Evaluated',
    },
    [EXEC_STEP_TYPE.FUNCTION_CALL]: {
        tooltip: 'Function Call',
    },
}

const StepSlider: React.FC = () => {
    const {
        steps,
        currentStep,
        changeStep,
    } = useSimulatorStore()

    const [stepsContainerRef, containerSize] = useElementSize<HTMLDivElement>()
    const [isDragging, setIsDragging] = useState(false)
    const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null)

    const setRefs = useCallback((el: HTMLDivElement | null) => {
        stepsContainerRef(el)
        setContainerElement(el)
    }, [stepsContainerRef])

    const stepsWithDepth = useMemo(() => {
        const newSteps: (ExecStep & { depth: number; inFunctionScope: boolean })[] = []
        let depth = 0
        let functionScopeDepth = -1 // Track the depth at which function scope starts

        for (const step of steps) {
            let inFunctionScope = functionScopeDepth >= 0 && depth >= functionScopeDepth

            if (step.type === EXEC_STEP_TYPE.PUSH_SCOPE) {
                depth++
                // Check if this is a function scope
                if (step.memoryChange.type === "push_scope" &&
                    step.memoryChange.kind === "function") {
                    functionScopeDepth = depth
                    inFunctionScope = true
                }
                newSteps.push({ ...step, depth, inFunctionScope })
            } else if (step.type === EXEC_STEP_TYPE.POP_SCOPE) {
                // Check if we're popping the function scope
                if (functionScopeDepth >= 0 && depth === functionScopeDepth) {
                    functionScopeDepth = -1 // Reset function scope tracking
                }
                newSteps.push({ ...step, depth, inFunctionScope })
                depth--
            } else {
                newSteps.push({ ...step, depth, inFunctionScope })
            }
        }
        return newSteps
    }, [steps])

    const getStepFromMousePosition = useCallback((clientX: number) => {
        if (!containerElement || !containerSize.width) return null

        const rect = containerElement.getBoundingClientRect()
        const x = clientX - rect.left
        const stepWidth = containerSize.width / stepsWithDepth.length
        const stepIndex = Math.floor(x / stepWidth)

        return Math.max(0, Math.min(stepIndex, stepsWithDepth.length - 1))
    }, [containerElement, containerSize.width, stepsWithDepth.length])

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        setIsDragging(true)

        const stepIndex = getStepFromMousePosition(e.clientX)
        if (stepIndex !== null) {
            changeStep(stepIndex)
        }
    }, [getStepFromMousePosition, changeStep])

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return

        const stepIndex = getStepFromMousePosition(e.clientX)
        if (stepIndex !== null) {
            changeStep(stepIndex)
        }
    }, [isDragging, getStepFromMousePosition, changeStep])

    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
    }, [])

    // Add global mouse event listeners when dragging
    React.useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)

            return () => {
                document.removeEventListener('mousemove', handleMouseMove)
                document.removeEventListener('mouseup', handleMouseUp)
            }
        }
    }, [isDragging, handleMouseMove, handleMouseUp])

    if (!currentStep) return null

    return (
        <div className="relative flex h-8 w-full items-center">
            <TooltipProvider delayDuration={0} >
                <div
                    ref={setRefs}
                    className="absolute flex h-4 w-full items-center overflow-hidden rounded-full"
                    onMouseDown={handleMouseDown}
                    style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                >
                    {stepsWithDepth.map((step, index) => {
                        const lightness = Math.min(90, 20 + step.depth * 10)

                        let backgroundColor: string
                        // Use blue color range when inside a function scope
                        if (step.inFunctionScope) {
                            backgroundColor = `hsl(220, 70%, ${lightness}%)`
                        } else {
                            // Use default grayscale
                            backgroundColor = `hsl(0, 0%, ${lightness}%)`
                        }

                        return (
                            <Tooltip key={index}>
                                <TooltipTrigger asChild>
                                    <div
                                        className={cn(
                                            'flex h-full w-full cursor-pointer select-none items-center justify-center font-mono text-xs',
                                        )}
                                        style={{ backgroundColor }}
                                        onClick={() => !isDragging && changeStep(index)}
                                    />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{STEP_CONFIG[step.type].tooltip}</p>
                                </TooltipContent>
                            </Tooltip>
                        )
                    })}
                </div>
            </TooltipProvider>

            <Slider
                value={[currentStep.index]}
                onValueChange={([v]) => changeStep(v)}
                max={steps.length > 0 ? steps.length - 1 : 0}
                step={1}
                className={cn(
                    'pointer-events-none w-full [&_[role=slider]]:pointer-events-auto',
                    '[&_[data-orientation=horizontal]]:h-4',
                    // Glass-like effect for filled portion
                    '[&_[data-orientation=horizontal]_span[data-orientation=horizontal]]:bg-white/20',
                    '[&_[data-orientation=horizontal]_span[data-orientation=horizontal]]:backdrop-blur',
                    '[&_[data-orientation=horizontal]_span[data-orientation=horizontal]]:border',
                    '[&_[data-orientation=horizontal]_span[data-orientation=horizontal]]:border-white/30',
                    '[&_[data-orientation=horizontal]_span[data-orientation=horizontal]]:shadow-sm'
                )}
            />
        </div>
    )
}

export default StepSlider