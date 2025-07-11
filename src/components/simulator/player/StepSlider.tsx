import React, { useMemo, useState, useCallback } from 'react'
import { EXEC_STEP_TYPE, ExecStep } from '@/types/simulator'
import { cn } from '@/lib/utils'
import { useSimulatorStore } from '@/hooks/useSimulatorStore'
import { useResponsive } from '@/hooks/useResponsive'

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

    const { isMobile } = useResponsive()
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

    // Unified function to get clientY from either mouse or touch events
    const getClientY = useCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        if ('touches' in e) {
            return e.touches[0]?.clientY || e.changedTouches[0]?.clientY || 0
        }
        return e.clientY
    }, [])

    const getStepFromPosition = useCallback((clientX: number) => {
        if (!containerElement || !containerSize.width) return null

        const rect = containerElement.getBoundingClientRect()
        const x = clientX - rect.left
        const stepWidth = containerSize.width / stepsWithDepth.length
        const stepIndex = Math.floor(x / stepWidth)

        return Math.max(0, Math.min(stepIndex, stepsWithDepth.length - 1))
    }, [containerElement, containerSize.width, stepsWithDepth.length])

    const updateMousePosition = useCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        if (containerElement) {
            const rect = containerElement.getBoundingClientRect()
            setMousePosition({
                x: getClientX(e) - rect.left,
                y: getClientY(e) - rect.top
            })
        }
    }, [getClientX, getClientY, containerElement])

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        setIsDragging(true)
        setIsTooltipOpen(true)

        const stepIndex = getStepFromPosition(getClientX(e))
        if (stepIndex !== null) {
            changeStep(stepIndex)
            setHoveredStepIndex(stepIndex)
        }
        updateMousePosition(e)
    }, [getStepFromPosition, getClientX, changeStep, updateMousePosition])

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        e.preventDefault()
        setIsDragging(true)
        setIsTooltipOpen(true)

        const stepIndex = getStepFromPosition(getClientX(e))
        if (stepIndex !== null) {
            changeStep(stepIndex)
            setHoveredStepIndex(stepIndex)
        }
        updateMousePosition(e)
    }, [getStepFromPosition, getClientX, changeStep, updateMousePosition])

    const handleContainerMouseMove = useCallback((e: React.MouseEvent) => {
        const stepIndex = getStepFromPosition(getClientX(e))
        if (stepIndex !== null) {
            setHoveredStepIndex(stepIndex)
        }
        updateMousePosition(e)
        // Always keep tooltip open when moving within the container
        setIsTooltipOpen(true)
    }, [getStepFromPosition, getClientX, updateMousePosition])

    const handleContainerMouseEnter = useCallback((e: React.MouseEvent) => {
        setIsTooltipOpen(true)
        updateMousePosition(e)
    }, [updateMousePosition])

    const handleContainerMouseLeave = useCallback(() => {
        // Only hide tooltip if not dragging
        if (!isDragging) {
            setIsTooltipOpen(false)
            setHoveredStepIndex(null)
        }
    }, [isDragging])

    // Handlers for slider thumb interactions
    const handleSliderMouseEnter = useCallback((e: React.MouseEvent) => {
        if (!currentStep) return
        setIsTooltipOpen(true)
        updateMousePosition(e)
        // Set hovered step to current step when hovering on thumb
        setHoveredStepIndex(currentStep.index)
    }, [updateMousePosition, currentStep])

    const handleSliderMouseLeave = useCallback(() => {
        // Don't hide tooltip immediately, let container handle it
        if (!isDragging) {
            setHoveredStepIndex(null)
        }
    }, [isDragging])

    const handleSliderMouseMove = useCallback((e: React.MouseEvent) => {
        if (!currentStep) return
        setIsTooltipOpen(true)
        updateMousePosition(e)
        // Keep current step highlighted when moving on thumb
        setHoveredStepIndex(currentStep.index)

        // If we're dragging, make sure mouse position updates
        if (isDragging) {
            updateMousePosition(e)
        }
    }, [updateMousePosition, currentStep, isDragging])

    const handleSliderMouseDown = useCallback((e: React.MouseEvent) => {
        if (!currentStep) return
        setIsTooltipOpen(true)
        updateMousePosition(e)
        setHoveredStepIndex(currentStep.index)
        setIsDragging(true) // Set dragging state when starting drag from slider handle
    }, [updateMousePosition, currentStep])

    const handleSliderPointerDown = useCallback((e: React.PointerEvent) => {
        if (!currentStep) return
        setIsTooltipOpen(true)
        updateMousePosition(e)
        setHoveredStepIndex(currentStep.index)
        setIsDragging(true) // Set dragging state when starting drag from slider handle
    }, [updateMousePosition, currentStep])

    const handleSliderValueChange = useCallback(([value]: number[]) => {
        changeStep(value)
        setHoveredStepIndex(value)

        // Ensure tooltip stays visible during slider value changes
        setIsTooltipOpen(true)
    }, [changeStep])

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return

        // Always update mouse position during dragging
        updateMousePosition(e)

        const stepIndex = getStepFromPosition(getClientX(e))
        if (stepIndex !== null) {
            changeStep(stepIndex)
            setHoveredStepIndex(stepIndex)
        }

        // Ensure tooltip stays visible during dragging
        setIsTooltipOpen(true)
    }, [isDragging, getStepFromPosition, getClientX, changeStep, updateMousePosition])

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (!isDragging) return

        e.preventDefault() // Prevent scrolling while dragging

        // Always update mouse position during dragging
        updateMousePosition(e)

        const stepIndex = getStepFromPosition(getClientX(e))
        if (stepIndex !== null) {
            changeStep(stepIndex)
            setHoveredStepIndex(stepIndex)
        }

        // Ensure tooltip stays visible during dragging
        setIsTooltipOpen(true)
    }, [isDragging, getStepFromPosition, getClientX, changeStep, updateMousePosition])

    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
        // Keep tooltip open after dragging ends if mouse is still over the container
        // The mouse leave handler will hide it when appropriate
    }, [])

    const handleTouchEnd = useCallback(() => {
        setIsDragging(false)
        // Hide tooltip after touch ends
        setIsTooltipOpen(false)
        setHoveredStepIndex(null)
    }, [])

    // Add global mouse and touch event listeners when dragging
    React.useEffect(() => {
        if (isDragging) {
            const handlePointerMove = (e: PointerEvent) => {
                if (containerElement) {
                    const rect = containerElement.getBoundingClientRect()
                    setMousePosition({
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top
                    })
                }
                setIsTooltipOpen(true)

                // Also update step based on position
                const stepIndex = getStepFromPosition(e.clientX)
                if (stepIndex !== null) {
                    setHoveredStepIndex(stepIndex)
                }
            }

            const handlePointerUp = () => {
                setIsDragging(false)
                setHoveredStepIndex(null)
            }

            // Use pointer events with capture for better reliability
            document.addEventListener('pointermove', handlePointerMove, { capture: true })
            document.addEventListener('pointerup', handlePointerUp, { capture: true })
            document.addEventListener('mousemove', handleMouseMove, { capture: true })
            document.addEventListener('mouseup', handleMouseUp, { capture: true })
            document.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true })
            document.addEventListener('touchend', handleTouchEnd, { capture: true })

            return () => {
                document.removeEventListener('pointermove', handlePointerMove, { capture: true })
                document.removeEventListener('pointerup', handlePointerUp, { capture: true })
                document.removeEventListener('mousemove', handleMouseMove, { capture: true })
                document.removeEventListener('mouseup', handleMouseUp, { capture: true })
                document.removeEventListener('touchmove', handleTouchMove, { capture: true })
                document.removeEventListener('touchend', handleTouchEnd, { capture: true })
            }
        }
    }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd, containerElement, getStepFromPosition])



    if (!currentStep) return null

    return (
        <div className="relative flex h-10 lg:h-14 w-full items-center">
            {/* Extended hover area */}
            <div
                className="absolute inset-0 w-full h-full"
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                onMouseMove={handleContainerMouseMove}
                onMouseEnter={handleContainerMouseEnter}
                onMouseLeave={handleContainerMouseLeave}
                style={{ cursor: isDragging ? 'grabbing' : 'pointer', touchAction: 'none' }}
            />

            <div
                ref={setRefs}
                className="absolute flex h-4 w-full items-center overflow-hidden rounded-full"
                style={{ pointerEvents: 'none' }}
            >
                {stepsWithDepth.map((step) => {
                    const lightness = Math.min(90, 20 + step.depth * 10)

                    let backgroundColor: string
                    // Use blue color range when inside a function scope
                    if (step.inFunctionScope) {
                        backgroundColor = `hsl(50, 50%, ${lightness}%)`
                    } else {
                        // Use default grayscale
                        backgroundColor = `hsl(0, 0%, ${lightness}%)`
                    }

                    return (
                        <div
                            key={step.index}
                            data-depth={step.depth}
                            className={cn(
                                'flex h-full w-full select-none items-center justify-center font-mono text-xs',
                            )}
                            style={{ backgroundColor }}
                        />
                    )
                })}
            </div>

            {/* Mobile: Fixed tooltip always visible */}
            {isMobile && currentStep && (
                <div className="absolute -top-6 left-1/4 pl-3 text-sm">
                    {STEP_CONFIG[currentStep.type].tooltip}
                </div>
            )}

            {/* Desktop: Tooltip that follows mouse on hover */}
            {!isMobile && isTooltipOpen && (() => {
                const containerRect = containerElement?.getBoundingClientRect()
                if (!containerRect) return null

                const baseX = mousePosition.x + containerRect.left
                const stepIndex = hoveredStepIndex !== null ? hoveredStepIndex : currentStep.index
                const stepType = (hoveredStepIndex !== null && stepsWithDepth[hoveredStepIndex])
                    ? STEP_CONFIG[stepsWithDepth[hoveredStepIndex].type].tooltip
                    : STEP_CONFIG[currentStep.type].tooltip
                const stepNumber = `${stepIndex + 1}/${steps.length}`

                // Estimate tooltip width (approximate based on text length)
                const estimatedTooltipWidth = Math.max(80, (stepType.length + stepNumber.length) * 8 + 24) // 8px per char + padding

                // Calculate boundaries
                const leftBoundary = containerRect.left
                const rightBoundary = containerRect.right
                const halfTooltipWidth = estimatedTooltipWidth / 2

                // Determine positioning
                const left = baseX
                let transform = 'translateX(-50%)'

                // Check if tooltip would overflow left boundary
                if (baseX - halfTooltipWidth < leftBoundary) {
                    transform = 'translateX(0)'
                }
                // Check if tooltip would overflow right boundary
                else if (baseX + halfTooltipWidth > rightBoundary) {
                    transform = 'translateX(-100%)'
                }

                return (
                    <div
                        className="fixed rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white text-nowrap shadow-lg pointer-events-none border border-gray-700 z-50"
                        style={{
                            left,
                            top: containerRect.top - 45,
                            transform,
                        }}
                    >
                        <span>{stepType}</span>
                        <span className="text-xs ml-1 opacity-75">{stepNumber}</span>
                        {/* Arrow pointing down */}
                        <div
                            className="absolute left-1/2 top-full border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-gray-900"
                            style={{
                                transform: 'translateX(-50%)',
                                marginTop: '-1px', // Overlap with border
                            }}
                        />
                        {/* Arrow border */}
                        <div
                            className="absolute left-1/2 top-full border-l-[9px] border-r-[9px] border-t-[9px] border-l-transparent border-r-transparent border-t-gray-700"
                            style={{
                                transform: 'translateX(-50%)',
                                zIndex: -1,
                            }}
                        />
                    </div>
                )
            })()}

            <div
                onMouseMove={handleContainerMouseMove}
                onMouseEnter={handleContainerMouseEnter}
                onMouseLeave={handleContainerMouseLeave}
                className="w-full"
            >
                <Slider
                    value={[currentStep.index]}
                    onValueChange={handleSliderValueChange}
                    min={-1}
                    max={steps.length > 0 ? steps.length - 1 : 0}
                    step={1}
                    className={cn(
                        'pointer-events-none w-full',
                        '[&_[data-orientation=horizontal]]:h-4',
                        // Enable pointer events and add hover styles for the thumb
                        '[&_[role=slider]]:pointer-events-auto',
                        isDragging ? '[&_[role=slider]]:cursor-grabbing' : '[&_[role=slider]]:cursor-pointer',
                        '[&_[role=slider]]:hover:scale-125',
                        '[&_[role=slider]]:hover:shadow-lg',
                        '[&_[role=slider]]:transition-all',
                        '[&_[role=slider]]:duration-150',
                        '[&_[role=slider]]:ease-in-out',
                        // Glass-like effect for filled portion  
                        '[&_[data-orientation=horizontal]_span[data-orientation=horizontal]]:bg-white/20',
                        '[&_[data-orientation=horizontal]_span[data-orientation=horizontal]]:backdrop-blur',
                        '[&_[data-orientation=horizontal]_span[data-orientation=horizontal]]:border-white/30',
                        // current step is lest than 50%
                        '[&_[data-orientation=horizontal]_span[data-orientation=horizontal]]:rounded-full',
                        currentStep.index < steps.length / 2 ? '[&_[data-orientation=horizontal]_span[data-orientation=horizontal]]:-mr-[10px]' : '',
                    )}
                    onMouseEnter={handleSliderMouseEnter}
                    onMouseLeave={handleSliderMouseLeave}
                    onMouseMove={handleSliderMouseMove}
                    onMouseDown={handleSliderMouseDown}
                    onPointerDown={handleSliderPointerDown}
                />
            </div>
        </div>
    )
}

export default StepSlider
