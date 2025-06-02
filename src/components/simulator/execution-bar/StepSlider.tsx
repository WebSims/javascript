import React, { useRef, useEffect, useState, useCallback } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { EXEC_STEP_TYPE, ExecStep, ExecStepType } from '@/types/simulation'
import { cn } from '@/lib/utils'

interface StepSliderProps {
    steps: ExecStep[]
    currentStepIndex: number
    onChange: (index: number) => void
}

const STEP_ITEM_WIDTH = 44 // 40px min-width + 4px margins (2px each side)

const STEP_CONTENT_MAP: Record<ExecStepType, string | ((step: ExecStep) => string)> = {
    [EXEC_STEP_TYPE.INITIAL]: '',
    [EXEC_STEP_TYPE.PUSH_SCOPE]: (step: ExecStep) => {
        if (step.memoryChange?.type === 'push_scope' && step.memoryChange.kind === 'program') {
            return ''
        }
        return '{'
    },
    [EXEC_STEP_TYPE.HOISTING]: 'H',
    [EXEC_STEP_TYPE.POP_SCOPE]: '}',
    [EXEC_STEP_TYPE.EXECUTING]: 'S',
    [EXEC_STEP_TYPE.EXECUTED]: ';',
    [EXEC_STEP_TYPE.EVALUATING]: '(',
    [EXEC_STEP_TYPE.EVALUATED]: ')',
    [EXEC_STEP_TYPE.FUNCTION_CALL]: 'F',
}

const STEP_COLOR_MAP: Record<ExecStepType, string | ((step: ExecStep) => string)> = {
    [EXEC_STEP_TYPE.INITIAL]: 'bg-white',
    [EXEC_STEP_TYPE.HOISTING]: 'bg-orange-200',
    [EXEC_STEP_TYPE.EXECUTING]: 'bg-yellow-200',
    [EXEC_STEP_TYPE.EXECUTED]: 'bg-yellow-200',
    [EXEC_STEP_TYPE.PUSH_SCOPE]: (step: ExecStep) => {
        if (step.memoryChange?.type === 'push_scope' && step.memoryChange.kind === 'function') {
            return 'bg-blue-100'
        }
        return 'bg-gray-100'
    },
    [EXEC_STEP_TYPE.POP_SCOPE]: (step: ExecStep) => {
        if (step.memoryChange?.type === 'pop_scope' && step.memoryChange.kind === 'function') {
            return 'bg-blue-100'
        }
        return 'bg-gray-100'
    },
    [EXEC_STEP_TYPE.EVALUATING]: 'bg-green-100',
    [EXEC_STEP_TYPE.EVALUATED]: 'bg-green-100',
    [EXEC_STEP_TYPE.FUNCTION_CALL]: 'bg-purple-100',
}

const StepSlider = ({ steps, currentStepIndex, onChange }: StepSliderProps) => {
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
            onChange(newCenterStep)
        }
    }, [isDragging, startX, scrollLeft, currentStepIndex, onChange, calculateCenterStep])

    const handleDocumentMouseUp = useCallback(() => {
        if (!isDragging) return

        setIsDragging(false)

        const finalCenterStep = calculateCenterStep()
        if (finalCenterStep !== currentStepIndex) {
            onChange(finalCenterStep)
        }
    }, [isDragging, currentStepIndex, onChange, calculateCenterStep])

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleDocumentMouseMove)
            document.addEventListener('mouseup', handleDocumentMouseUp)
            document.body.style.userSelect = 'none'
        } else {
            document.removeEventListener('mousemove', handleDocumentMouseMove)
            document.removeEventListener('mouseup', handleDocumentMouseUp)
            document.body.style.userSelect = ''
        }

        return () => {
            document.removeEventListener('mousemove', handleDocumentMouseMove)
            document.removeEventListener('mouseup', handleDocumentMouseUp)
            document.body.style.userSelect = ''
        }
    }, [isDragging, handleDocumentMouseMove, handleDocumentMouseUp])

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!sliderRef.current) return

        setIsDragging(true)
        const sliderRect = sliderRef.current.getBoundingClientRect()
        setStartX(e.clientX - sliderRect.left)
        setScrollLeft(sliderRef.current.scrollLeft)
        e.preventDefault()
    }

    const handleMouseLeave = () => {
        // No action
    }

    const handleStepClick = (index: number) => {
        onChange(index)
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
            onChange(newIndex)
            setTimeout(() => {
                setIsWheelScrolling(false)
            }, 100)
        }
    }

    const getStepContent = (step: ExecStep): string => {
        const contentOrFn = STEP_CONTENT_MAP[step.type]
        if (typeof contentOrFn === 'function') {
            return contentOrFn(step)
        }
        return contentOrFn ?? '?'
    }

    const getStepColor = (step: ExecStep): string => {
        const colorOrFn = STEP_COLOR_MAP[step.type]
        if (typeof colorOrFn === 'function') {
            return colorOrFn(step)
        }
        return colorOrFn ?? 'bg-gray-100'
    }

    return (
        <div
            ref={containerRef}
            className='h-12 w-full relative flex items-end overflow-hidden'
            onWheel={handleWheel}
            style={{
                scrollbarWidth: 'thin',
                userSelect: 'none'
            }}
        >
            <div
                ref={sliderRef}
                className={cn(
                    'w-full flex overflow-x-auto scrollbar-hide',
                    isDragging ? 'cursor-grabbing' : 'cursor-grab'
                )}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeave}
                style={{
                    scrollBehavior: isDragging ? 'auto' : 'smooth',
                    msOverflowStyle: 'none',
                    scrollbarWidth: 'none'
                }}
            >
                <div className="flex-shrink-0" style={{ width: '50%' }} />
                {steps.map((step, index) => {
                    const isHighlighted = index === currentStepIndex
                    return (
                        <div
                            key={step.index}
                            role="button"
                            tabIndex={0}
                            aria-label={`Step ${index + 1}: ${step.type}`}
                            onClick={() => handleStepClick(index)}
                            onKeyDown={(e: React.KeyboardEvent) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    handleStepClick(index)
                                }
                            }}
                            className={cn(
                                'min-w-[40px] flex-shrink-0 flex items-center justify-center border-t border-b transition-all duration-300 cursor-pointer mx-0.5 hover:opacity-100',
                                getStepColor(step),
                                {
                                    'border-2 border-blue-600 h-full z-10': isHighlighted,
                                    'border-gray-300 h-10 opacity-70': !isHighlighted,
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
    )
}

export default StepSlider