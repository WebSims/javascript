import React, { useMemo, useState, useCallback } from 'react'
import { EXEC_STEP_TYPE, ExecStep } from '@/types/simulator'
import { cn } from '@/lib/utils'
import { useSimulatorStore } from '@/hooks/useSimulatorStore'

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
    const [hoveredStepIndex, setHoveredStepIndex] = useState<number | null>(null)
    const [isTooltipOpen, setIsTooltipOpen] = useState(false)
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

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

    // Unified function to get clientX from either mouse or touch events
    const getClientX = useCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        if ('touches' in e) {
            return e.touches[0]?.clientX || e.changedTouches[0]?.clientX || 0
        }
        return e.clientX
    }, [])

    const getStepFromPosition = useCallback((clientX: number) => {
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

        const stepIndex = getStepFromPosition(getClientX(e))
        if (stepIndex !== null) {
            changeStep(stepIndex)
        }
    }, [getStepFromPosition, getClientX, changeStep])

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        e.preventDefault()
        setIsDragging(true)

        const stepIndex = getStepFromPosition(getClientX(e))
        if (stepIndex !== null) {
            changeStep(stepIndex)
        }
    }, [getStepFromPosition, getClientX, changeStep])

    const handleContainerMouseMove = useCallback((e: React.MouseEvent) => {
        if (isDragging) return

        const stepIndex = getStepFromPosition(getClientX(e))
        if (stepIndex !== null) {
            setHoveredStepIndex(stepIndex)
        }

        // Update mouse position relative to the container
        if (containerElement) {
            const rect = containerElement.getBoundingClientRect()
            setMousePosition({
                x: getClientX(e) - rect.left,
                y: e.clientY - rect.top
            })
        }
    }, [isDragging, getStepFromPosition, getClientX, containerElement])

    const handleContainerMouseEnter = useCallback(() => {
        setIsTooltipOpen(true)
    }, [])

    const handleContainerMouseLeave = useCallback(() => {
        setIsTooltipOpen(false)
        setHoveredStepIndex(null)
    }, [])

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return

        const stepIndex = getStepFromPosition(getClientX(e))
        if (stepIndex !== null) {
            changeStep(stepIndex)
        }
    }, [isDragging, getStepFromPosition, getClientX, changeStep])

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (!isDragging) return

        e.preventDefault() // Prevent scrolling while dragging
        const stepIndex = getStepFromPosition(getClientX(e))
        if (stepIndex !== null) {
            changeStep(stepIndex)
        }
    }, [isDragging, getStepFromPosition, getClientX, changeStep])

    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
    }, [])

    const handleTouchEnd = useCallback(() => {
        setIsDragging(false)
    }, [])

    // Add global mouse and touch event listeners when dragging
    React.useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
            document.addEventListener('touchmove', handleTouchMove, { passive: false })
            document.addEventListener('touchend', handleTouchEnd)

            return () => {
                document.removeEventListener('mousemove', handleMouseMove)
                document.removeEventListener('mouseup', handleMouseUp)
                document.removeEventListener('touchmove', handleTouchMove)
                document.removeEventListener('touchend', handleTouchEnd)
            }
        }
    }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd])

    if (!currentStep) return null

    return (
        <div className="relative flex h-8 w-full items-center">
            <div
                ref={setRefs}
                className="absolute flex h-4 w-full items-center overflow-hidden rounded-full"
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                onMouseMove={handleContainerMouseMove}
                onMouseEnter={handleContainerMouseEnter}
                onMouseLeave={handleContainerMouseLeave}
                style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
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
                        <div
                            key={index}
                            className={cn(
                                'flex h-full w-full cursor-pointer select-none items-center justify-center font-mono text-xs',
                            )}
                            style={{ backgroundColor }}
                            onClick={() => !isDragging && changeStep(index)}
                        />
                    )
                })}
            </div>

            {/* Custom tooltip that follows mouse */}
            {isTooltipOpen && hoveredStepIndex !== null && stepsWithDepth[hoveredStepIndex] && (
                <div
                    className="fixed rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white shadow-lg pointer-events-none border border-gray-700"
                    style={{
                        left: mousePosition.x + (containerElement?.getBoundingClientRect().left || 0),
                        top: (containerElement?.getBoundingClientRect().top || 0) - 50,
                        transform: 'translateX(-50%)',
                    }}
                >
                    {STEP_CONFIG[stepsWithDepth[hoveredStepIndex].type].tooltip}
                </div>
            )}

            <Slider
                value={[currentStep.index]}
                onValueChange={([v]) => changeStep(v)}
                max={steps.length > 0 ? steps.length - 1 : 0}
                step={1}
                className={cn(
                    'pointer-events-none w-full',
                    '[&_[data-orientation=horizontal]]:h-4',
                    // Enable pointer events and add hover styles for the thumb
                    '[&_[role=slider]]:pointer-events-auto',
                    '[&_[role=slider]]:cursor-pointer',
                    '[&_[role=slider]]:hover:scale-125',
                    '[&_[role=slider]]:hover:shadow-lg',
                    '[&_[role=slider]]:transition-all',
                    '[&_[role=slider]]:duration-150',
                    '[&_[role=slider]]:ease-in-out',
                    // Glass-like effect for filled portion
                    '[&_[data-orientation=horizontal]_span[data-orientation=horizontal]]:bg-white/20',
                    '[&_[data-orientation=horizontal]_span[data-orientation=horizontal]]:backdrop-blur',
                    '[&_[data-orientation=horizontal]_span[data-orientation=horizontal]]:border',
                    '[&_[data-orientation=horizontal]_span[data-orientation=horizontal]]:border-white/30',
                    '[&_[data-orientation=horizontal]_span[data-orientation=horizontal]]:shadow-sm',
                    // Make track transparent so steps show through
                )}
            />
        </div>
    )
}

export default StepSlider