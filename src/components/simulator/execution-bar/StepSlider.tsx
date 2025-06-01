import React, { useRef, useEffect, useCallback } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { EXEC_STEP_TYPE, ExecStep } from '@/types/simulation'
import { cn } from '@/lib/utils'
import { useSimulatorStore } from '@/hooks/useSimulatorStore'

const STEP_WIDTH = 20 // Assumed step width in pixels (from min-w-5 = 1.25rem)
const SCROLL_SENSITIVITY_FACTOR = 0.15 // Determines how fast scrolling accelerates with mouse distance

interface StepSliderProps {
    steps: ExecStep[]
    currentStepIndex: number
    onChange: (index: number) => void
}

const StepSlider = ({ steps, onChange }: StepSliderProps) => {
    const { currentExecStep } = useSimulatorStore()

    const containerRef = useRef<HTMLDivElement>(null)
    const sliderRef = useRef<HTMLDivElement>(null)
    const isDraggingRef = useRef(false)
    const activeMouseMoveHandler = useRef<((event: MouseEvent) => void) | null>(null)
    const activeMouseUpHandler = useRef<((event: MouseEvent) => void) | null>(null)

    const getStepContent = (step: ExecStep) => {
        switch (step.type) {
            case EXEC_STEP_TYPE.INITIAL:
                return ''
            case EXEC_STEP_TYPE.PUSH_SCOPE:
                return '{'
            case EXEC_STEP_TYPE.HOISTING:
                return 'H'
            case EXEC_STEP_TYPE.POP_SCOPE:
                return '}'
            case EXEC_STEP_TYPE.EXECUTING:
                return 'S'
            case EXEC_STEP_TYPE.EXECUTED:
                return ';'
            case EXEC_STEP_TYPE.EVALUATING:
                return '('
            case EXEC_STEP_TYPE.EVALUATED:
                return ')'
            case EXEC_STEP_TYPE.FUNCTION_CALL:
                return 'F'
            default:
                return '?'
        }
    }

    const getStepColor = (step: ExecStep) => {
        switch (step.type) {
            case EXEC_STEP_TYPE.INITIAL:
                return 'bg-white'
            case EXEC_STEP_TYPE.HOISTING:
                return 'bg-orange-200'
            case EXEC_STEP_TYPE.EXECUTING:
                return 'bg-yellow-200'
            case EXEC_STEP_TYPE.PUSH_SCOPE:
            case EXEC_STEP_TYPE.POP_SCOPE:
                return 'bg-blue-100'
            case EXEC_STEP_TYPE.EVALUATING:
            case EXEC_STEP_TYPE.EVALUATED:
                return 'bg-green-100'
            default:
                return 'bg-gray-100'
        }
    }

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const onWheel = (e: WheelEvent) => {
            e.preventDefault()
            container.scrollLeft += e.deltaY;
        };

        container.addEventListener('wheel', onWheel);
        return () => container.removeEventListener('wheel', onWheel);
    }, [])

    useEffect(() => {
        const container = containerRef.current
        const highlightedStepElement = sliderRef.current?.querySelector<HTMLElement>('[data-highlighted="true"]');

        if (container && highlightedStepElement) {
            const containerRect = container.getBoundingClientRect()
            const stepRect = highlightedStepElement.getBoundingClientRect()

            const isFullyVisible =
                stepRect.left >= containerRect.left &&
                stepRect.right <= containerRect.right

            if (!isFullyVisible) {
                if (isDraggingRef.current) {
                    if (stepRect.left < containerRect.left) {
                        container.scrollLeft -= STEP_WIDTH
                    } else if (stepRect.right > containerRect.right) {
                        container.scrollLeft += STEP_WIDTH
                    }
                } else {
                    highlightedStepElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
                }
            }
        }
    }, [currentExecStep])

    const handleStepInteraction = useCallback((clientX: number) => {
        if (!sliderRef.current || !containerRef.current || !steps || steps.length === 0) {
            return
        }

        const containerRect = containerRef.current.getBoundingClientRect()
        const clickXRelativeToContainer = clientX - containerRect.left
        const clickXOnSliderContent = containerRef.current.scrollLeft + clickXRelativeToContainer

        let targetArrayIndex = Math.floor(clickXOnSliderContent / STEP_WIDTH)
        targetArrayIndex = Math.max(0, Math.min(targetArrayIndex, steps.length - 1))

        const targetStep = steps[targetArrayIndex]
        if (targetStep && targetStep.index !== currentExecStep?.index) {
            onChange(targetStep.index)
        }
    }, [steps, currentExecStep, onChange, containerRef, sliderRef])

    const handleMouseDownDraggable = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button !== 0 || !sliderRef.current || !containerRef.current || !steps || steps.length === 0) {
            return
        }

        e.preventDefault()
        isDraggingRef.current = true
        document.body.style.cursor = 'grabbing'

        handleStepInteraction(e.clientX)

        const mouseDownButton = e.button

        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (!isDraggingRef.current || !containerRef.current) return

            const container = containerRef.current
            const containerRect = container.getBoundingClientRect()
            const mouseX = moveEvent.clientX

            let scrollDelta = 0

            if (mouseX < containerRect.left) {
                const distance = containerRect.left - mouseX
                scrollDelta = -distance * SCROLL_SENSITIVITY_FACTOR
            } else if (mouseX > containerRect.right) {
                const distance = mouseX - containerRect.right
                scrollDelta = distance * SCROLL_SENSITIVITY_FACTOR
            }

            if (scrollDelta !== 0) {
                container.scrollLeft += scrollDelta
            }

            handleStepInteraction(moveEvent.clientX)
        }

        const handleMouseUp = (upEvent: MouseEvent) => {
            if (upEvent.button !== mouseDownButton) return

            isDraggingRef.current = false
            document.body.style.cursor = ''
            if (activeMouseMoveHandler.current) {
                window.removeEventListener('mousemove', activeMouseMoveHandler.current)
            }
            if (activeMouseUpHandler.current) {
                window.removeEventListener('mouseup', activeMouseUpHandler.current)
            }
            activeMouseMoveHandler.current = null
            activeMouseUpHandler.current = null
        }

        activeMouseMoveHandler.current = handleMouseMove
        activeMouseUpHandler.current = handleMouseUp
        window.addEventListener('mousemove', activeMouseMoveHandler.current)
        window.addEventListener('mouseup', activeMouseUpHandler.current)

    }, [handleStepInteraction, steps, containerRef, sliderRef])

    useEffect(() => {
        return () => {
            if (isDraggingRef.current) {
                if (activeMouseMoveHandler.current) {
                    window.removeEventListener('mousemove', activeMouseMoveHandler.current)
                }
                if (activeMouseUpHandler.current) {
                    window.removeEventListener('mouseup', activeMouseUpHandler.current)
                }
                document.body.style.cursor = ''
                isDraggingRef.current = false
            }
        }
    }, [])

    const currentStepArrayIndex = currentExecStep ? steps.findIndex(s => s.index === currentExecStep.index) : -1
    const chevronLeftPosition = currentStepArrayIndex !== -1 ? currentStepArrayIndex * STEP_WIDTH : 0

    return (
        <div
            ref={containerRef}
            className='h-12 w-full relative flex items-end overflow-x-auto'
            style={{
                scrollbarWidth: 'thin',
                userSelect: 'none'
            }}
        >
            <div
                ref={sliderRef}
                className='flex'
                onMouseDown={handleMouseDownDraggable}
            >
                {steps.map((step) => {
                    return (
                        <div
                            key={step.index}
                            data-highlighted={step.index === currentExecStep?.index}
                            className={
                                cn(
                                    'min-w-5 flex-1 flex items-center justify-center border-t border-b border-gray-300',
                                    step.index === currentExecStep?.index ? 'border-2 border-blue-500' : '',
                                    getStepColor(step),
                                )
                            }
                        >
                            <span className="font-semibold">{getStepContent(step)}</span>
                        </div>
                    )
                })}
            </div>

            <div
                className='absolute h-full -top-1 z-20'
                style={{
                    left: chevronLeftPosition
                }}
            >
                <ChevronDownIcon className='w-5 h-5' />
            </div>
        </div>
    )
}

export default StepSlider 