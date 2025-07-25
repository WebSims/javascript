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
        tooltip: 'Executing Script',
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

    const setRefs = useCallback((el: HTMLDivElement | null) => {
        stepsContainerRef(el)
        setContainerElement(el)
    }, [stepsContainerRef])

    const depthInfo = useMemo(() => {
        const depths: number[] = []
        const inFunctionScopes: boolean[] = []
        const functionScopeDepths: number[] = []
        let depth = 0
        let functionScopeDepth = -1 // Track the depth at which function scope starts
        let maxDepth = 0
        let maxFunctionScopeDepth = 0

        for (const step of steps) {
            let inFunctionScope = functionScopeDepth >= 0 && depth >= functionScopeDepth
            let currentFunctionScopeDepth = functionScopeDepth >= 0 ? depth - functionScopeDepth + 1 : 0

            if (step.type === EXEC_STEP_TYPE.PUSH_SCOPE) {
                depth++
                maxDepth = Math.max(maxDepth, depth)

                // Check if this is a function scope
                if (step.memoryChange.type === "push_scope" &&
                    step.memoryChange.kind === "function") {
                    functionScopeDepth = depth
                    inFunctionScope = true
                    currentFunctionScopeDepth = 1
                    maxFunctionScopeDepth = Math.max(maxFunctionScopeDepth, functionScopeDepth)
                }
            } else if (step.type === EXEC_STEP_TYPE.POP_SCOPE) {
                // Check if we're popping the function scope
                if (functionScopeDepth >= 0 && depth === functionScopeDepth) {
                    functionScopeDepth = -1 // Reset function scope tracking
                    currentFunctionScopeDepth = 0
                }
                depth--
            }

            depths.push(depth)
            inFunctionScopes.push(inFunctionScope)
            functionScopeDepths.push(currentFunctionScopeDepth)
        }
        return { depths, inFunctionScopes, functionScopeDepths, maxDepth, maxFunctionScopeDepth }
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



    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        setIsDragging(true)
        setIsTooltipOpen(true)

        const stepIndex = getStepFromPosition(getClientX(e))
        if (stepIndex !== null) {
            changeStep(stepIndex)
            setHoveredStepIndex(stepIndex)
        }
    }, [getStepFromPosition, getClientX, changeStep])

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        e.preventDefault()
        setIsDragging(true)
        setIsTooltipOpen(true)

        const stepIndex = getStepFromPosition(getClientX(e))
        if (stepIndex !== null) {
            changeStep(stepIndex)
            setHoveredStepIndex(stepIndex)
        }
    }, [getStepFromPosition, getClientX, changeStep])

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
        setIsTooltipOpen(true)
    }, [getHoveredStepAndHalf, getClientX])

    const handleContainerMouseEnter = useCallback(() => {
        setIsTooltipOpen(true)
    }, [])

    const handleContainerMouseLeave = useCallback(() => {
        // Only hide tooltip if not dragging
        if (!isDragging) {
            setIsTooltipOpen(false)
            setHoveredStepIndex(null)
        }
    }, [isDragging])

    const handleSliderValueChange = useCallback(([value]: number[]) => {
        changeStep(value)
        setHoveredStepIndex(value)

        // Ensure tooltip stays visible during slider value changes
        setIsTooltipOpen(true)
    }, [changeStep])

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return

        const stepIndex = getStepFromPosition(getClientX(e))
        if (stepIndex !== null) {
            changeStep(stepIndex)
            setHoveredStepIndex(stepIndex)
        }

        // Ensure tooltip stays visible during dragging
        setIsTooltipOpen(true)
    }, [isDragging, getStepFromPosition, getClientX, changeStep])

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (!isDragging) return

        e.preventDefault() // Prevent scrolling while dragging

        const stepIndex = getStepFromPosition(getClientX(e))
        if (stepIndex !== null) {
            changeStep(stepIndex)
            setHoveredStepIndex(stepIndex)
        }

        // Ensure tooltip stays visible during dragging
        setIsTooltipOpen(true)
    }, [isDragging, getStepFromPosition, getClientX, changeStep])

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
        <div className="lg:flex lg:flex-col h-8 lg:h-24  w-full">
            {/* Extended hover area */}
            <div className="relative h-full lg:pt-6 lg:ml-32">
                <div
                    className="absolute z-20 left-0 right-0 inset-0 h-full"
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
                        "absolute left-0 right-0 top-3 lg:top-7 flex overflow-hidden rounded-full px-2.5 transition-all duration-75 ease-in-out",
                        isTooltipOpen ? "h-2.5" : "h-2"
                    )}
                    style={{
                        pointerEvents: 'none',
                        transform: 'translateY(-50%)',
                    }}
                >
                    {steps.map((step, index) => {
                        // For POP_SCOPE steps, use the next step's color
                        const targetIndex = step.type === EXEC_STEP_TYPE.POP_SCOPE && index < steps.length - 1
                            ? index + 1
                            : index

                        // Calculate lightness based on percentage of max depth
                        const baseLightness = 20
                        const maxLightness = 90
                        const lightnessRange = maxLightness - baseLightness

                        let lightness: number
                        if (depthInfo.inFunctionScopes[targetIndex]) {
                            // Use function scope depth percentage
                            const functionDepthPercentage = depthInfo.maxFunctionScopeDepth > 0
                                ? depthInfo.functionScopeDepths[targetIndex] / depthInfo.maxFunctionScopeDepth
                                : 0
                            lightness = baseLightness + (functionDepthPercentage * lightnessRange)
                        } else {
                            // Use regular depth percentage
                            const depthPercentage = depthInfo.maxDepth > 0
                                ? depthInfo.depths[targetIndex] / depthInfo.maxDepth
                                : 0
                            lightness = baseLightness + (depthPercentage * lightnessRange)
                        }

                        let backgroundColor: string
                        // Use blue color range when inside a function scope
                        if (depthInfo.inFunctionScopes[targetIndex]) {
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
                                        data-depth={depthInfo.depths[index]}
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
                        <div className="absolute top-8 left-1/4 p-0.5 pl-3 text-sm w-3/4 flex items-center gap-1">
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
                            className="fixed rounded-md bg-gray-900 px-3 py-2 text-sm text-white shadow-lg pointer-events-none border border-gray-700 z-50 transition-[left] duration-75 ease-in-out"
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
                                className="absolute top-full border-l-[9px] border-r-[9px] border-t-[9px] border-l-transparent border-r-transparent border-t-gray-900 transition-transform duration-75 ease-in-out"
                                style={{
                                    left: arrowLeft,
                                    transform: arrowTransform,
                                }}
                            />
                        </div>
                    )
                })()}

                <Slider
                    value={[currentStep.index]}
                    onValueChange={handleSliderValueChange}
                    min={0}
                    max={steps.length > 0 ? steps.length - 1 : 0}
                    step={1}
                    className={cn(
                        'pointer-events-none w-full absolute left-0 right-0 top-3 lg:top-7',
                        isTooltipOpen ? '[&_[data-orientation=horizontal]]:h-2.5' : '[&_[data-orientation=horizontal]]:h-2',
                        '[&_[data-orientation=horizontal]]:transition-all',
                        '[&_[data-orientation=horizontal]]:duration-75',
                        '[&_[data-orientation=horizontal]]:ease-in-out',
                        // Enable pointer events and add hover styles for the thumb
                        '[&_[role=slider]]:pointer-events-auto',
                        isDragging ? '[&_[role=slider]]:cursor-grabbing' : '[&_[role=slider]]:cursor-pointer',
                        '[&_[role=slider]]:w-5',
                        '[&_[role=slider]]:h-5',
                        '[&_[role=slider]]:hover:scale-125',
                        '[&_[role=slider]]:hover:shadow-lg',
                        // Glass-like effect for filled portion with enhanced contrast
                        '[&_[data-orientation=horizontal]_span[data-orientation=horizontal]]:bg-white/50',
                        // current step is lest than 50%
                        '[&_[data-orientation=horizontal]_span[data-orientation=horizontal]]:rounded-full',
                        currentStep.index < steps.length / 2 ? '[&_[data-orientation=horizontal]_span[data-orientation=horizontal]]:-mr-[7px]' : '',
                    )}
                    style={{
                        transform: 'translateY(-50%)',
                    }}
                />
            </div>

            {/* Desktop Description */}
            {!isMobile && (() => {
                return (
                    <div className="px-0.5 pb-2 text-sm flex items-center gap-1">
                        <span className="flex-1 text-gray-700">Step description here!</span>
                        <span className="text-xs opacity-75">Step {currentStep.index + 1} of {steps.length}</span>
                    </div>
                )
            })()}
        </div>
    )
}

export default StepSlider
