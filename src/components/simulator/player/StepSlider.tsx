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
    const [isThumbHovered, setIsThumbHovered] = useState(false)
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
        const stepIndex = getStepFromPosition(getClientX(e))
        if (stepIndex !== null) {
            setHoveredStepIndex(stepIndex)
        }

        // Update mouse position relative to the container
        if (containerElement) {
            const rect = containerElement.getBoundingClientRect()
            setMousePosition({
                x: getClientX(e) - rect.left,
                y: getClientY(e) - rect.top
            })
        }
    }, [getStepFromPosition, getClientX, getClientY, containerElement])

    const handleContainerMouseEnter = useCallback(() => {
        setIsTooltipOpen(true)
    }, [])

    const handleContainerMouseLeave = useCallback(() => {
        if (!isDragging) {
            setIsTooltipOpen(false)
            setHoveredStepIndex(null)
        }
    }, [isDragging])

    // Handlers for slider thumb hover
    const handleThumbMouseEnter = useCallback((e: React.MouseEvent) => {
        setIsThumbHovered(true)
        setIsTooltipOpen(true)

        // Update mouse position for tooltip
        if (containerElement) {
            const rect = containerElement.getBoundingClientRect()
            setMousePosition({
                x: getClientX(e) - rect.left,
                y: getClientY(e) - rect.top
            })
        }
    }, [getClientX, getClientY, containerElement])

    const handleThumbMouseLeave = useCallback(() => {
        setIsThumbHovered(false)
        if (!isDragging) {
            setIsTooltipOpen(false)
        }
    }, [isDragging])

    const handleThumbMouseMove = useCallback((e: React.MouseEvent) => {
        if (isThumbHovered && containerElement) {
            const rect = containerElement.getBoundingClientRect()
            setMousePosition({
                x: getClientX(e) - rect.left,
                y: getClientY(e) - rect.top
            })
        }
    }, [isThumbHovered, getClientX, getClientY, containerElement])

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return

        const stepIndex = getStepFromPosition(getClientX(e))
        if (stepIndex !== null) {
            changeStep(stepIndex)
            setHoveredStepIndex(stepIndex)
        }

        // Update mouse position relative to the container during dragging
        if (containerElement) {
            const rect = containerElement.getBoundingClientRect()
            setMousePosition({
                x: getClientX(e) - rect.left,
                y: getClientY(e) - rect.top
            })
        }
    }, [isDragging, getStepFromPosition, getClientX, getClientY, changeStep, containerElement])

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (!isDragging) return

        e.preventDefault() // Prevent scrolling while dragging
        const stepIndex = getStepFromPosition(getClientX(e))
        if (stepIndex !== null) {
            changeStep(stepIndex)
            setHoveredStepIndex(stepIndex)
        }

        // Update mouse position relative to the container during dragging
        if (containerElement) {
            const rect = containerElement.getBoundingClientRect()
            setMousePosition({
                x: getClientX(e) - rect.left,
                y: getClientY(e) - rect.top
            })
        }
    }, [isDragging, getStepFromPosition, getClientX, getClientY, changeStep, containerElement])

    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
        setIsTooltipOpen(false)
        setHoveredStepIndex(null)
    }, [])

    const handleTouchEnd = useCallback(() => {
        setIsDragging(false)
        setIsTooltipOpen(false)
        setHoveredStepIndex(null)
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

    // Calculate thumb position for tooltip
    const getThumbPosition = useCallback(() => {
        if (!containerElement || !containerSize.width || !currentStep) return { x: 0, y: 0 }

        const progress = steps.length > 1 ? currentStep.index / (steps.length - 1) : 0
        const thumbX = progress * containerSize.width

        return { x: thumbX, y: 8 } // y: 8 is approximate center of the thumb
    }, [containerElement, containerSize.width, currentStep, steps.length])

    if (!currentStep) return null

    return (
        <div className="relative flex h-10 lg:h-16 w-full items-center">
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

                const baseX = (isThumbHovered ? getThumbPosition().x : mousePosition.x) + containerRect.left
                const tooltipText = isThumbHovered
                    ? STEP_CONFIG[currentStep.type].tooltip
                    : hoveredStepIndex !== null && stepsWithDepth[hoveredStepIndex]
                        ? STEP_CONFIG[stepsWithDepth[hoveredStepIndex].type].tooltip
                        : STEP_CONFIG[currentStep.type].tooltip

                // Estimate tooltip width (approximate based on text length)
                const estimatedTooltipWidth = Math.max(80, tooltipText.length * 8 + 24) // 8px per char + padding

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
                            top: containerRect.top - 50,
                            transform,
                        }}
                    >
                        {tooltipText}
                    </div>
                )
            })()}

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
                onMouseEnter={handleThumbMouseEnter}
                onMouseLeave={handleThumbMouseLeave}
                onMouseMove={handleThumbMouseMove}
            />
        </div>
    )
}

export default StepSlider