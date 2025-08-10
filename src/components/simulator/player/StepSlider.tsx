import React, { useMemo, useState, useCallback } from 'react'
import { EXEC_STEP_TYPE } from '@/types/simulator'
import { cn } from '@/lib/utils'
import { useSimulatorStore } from '@/hooks/useSimulatorStore'
import { useResponsive } from '@/hooks/useResponsive'

import { Slider } from '@/components/ui/slider'
import useElementSize from '@/hooks/useElementSize'
import { useSpringFollower } from '@/hooks/useSpringFollower'
import { TOOLTIP_WIDTH } from '@/configs/steps.config'
import { getStepColorByDepth } from '@/helpers/steps'
import { getStepTag, getStepClassName, getStepTooltip } from '@/helpers/steps'

const StepSlider: React.FC = () => {
    const {
        steps,
        currentStep,
        changeStep,
        astError,
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

    const getMaxDepth = useMemo(() => {
        return Math.max(...steps.map(step => step.scopeIndex))
    }, [steps])

    const isInFunctionScope = useCallback((stepIndex: number) => {
        const step = steps[stepIndex]
        if (!step) return false

        // Check if current scope is a function scope
        const currentScope = step.memorySnapshot.scopes[step.scopeIndex]
        return currentScope?.type === 'function'
    }, [steps])

    // Unified function to get clientX from pointer event
    const getClientX = useCallback((e: PointerEvent | React.PointerEvent) => {
        return e.clientX
    }, [])

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

    // Spring follower for tooltip animation
    // Calculate target position for spring follower
    const tooltipTargetX = (() => {
        if (!containerElement || !containerSize.width || !currentStep) return 0

        const containerRect = containerElement.getBoundingClientRect()
        const stepIndex = isDragging ? currentStep.index : (hoveredStepIndex !== null ? hoveredStepIndex : currentStep.index)
        const baseX = isDragging
            ? containerRect.left + getStepStartPosition(currentStep.index) + 10
            : containerRect.left + getStepStartPosition(stepIndex) + 10

        return baseX
    })()

    const animatedTooltipX = useSpringFollower(tooltipTargetX, { lagMs: 150, snapEps: TOOLTIP_WIDTH })

    // Unified pointer event handler for element actions
    const handlePointer = useCallback((e: React.PointerEvent) => {
        switch (e.type) {
            case 'pointerdown': {
                e.preventDefault()
                setIsDragging(true)
                setIsTooltipOpen(true)
                const stepIndex = getStepFromPosition(getClientX(e))
                if (stepIndex !== null) {
                    changeStep(stepIndex)
                    setHoveredStepIndex(stepIndex)
                }
                break
            }
            case 'pointermove': {
                const { stepIndex } = getHoveredStepAndHalf(getClientX(e))
                if (stepIndex !== null) {
                    setHoveredStepIndex(stepIndex)
                }
                setIsTooltipOpen(true)
                break
            }
            case 'pointerleave': {
                if (!isDragging) {
                    setIsTooltipOpen(false)
                    setHoveredStepIndex(null)
                }
                break
            }
            default:
                break
        }
    }, [isDragging, getStepFromPosition, getClientX, changeStep, getHoveredStepAndHalf])

    const handleSliderValueChange = useCallback(([value]: number[]) => {
        changeStep(value)
        setHoveredStepIndex(value)
        setIsTooltipOpen(true)
    }, [changeStep])

    const isPointerInSliderArea = useCallback((clientX: number, clientY: number) => {
        if (!containerElement) return false

        const rect = containerElement.getBoundingClientRect()
        return (
            clientX >= rect.left &&
            clientX <= rect.right &&
            clientY >= rect.top &&
            clientY <= rect.bottom
        )
    }, [containerElement])

    // Add global pointer event listeners when dragging
    React.useEffect(() => {
        if (isDragging) {
            const handleGlobalPointerMove = (e: PointerEvent) => {
                setIsTooltipOpen(true)
                const { stepIndex } = getHoveredStepAndHalf(e.clientX)
                if (stepIndex !== null) {
                    setHoveredStepIndex(stepIndex)
                    // Change step when dragging
                    changeStep(stepIndex)
                }
            }

            const handleGlobalPointerUp = (e: PointerEvent) => {
                setIsDragging(false)
                setHoveredStepIndex(null)

                // Check if pointer is outside the slider area
                if (!isPointerInSliderArea(e.clientX, e.clientY)) {
                    setIsTooltipOpen(false)
                }
            }

            document.addEventListener('pointermove', handleGlobalPointerMove, { capture: true })
            document.addEventListener('pointerup', handleGlobalPointerUp, { capture: true })

            return () => {
                document.removeEventListener('pointermove', handleGlobalPointerMove, { capture: true })
                document.removeEventListener('pointerup', handleGlobalPointerUp, { capture: true })
            }
        }
    }, [isDragging, getHoveredStepAndHalf, isPointerInSliderArea, changeStep])

    // Show error state when there's an AST error or no current step
    if (astError || !currentStep) {
        return (
            <div className="lg:flex lg:flex-col h-8 lg:h-24 w-full">
                <div className="relative h-full lg:pt-6 lg:ml-32">
                    <div className="absolute left-0 right-0 top-3 lg:top-1/2 -translate-y-1/2 flex items-center justify-center h-2.5 lg:h-2">
                        <div className="w-full h-full bg-gray-200 rounded-full flex items-center justify-center"></div>
                    </div>
                </div>

                {/* Desktop Description */}
                {!isMobile && (
                    <div className="px-0.5 pb-2 text-sm flex items-center gap-1">
                        <span className="flex-1 text-gray-500">
                            {astError ? "Fix the syntax error to run simulation" : "No execution steps available"}
                        </span>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="lg:flex lg:flex-col h-8 lg:h-24 w-full">
            {/* Extended hover area */}
            <div className="relative h-full lg:pt-6 lg:ml-32">
                <div
                    className="absolute z-20 left-0 right-0 inset-0 h-full"
                    onPointerDown={handlePointer}
                    onPointerMove={handlePointer}
                    onPointerLeave={handlePointer}
                    style={{ cursor: isDragging ? 'grabbing' : 'pointer', touchAction: 'none' }}
                />

                <div
                    ref={setRefs}
                    className={cn(
                        "absolute left-0 right-0 top-3 lg:top-1/2 -translate-y-1/2 px-2.5 flex overflow-hidden transition-all duration-200",
                        isTooltipOpen ? "h-3.5" : "h-2"
                    )}
                    style={{
                        pointerEvents: 'none',
                        transform: 'translateY(-50%)',
                    }}
                >
                    {steps.map((step, index) => {
                        if (index === steps.length - 1) return

                        // For POP_SCOPE steps, use the next step's values
                        const shouldUseNextStep = step.type === EXEC_STEP_TYPE.POP_SCOPE && index < steps.length - 1
                        const targetIndex = shouldUseNextStep ? index + 1 : index
                        const targetScopeIndex = shouldUseNextStep ? steps[index + 1].scopeIndex : step.scopeIndex

                        // Get depth-based colors using the shared configuration
                        const stepColor = getStepColorByDepth(
                            targetScopeIndex,
                            getMaxDepth,
                            isInFunctionScope(targetIndex)
                        )

                        return (
                            <>
                                <div
                                    key={step.index}
                                    className='flex-1 h-full'
                                    style={{ backgroundColor: stepColor.backgroundColor }}
                                />
                            </>
                        )
                    })}
                </div>

                {/* Mobile Tooltip */}
                {isMobile && currentStep && (() => {
                    const stepTag = getStepTag(currentStep.type, currentStep)
                    const stepType = getStepTooltip(currentStep.type)
                    const stepClassName = getStepClassName(currentStep.type, currentStep)
                    const stepNumber = `${currentStep.index + 1}/${steps.length}`

                    return (
                        <div className="absolute top-8 left-1/4 p-0.5 pl-3 text-sm w-3/4 flex items-center gap-1">
                            {stepTag && stepTag.trim() && (
                                <span className={cn("inline-flex items-center justify-center w-6 h-6 text-gray-800 text-xs font-bold rounded-full", stepClassName)}>
                                    {stepTag}
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
                    // When dragging, always show current step index, otherwise show hovered step
                    const tooltipStep = isDragging ? currentStep : (hoveredStepIndex !== null && steps[hoveredStepIndex])
                        ? steps[hoveredStepIndex]
                        : currentStep
                    const stepTag = getStepTag(tooltipStep.type, tooltipStep)
                    const stepType = getStepTooltip(tooltipStep.type)
                    const stepNumber = `${stepIndex + 1}/${steps.length}`
                    const stepClassName = getStepClassName(tooltipStep.type, tooltipStep)

                    // Use animated position from spring follower
                    const baseX = animatedTooltipX

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
                                {stepTag && stepTag.trim() && (
                                    <span className={cn("inline-flex items-center justify-center w-6 h-6 text-gray-800 text-xs font-bold rounded-full", stepClassName)}>
                                        {stepTag}
                                    </span>
                                )}
                                <span className="flex-1 text-white">{stepType}</span>
                                <span className="text-xs opacity-75">{stepNumber}</span>
                            </div>
                            {/* Arrow pointing down */}
                            <div
                                className="absolute top-full border-l-[9px] border-r-[9px] border-t-[9px] border-l-transparent border-r-transparent border-t-gray-900"
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
                        'pointer-events-none w-full absolute left-0 right-0 top-3 lg:top-1/2 -translate-y-1/2 z-30 px-2.5',
                        isTooltipOpen ? '[&_[data-orientation=horizontal]]:h-3.5' : '[&_[data-orientation=horizontal]]:h-2',
                        '[&_[data-orientation=horizontal]]:transition-all [&_[data-orientation=horizontal]]:duration-200',
                        '[&_[data-orientation=horizontal]]:rounded-none',
                        // Enable pointer events and add hover styles for the thumb
                        '[&_[role=slider]]:pointer-events-auto',
                        isDragging ? '[&_[role=slider]]:cursor-grabbing' : '[&_[role=slider]]:cursor-pointer',
                        // Classic media player button styling - rectangular donut shape
                        '[&_[role=slider]]:h-3.5',
                        '[&_[role=slider]]:w-2',
                        '[&_[role=slider]]:box-content',
                        '[&_[role=slider]]:rounded-none',
                        '[&_[role=slider]]:bg-transparent',
                        '[&_[role=slider]]:border-[7px] [&_[role=slider]]:border-stone-400',
                        // Glass-like effect for filled portion with enhanced contrast
                        '[&_[data-orientation=horizontal]_span[data-orientation=horizontal]]:bg-transparent',
                    )}
                    onPointerDown={handlePointer}
                    onPointerMove={handlePointer}
                    onPointerLeave={handlePointer}
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
