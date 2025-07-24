import React, { useMemo, useState, useCallback } from 'react'
import { EXEC_STEP_TYPE, ExecStep, ExecStepType } from '@/types/simulator'
import { cn } from '@/lib/utils'
import { useSimulatorStore } from '@/hooks/useSimulatorStore'
import { useResponsive } from '@/hooks/useResponsive'

import { Slider } from '@/components/ui/slider'
import useElementSize from '@/hooks/useElementSize'

const TOOLTIP_WIDTH = 260

const STEP_CONFIG: Record<ExecStepType, {
    label: string | ((step: ExecStep) => string)
    className: string | ((step: ExecStep) => string)
    tooltip: string
}> = {
    [EXEC_STEP_TYPE.INITIAL]: {
        label: 'S',
        className: 'bg-white',
        tooltip: 'Execution Script',
    },
    [EXEC_STEP_TYPE.PUSH_SCOPE]: {
        label: (step: ExecStep) => {
            if (step.memoryChange?.type === 'push_scope' && step.memoryChange.kind === 'program') {
                return 'G'
            }
            return '{'
        },
        className: (step: ExecStep) => {
            if (step.memoryChange?.type === 'push_scope' && step.memoryChange.kind === 'function') {
                return 'bg-blue-100'
            }
            return 'bg-gray-100'
        },
        tooltip: 'Create Scope',
    },
    [EXEC_STEP_TYPE.HOISTING]: {
        label: 'H',
        className: 'bg-orange-200',
        tooltip: 'Hoisting',
    },
    [EXEC_STEP_TYPE.POP_SCOPE]: {
        label: '}',
        className: (step: ExecStep) => {
            if (step.memoryChange?.type === 'pop_scope' && step.memoryChange.kind === 'function') {
                return 'bg-blue-100'
            }
            return 'bg-gray-100'
        },
        tooltip: 'Remove Scope',
    },
    [EXEC_STEP_TYPE.EXECUTING]: {
        label: 'S',
        className: 'bg-yellow-200',
        tooltip: 'Executing Statement',
    },
    [EXEC_STEP_TYPE.EXECUTED]: {
        label: ';',
        className: 'bg-yellow-200',
        tooltip: 'Statement Executed',
    },
    [EXEC_STEP_TYPE.EVALUATING]: {
        label: '(',
        className: 'bg-green-100',
        tooltip: 'Evaluating Expression',
    },
    [EXEC_STEP_TYPE.EVALUATED]: {
        label: ')',
        className: 'bg-green-100',
        tooltip: 'Expression Evaluated',
    },
    [EXEC_STEP_TYPE.FUNCTION_CALL]: {
        label: 'F',
        className: 'bg-purple-100',
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
        const x = clientX - rect.left - 10
        const stepWidth = (containerSize.width) / (steps.length - 1)
        const stepIndex = Math.floor(x / stepWidth)

        return Math.max(0, Math.min(stepIndex, steps.length - 1))
    }, [containerElement, containerSize.width, steps.length])

    const getStepStartPosition = useCallback((stepIndex: number) => {
        if (!containerSize.width) return 0
        const stepWidth = containerSize.width / (steps.length - 1)
        return stepIndex * stepWidth
    }, [containerSize.width, steps.length])

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

    // Helper to get hovered step and half
    const getHoveredStepAndHalf = useCallback((clientX: number) => {
        if (!containerElement || !containerSize.width) return { stepIndex: null, half: null }
        const rect = containerElement.getBoundingClientRect()
        const x = clientX - rect.left - 10
        const stepWidth = containerSize.width / (steps.length - 1)
        let stepIndex = Math.floor(x / stepWidth)
        stepIndex = Math.max(0, Math.min(stepIndex, steps.length - 1))
        const stepStart = stepIndex * stepWidth
        const inRightHalf = x - stepStart > stepWidth / 2
        return {
            stepIndex: inRightHalf && stepIndex < steps.length - 1 ? stepIndex + 1 : stepIndex,
            half: inRightHalf ? 'right' : 'left',
        }
    }, [containerElement, containerSize.width, steps.length])

    // Update mouse move handler to use new logic
    const handleContainerMouseMove = useCallback((e: React.MouseEvent) => {
        const { stepIndex } = getHoveredStepAndHalf(getClientX(e))
        if (stepIndex !== null) {
            setHoveredStepIndex(stepIndex)
        }
        updateMousePosition(e)
        setIsTooltipOpen(true)
    }, [getHoveredStepAndHalf, getClientX, updateMousePosition])

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

    const isMouseInSliderArea = useCallback((clientX: number, clientY: number) => {
        if (!containerElement) return false

        const rect = containerElement.getBoundingClientRect()
        return (
            clientX >= rect.left &&
            clientX <= rect.right &&
            clientY >= rect.top &&
            clientY <= rect.bottom
        )
    }, [containerElement])

    const handleMouseUp = useCallback((e: MouseEvent) => {
        setIsDragging(false)

        // Check if mouse is outside the slider area
        if (!isMouseInSliderArea(e.clientX, e.clientY)) {
            setIsTooltipOpen(false)
            setHoveredStepIndex(null)
        }
    }, [isMouseInSliderArea])

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
                const { stepIndex } = getHoveredStepAndHalf(e.clientX)
                if (stepIndex !== null) {
                    setHoveredStepIndex(stepIndex)
                }
            }

            const handlePointerUp = (e: PointerEvent) => {
                setIsDragging(false)
                setHoveredStepIndex(null)

                // Check if mouse is outside the slider area
                if (!isMouseInSliderArea(e.clientX, e.clientY)) {
                    setIsTooltipOpen(false)
                }
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
    }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd, containerElement, getStepFromPosition, isMouseInSliderArea, getHoveredStepAndHalf])



    if (!currentStep) return null

    return (
        <div className="relative flex h-10 lg:h-24 lg:pb-6 items-center w-full">
            {/* Extended hover area */}
            <div
                className="absolute z-20 left-0 lg:left-32 right-0 inset-0 h-full"
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                onMouseMove={handleContainerMouseMove}
                onMouseEnter={handleContainerMouseEnter}
                onMouseLeave={handleContainerMouseLeave}
                style={{ cursor: isDragging ? 'grabbing' : 'pointer', touchAction: 'none' }}
            />

            <div
                ref={setRefs}
                className={cn(
                    "absolute left-0 lg:left-32 right-0 flex overflow-hidden rounded-full px-2.5 transition-all duration-200 ease-in-out",
                    isTooltipOpen ? "h-3" : "h-2.5"
                )}
                style={{ pointerEvents: 'none' }}
            >
                {stepsWithDepth.map((step, index) => {
                    const lightness = Math.min(90, 20 + step.depth * 10)

                    let backgroundColor: string
                    // Use blue color range when inside a function scope
                    if (step.inFunctionScope) {
                        backgroundColor = `hsl(50, 50%, ${lightness}%)`
                    } else {
                        // Use default grayscale
                        backgroundColor = `hsl(0, 0%, ${lightness}%)`
                    }

                    if (index !== steps.length - 1) {
                        return (
                            <>
                                {index === 0 && (<div className='w-2.5 absolute left-0 top-0 bottom-0' style={{ backgroundColor }}></div>)}
                                <div
                                    key={step.index}
                                    data-depth={step.depth}
                                    className='flex-1 h-full'
                                    style={{ backgroundColor }}
                                />
                            </>
                        )
                    } else {
                        return (<div className='w-2.5 absolute right-0 top-0 bottom-0' style={{ backgroundColor }}></div>)
                    }
                })}
            </div>

            {/* Mobile Tooltip */}
            {isMobile && currentStep && (() => {
                const stepConfig = STEP_CONFIG[currentStep.type]
                const stepLabel = typeof stepConfig.label === 'function'
                    ? stepConfig.label(currentStep)
                    : stepConfig.label
                const stepType = stepConfig.tooltip
                const stepClassName = typeof stepConfig.className === 'function'
                    ? stepConfig.className(currentStep)
                    : stepConfig.className
                const stepNumber = `${currentStep.index + 1}/${steps.length}`

                return (
                    <div className="absolute top-10 left-1/4 p-0.5 pl-3 text-sm w-3/4 flex items-center gap-1">
                        {stepLabel && stepLabel.trim() && (
                            <span className={cn("inline-flex items-center justify-center w-6 h-6 text-gray-800 text-xs font-bold rounded-full", stepClassName)}>
                                {stepLabel}
                            </span>
                        )}
                        <span className="flex-1 text-gray-700">{stepType}</span>
                        <span className="text-xs opacity-75">{stepNumber}</span>
                    </div>
                )
            })()}

            {/* Desktop Tooltip */}
            {!isMobile && isTooltipOpen && (() => {
                const containerRect = containerElement?.getBoundingClientRect()
                if (!containerRect) return null
                const stepIndex = isDragging ? currentStep.index : (hoveredStepIndex !== null ? hoveredStepIndex : currentStep.index)
                // When dragging, use the thumb position, otherwise use mouse position
                const baseX = isDragging
                    ? containerRect.left + getStepStartPosition(currentStep.index) + 10
                    : containerRect.left + getStepStartPosition(stepIndex) + 10
                // When dragging, always show current step index, otherwise show hovered step
                const tooltipStep = isDragging ? currentStep : (hoveredStepIndex !== null && steps[hoveredStepIndex])
                    ? steps[hoveredStepIndex]
                    : currentStep
                const stepConfig = STEP_CONFIG[tooltipStep.type]
                const stepLabel = typeof stepConfig.label === 'function'
                    ? stepConfig.label(tooltipStep)
                    : stepConfig.label
                const stepType = stepConfig.tooltip
                const stepNumber = `${stepIndex + 1}/${steps.length}`
                const stepClassName = typeof stepConfig.className === 'function'
                    ? stepConfig.className(tooltipStep)
                    : stepConfig.className
                // Calculate boundaries
                const leftBoundary = containerRect.left
                const rightBoundary = containerRect.right
                const halfTooltipWidth = TOOLTIP_WIDTH / 2
                // Determine positioning
                let left = baseX
                let transform = 'translateX(-50%)'
                if (baseX - halfTooltipWidth < leftBoundary) {
                    left = leftBoundary
                    transform = 'translateX(0)'
                } else if (baseX + halfTooltipWidth > rightBoundary) {
                    left = rightBoundary
                    transform = 'translateX(-100%)'
                }
                // Calculate arrow position relative to tooltip
                let arrowLeft = '50%'
                let arrowTransform = 'translateX(-50%)'
                if (baseX - halfTooltipWidth < leftBoundary) {
                    const arrowOffset = Math.max(baseX - leftBoundary - 10, 2)
                    arrowLeft = `${arrowOffset}px`
                    arrowTransform = 'translateX(0)'
                } else if (baseX + halfTooltipWidth > rightBoundary) {
                    const arrowOffset = Math.min(baseX - (rightBoundary - TOOLTIP_WIDTH) - 10, 238)
                    arrowLeft = `${arrowOffset}px`
                    arrowTransform = 'translateX(0)'
                }
                return (
                    <div
                        className="fixed rounded-md bg-gray-900 px-3 py-2 text-sm text-white shadow-lg pointer-events-none border border-gray-700 z-50"
                        style={{
                            left,
                            top: containerRect.top - 55,
                            transform,
                            minWidth: `${TOOLTIP_WIDTH}px`,
                        }}
                    >
                        <div className="flex items-center gap-2 text-nowrap">
                            {stepLabel && stepLabel.trim() && (
                                <span className={cn("inline-flex items-center justify-center w-6 h-6 text-gray-800 text-xs font-bold rounded-full", stepClassName)}>
                                    {stepLabel}
                                </span>
                            )}
                            <span className="flex-1 text-white">{stepType}</span>
                            <span className="text-xs opacity-75">{stepNumber}</span>
                        </div>
                        {/* Arrow pointing down */}
                        <div
                            className="absolute top-full border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-gray-900"
                            style={{
                                left: arrowLeft,
                                transform: arrowTransform,
                                marginTop: '-1px',
                            }}
                        />
                        <div
                            className="absolute top-full border-l-[9px] border-r-[9px] border-t-[9px] border-l-transparent border-r-transparent border-t-gray-700"
                            style={{
                                left: arrowLeft,
                                transform: arrowTransform,
                                zIndex: -1,
                            }}
                        />
                    </div>
                )
            })()}

            {/* Desktop Description */}
            {!isMobile && (() => {
                return (
                    <div className="absolute z-10 bottom-4 right-0 left-0 px-0.5 text-sm flex items-center gap-1">
                        <span className="flex-1 text-gray-700">Step description here!</span>
                        <span className="text-xs opacity-75">Step {currentStep.index + 1} of {steps.length}</span>
                    </div>
                )
            })()}

            <div
                onMouseMove={handleContainerMouseMove}
                onMouseEnter={handleContainerMouseEnter}
                onMouseLeave={handleContainerMouseLeave}
                className="w-full lg:ml-32"
            >
                <Slider
                    value={[currentStep.index]}
                    onValueChange={handleSliderValueChange}
                    min={0}
                    max={steps.length > 0 ? steps.length - 1 : 0}
                    step={1}
                    className={cn(
                        'pointer-events-none w-full',
                        isTooltipOpen ? '[&_[data-orientation=horizontal]]:h-3' : '[&_[data-orientation=horizontal]]:h-2.5',
                        // Enable pointer events and add hover styles for the thumb
                        '[&_[role=slider]]:pointer-events-auto',
                        isDragging ? '[&_[role=slider]]:cursor-grabbing' : '[&_[role=slider]]:cursor-pointer',
                        '[&_[role=slider]]:bg-red-500',
                        '[&_[role=slider]]:border-red-500',
                        '[&_[role=slider]]:w-5',
                        '[&_[role=slider]]:h-5',
                        '[&_[role=slider]]:hover:scale-125',
                        '[&_[role=slider]]:hover:shadow-lg',
                        '[&_[role=slider]]:transition-all',
                        '[&_[role=slider]]:duration-150',
                        '[&_[role=slider]]:ease-in-out',
                        // Glass-like effect for filled portion with enhanced contrast
                        '[&_[data-orientation=horizontal]_span[data-orientation=horizontal]]:bg-red-500/60',
                        // current step is lest than 50%
                        '[&_[data-orientation=horizontal]_span[data-orientation=horizontal]]:rounded-full',
                        currentStep.index < steps.length / 2 ? '[&_[data-orientation=horizontal]_span[data-orientation=horizontal]]:-mr-[7px]' : '',
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
