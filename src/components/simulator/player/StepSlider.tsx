import React, { useRef, useEffect, useState, useCallback } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { CustomNode, EXEC_STEP_TYPE, ExecStep, ExecStepType } from '@/types/simulation'
import { cn } from '@/lib/utils'
import { useSimulatorStore } from '@/hooks/useSimulatorStore'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import get from 'lodash/get'
import { decorations } from '../code-area/CodeArea'
import { useResponsive } from '@/hooks/useResponsive'

const STEP_ITEM_WIDTH = 40 // 36px min-width + 4px margins (2px each side)

const STEP_CONFIG: Record<ExecStepType, {
    label: string | ((step: ExecStep) => string)
    className: string | ((step: ExecStep) => string)
    tooltip: string
}> = {
    [EXEC_STEP_TYPE.INITIAL]: {
        label: '',
        className: 'bg-white',
        tooltip: 'Initial',
    },
    [EXEC_STEP_TYPE.PUSH_SCOPE]: {
        label: (step: ExecStep) => {
            if (step.memoryChange?.type === 'push_scope' && step.memoryChange.kind === 'program') {
                return ''
            }
            return '{'
        },
        className: (step: ExecStep) => {
            if (step.memoryChange?.type === 'push_scope' && step.memoryChange.kind === 'function') {
                return 'bg-blue-100'
            }
            return 'bg-gray-100'
        },
        tooltip: 'Push Scope',
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
        tooltip: 'Pop Scope',
    },
    [EXEC_STEP_TYPE.EXECUTING]: {
        label: 'S',
        className: 'bg-yellow-200',
        tooltip: 'Executing',
    },
    [EXEC_STEP_TYPE.EXECUTED]: {
        label: ';',
        className: 'bg-yellow-200',
        tooltip: 'Executed',
    },
    [EXEC_STEP_TYPE.EVALUATING]: {
        label: '(',
        className: 'bg-green-100',
        tooltip: 'Evaluating',
    },
    [EXEC_STEP_TYPE.EVALUATED]: {
        label: ')',
        className: 'bg-green-100',
        tooltip: 'Evaluated',
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
        changeStep
    } = useSimulatorStore()
    const currentStepIndex = currentStep?.index ?? 0

    const { isDesktop } = useResponsive()

    const containerRef = useRef<HTMLDivElement>(null)
    const sliderRef = useRef<HTMLDivElement>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [startX, setStartX] = useState(0)
    const [scrollLeft, setScrollLeft] = useState(0)
    const [isWheelScrolling, setIsWheelScrolling] = useState(false)

    const calculateCenterStep = useCallback(() => {
        if (!sliderRef.current) return currentStepIndex

        const currentScroll = sliderRef.current.scrollLeft
        const itemWidth = STEP_ITEM_WIDTH

        const itemIndex = Math.floor(currentScroll / itemWidth)

        return Math.max(0, Math.min(steps.length - 1, itemIndex))
    }, [currentStepIndex, steps.length])

    useEffect(() => {
        if (!sliderRef.current || isDragging || isWheelScrolling) return

        const slider = sliderRef.current
        const itemWidth = STEP_ITEM_WIDTH

        const targetScrollLeft = (currentStepIndex * itemWidth) + (itemWidth / 2)

        slider.scrollTo({
            left: targetScrollLeft,
            behavior: 'smooth'
        })
    }, [currentStepIndex, steps.length, isDragging, isWheelScrolling])

    const handleDocumentMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !sliderRef.current) return

        e.preventDefault()
        const sliderRect = sliderRef.current.getBoundingClientRect()
        const x = e.clientX - sliderRect.left
        const walk = (x - startX) * 1.5
        sliderRef.current.scrollLeft = scrollLeft - walk

        const newCenterStep = calculateCenterStep()
        if (newCenterStep !== currentStepIndex) {
            changeStep(newCenterStep)
        }
    }, [isDragging, startX, scrollLeft, currentStepIndex, changeStep, calculateCenterStep])

    const handleDocumentMouseUp = useCallback(() => {
        if (!isDragging) return

        setIsDragging(false)

        const finalCenterStep = calculateCenterStep()
        if (finalCenterStep !== currentStepIndex) {
            changeStep(finalCenterStep)
        }
    }, [isDragging, currentStepIndex, changeStep, calculateCenterStep])

    const handleDocumentTouchMove = useCallback((e: TouchEvent) => {
        if (!isDragging || !sliderRef.current) return

        e.preventDefault()
        const sliderRect = sliderRef.current.getBoundingClientRect()
        const x = e.touches[0].clientX - sliderRect.left
        const walk = (x - startX) * 1.5
        sliderRef.current.scrollLeft = scrollLeft - walk

        const newCenterStep = calculateCenterStep()
        if (newCenterStep !== currentStepIndex) {
            changeStep(newCenterStep)
        }
    }, [isDragging, startX, scrollLeft, currentStepIndex, changeStep, calculateCenterStep])

    const handleDocumentTouchEnd = useCallback(() => {
        if (!isDragging) return

        setIsDragging(false)

        const finalCenterStep = calculateCenterStep()
        if (finalCenterStep !== currentStepIndex) {
            changeStep(finalCenterStep)
        }
    }, [isDragging, currentStepIndex, changeStep, calculateCenterStep])

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleDocumentMouseMove)
            document.addEventListener('mouseup', handleDocumentMouseUp)
            document.addEventListener('touchmove', handleDocumentTouchMove, { passive: false })
            document.addEventListener('touchend', handleDocumentTouchEnd)
            document.body.style.userSelect = 'none'
        } else {
            document.removeEventListener('mousemove', handleDocumentMouseMove)
            document.removeEventListener('mouseup', handleDocumentMouseUp)
            document.removeEventListener('touchmove', handleDocumentTouchMove)
            document.removeEventListener('touchend', handleDocumentTouchEnd)
            document.body.style.userSelect = ''
        }

        return () => {
            document.removeEventListener('mousemove', handleDocumentMouseMove)
            document.removeEventListener('mouseup', handleDocumentMouseUp)
            document.removeEventListener('touchmove', handleDocumentTouchMove)
            document.removeEventListener('touchend', handleDocumentTouchEnd)
            document.body.style.userSelect = ''
        }
    }, [isDragging, handleDocumentMouseMove, handleDocumentMouseUp, handleDocumentTouchMove, handleDocumentTouchEnd])

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!sliderRef.current) return

        setIsDragging(true)
        const sliderRect = sliderRef.current.getBoundingClientRect()
        setStartX(e.clientX - sliderRect.left)
        setScrollLeft(sliderRef.current.scrollLeft)
        e.preventDefault()
    }

    const handleTouchStart = (e: React.TouchEvent) => {
        if (!sliderRef.current) return

        setIsDragging(true)
        const sliderRect = sliderRef.current.getBoundingClientRect()
        setStartX(e.touches[0].clientX - sliderRect.left)
        setScrollLeft(sliderRef.current.scrollLeft)
        e.preventDefault()
    }

    const handleMouseLeave = () => {
        // No action
    }

    const handleStepClick = (index: number) => {
        changeStep(index)
    }

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault()

        if (!sliderRef.current) return

        const slider = sliderRef.current
        const itemWidth = STEP_ITEM_WIDTH

        const delta = e.deltaY > 0 ? 1 : -1
        const newIndex = Math.max(0, Math.min(steps.length - 1, currentStepIndex + delta))

        if (newIndex !== currentStepIndex) {
            setIsWheelScrolling(true)
            const targetScrollLeft = (newIndex * itemWidth) + (itemWidth / 2)
            slider.scrollTo({
                left: targetScrollLeft,
                behavior: 'auto'
            })
            changeStep(newIndex)
            setTimeout(() => {
                setIsWheelScrolling(false)
            }, 100)
        }
    }

    const getStepContent = (step: ExecStep): string => {
        const config = STEP_CONFIG[step.type]
        if (typeof config.label === 'function') {
            return config.label(step)
        }
        return config.label ?? '?'
    }

    const getStepColor = (step: ExecStep): string => {
        const config = STEP_CONFIG[step.type]
        if (typeof config.className === 'function') {
            return config.className(step)
        }
        return config.className ?? 'bg-gray-100'
    }

    const getStepTooltip = (step: ExecStep) => {
        if (!step) return ''
        return STEP_CONFIG[step.type]?.tooltip
    }

    const currentActualStepForTooltip = steps[currentStep?.index ?? 0]
    let astNodeDetailsTooltip = ''
    if (currentActualStepForTooltip && currentActualStepForTooltip.node) {
        const customNode = currentActualStepForTooltip.node as CustomNode
        if (customNode.category) {
            const categoryDetails = get(decorations, customNode.category)
            if (categoryDetails && typeof categoryDetails.tooltip === 'string') {
                astNodeDetailsTooltip = ` - ${categoryDetails.tooltip}`
            }
        }
    }

    return (
        <TooltipProvider>
            <div
                ref={containerRef}
                className='w-full relative flex items-end overflow-hidden pt-4'
                onWheel={handleWheel}
                style={{
                    scrollbarWidth: 'thin',
                    userSelect: 'none'
                }}
            >
                <div
                    ref={sliderRef}
                    className={cn(
                        'w-full flex overflow-x-auto',
                        isDragging ? 'cursor-grabbing' : 'cursor-grab'
                    )}
                    style={{
                        scrollBehavior: isDragging ? 'auto' : 'smooth',
                        msOverflowStyle: 'none',
                        scrollbarWidth: 'none'
                    }}
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                    onMouseLeave={handleMouseLeave}
                >
                    <div className="w-1/2 flex-shrink-0" />
                    {steps.map((step, index) => {
                        const isHighlighted = index === currentStepIndex
                        return (
                            <Tooltip key={step.index} open={isHighlighted}>
                                <TooltipTrigger asChild>
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`Step ${index + 1}: ${STEP_CONFIG[step.type]?.tooltip || step.type}`}
                                        onClick={() => handleStepClick(index)}
                                        onKeyDown={(e: React.KeyboardEvent) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                handleStepClick(index)
                                            }
                                        }}
                                        className={cn(
                                            'min-w-9 flex items-center justify-center border-t border-b transition-all duration-300 cursor-pointer mx-0.5 hover:opacity-100',
                                            getStepColor(step),
                                            {
                                                'border-2 border-blue-600': isHighlighted,
                                                'h-8 border-gray-300 opacity-70': !isHighlighted,
                                            }
                                        )}
                                    >
                                        <span className={cn(
                                            "font-semibold transition-all",
                                            isHighlighted ? 'text-lg' : 'text-sm'
                                        )}>
                                            {getStepContent(step)}
                                        </span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent
                                    side={isDesktop ? 'bottom' : 'top'}
                                    sideOffset={isDesktop ? 4 : 20}
                                    align={isDesktop ? 'center' : 'end'}
                                    className="bg-gray-900 text-white"
                                >
                                    <div className="text-center">
                                        <div className="text-xs opacity-90">
                                            {getStepTooltip(step)}
                                            {isHighlighted && astNodeDetailsTooltip}
                                        </div>
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        )
                    })}
                    <div className="flex-shrink-0" style={{ width: '50%' }} />
                </div>
                <div
                    className='absolute h-full -top-1 left-1/2 z-20 pointer-events-none'
                    style={{ transform: 'translateX(-50%)' }}
                >
                    <ChevronDownIcon className='w-5 h-5 text-blue-500' />
                </div>
                <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white to-transparent pointer-events-none z-10" />
                <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white to-transparent pointer-events-none z-10" />
            </div>
        </TooltipProvider >
    )
}

export default StepSlider