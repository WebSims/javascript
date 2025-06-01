import React, { useRef, useEffect, useCallback } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { EXEC_STEP_TYPE, ExecStep } from '@/types/simulation'
import { cn } from '@/lib/utils'
import { useSimulatorStore } from '@/hooks/useSimulatorStore'

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
    const activeTouchMoveHandler = useRef<((event: TouchEvent) => void) | null>(null)
    const activeTouchEndHandler = useRef<((event: TouchEvent) => void) | null>(null)

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
        let highlightedStepElement: HTMLElement | null = null
        if (currentExecStep && sliderRef.current && steps.length > 0) {
            const currentIdx = steps.findIndex(s => s.index === currentExecStep.index)
            if (currentIdx !== -1 && sliderRef.current.children[currentIdx]) {
                highlightedStepElement = sliderRef.current.children[currentIdx] as HTMLElement
            }
        }

        if (container && highlightedStepElement) {
            const containerRect = container.getBoundingClientRect()
            const stepRect = highlightedStepElement.getBoundingClientRect()

            const isFullyVisible =
                stepRect.left >= containerRect.left &&
                stepRect.right <= containerRect.right

            if (!isFullyVisible) {
                if (isDraggingRef.current) {
                    const SCROLL_NUDGE_PX = 20 // Fixed nudge amount for smoother scrolling during drag
                    if (stepRect.left < containerRect.left) {
                        container.scrollLeft -= SCROLL_NUDGE_PX
                    } else if (stepRect.right > containerRect.right) {
                        container.scrollLeft += SCROLL_NUDGE_PX
                    }
                } else {
                    highlightedStepElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
                }
            }
        }
    }, [currentExecStep, steps, containerRef, sliderRef, isDraggingRef])

    const handleStepInteraction = useCallback((clientX: number) => {
        if (!sliderRef.current || !containerRef.current || !steps || steps.length === 0) {
            return
        }

        const containerRect = containerRef.current.getBoundingClientRect()
        const clickXRelativeToContainer = clientX - containerRect.left
        const clickXOnSliderContent = containerRef.current.scrollLeft + clickXRelativeToContainer

        const stepElements = Array.from(sliderRef.current.children) as HTMLElement[]
        if (stepElements.length === 0) return

        let targetArrayIndex = -1

        // Try to find a direct hit
        for (let i = 0; i < stepElements.length; i++) {
            const stepElement = stepElements[i]
            const stepStart = stepElement.offsetLeft
            const stepEnd = stepStart + stepElement.offsetWidth
            if (clickXOnSliderContent >= stepStart && clickXOnSliderContent < stepEnd) {
                targetArrayIndex = i
                break
            }
        }

        // Handle cases where click is outside any specific step's bounds
        if (targetArrayIndex === -1) {
            if (clickXOnSliderContent < stepElements[0].offsetLeft && stepElements.length > 0) {
                targetArrayIndex = 0
            } else if (stepElements.length > 0 && clickXOnSliderContent >= stepElements[stepElements.length - 1].offsetLeft + stepElements[stepElements.length - 1].offsetWidth) {
                targetArrayIndex = stepElements.length - 1
            } else if (stepElements.length > 0) {
                // Fallback: find the closest element by midpoint if click is in a gap or unhandled region
                let closestIndex = 0
                let minDistance = Infinity
                for (let i = 0; i < stepElements.length; i++) {
                    const el = stepElements[i]
                    const midPoint = el.offsetLeft + el.offsetWidth / 2
                    const distance = Math.abs(clickXOnSliderContent - midPoint)
                    if (distance < minDistance) {
                        minDistance = distance
                        closestIndex = i
                    }
                }
                targetArrayIndex = closestIndex
            } else {
                // Should not happen if steps.length > 0 and stepElements.length > 0 checks passed
                return
            }
        }

        // Ensure targetArrayIndex is valid for the 'steps' array
        targetArrayIndex = Math.max(0, Math.min(targetArrayIndex, steps.length - 1))


        if (steps[targetArrayIndex]) { // Check if steps[targetArrayIndex] exists
            const targetStep = steps[targetArrayIndex]
            if (targetStep && targetStep.index !== currentExecStep?.index) {
                onChange(targetStep.index)
            }
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

    const handleTouchStartDraggable = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
        if (e.touches.length !== 1 || !sliderRef.current || !containerRef.current || !steps || steps.length === 0) {
            return
        }

        e.preventDefault() // Prevent default touch actions like scrolling page from starting here
        isDraggingRef.current = true
        // document.body.style.userSelect = 'none'; // Optional: container already has user-select: none

        handleStepInteraction(e.touches[0].clientX) // Initial interaction

        const handleTouchMoveLocal = (moveEvent: TouchEvent) => {
            if (!isDraggingRef.current || !containerRef.current || moveEvent.touches.length === 0) return

            moveEvent.preventDefault() // Crucial: Prevent page scrolling while dragging the slider

            const container = containerRef.current
            const containerRect = container.getBoundingClientRect()
            const touchX = moveEvent.touches[0].clientX
            let scrollDelta = 0

            if (touchX < containerRect.left) {
                const distance = containerRect.left - touchX
                scrollDelta = -distance * SCROLL_SENSITIVITY_FACTOR
            } else if (touchX > containerRect.right) {
                const distance = touchX - containerRect.right
                scrollDelta = distance * SCROLL_SENSITIVITY_FACTOR
            }

            if (scrollDelta !== 0) {
                container.scrollLeft += scrollDelta
            }
            handleStepInteraction(touchX) // Update step based on current touch position
        }

        const handleTouchEndLocal = (upEvent: TouchEvent) => {
            isDraggingRef.current = false
            // document.body.style.userSelect = ''; // Reset if it was set globally

            if (activeTouchMoveHandler.current) {
                window.removeEventListener('touchmove', activeTouchMoveHandler.current)
            }
            if (activeTouchEndHandler.current) { // activeTouchEndHandler.current points to this handleTouchEndLocal
                window.removeEventListener('touchend', activeTouchEndHandler.current)
                window.removeEventListener('touchcancel', activeTouchEndHandler.current)
            }
            activeTouchMoveHandler.current = null
            activeTouchEndHandler.current = null
        }

        activeTouchMoveHandler.current = handleTouchMoveLocal
        activeTouchEndHandler.current = handleTouchEndLocal
        window.addEventListener('touchmove', activeTouchMoveHandler.current, { passive: false }) // passive: false is important for preventDefault
        window.addEventListener('touchend', activeTouchEndHandler.current)
        window.addEventListener('touchcancel', activeTouchEndHandler.current) // Handle interruptions like system dialogs

    }, [handleStepInteraction, steps, containerRef, sliderRef, SCROLL_SENSITIVITY_FACTOR])

    useEffect(() => {
        // Capture the current handlers for the cleanup function.
        // This ensures the cleanup function uses the handlers from the effect's render cycle.
        const capturedMouseMoveHandler = activeMouseMoveHandler.current
        const capturedMouseUpHandler = activeMouseUpHandler.current
        const capturedTouchMoveHandler = activeTouchMoveHandler.current
        const capturedTouchEndHandler = activeTouchEndHandler.current

        return () => {
            // Cleanup mouse listeners
            if (capturedMouseMoveHandler) {
                window.removeEventListener('mousemove', capturedMouseMoveHandler)
            }
            if (capturedMouseUpHandler) {
                window.removeEventListener('mouseup', capturedMouseUpHandler)
            }
            // Cleanup touch listeners
            if (capturedTouchMoveHandler) {
                window.removeEventListener('touchmove', capturedTouchMoveHandler)
            }
            if (capturedTouchEndHandler) {
                window.removeEventListener('touchend', capturedTouchEndHandler)
                window.removeEventListener('touchcancel', capturedTouchEndHandler)
            }

            // If a drag was in progress when the component unmounted, reset body styles and dragging state.
            if (isDraggingRef.current) {
                document.body.style.cursor = '' // Reset mouse cursor
                // document.body.style.userSelect = ''; // Reset if globally set for touch
                isDraggingRef.current = false
            }
        }
    }, []) // Removed dependencies as we are capturing current refs, this effect runs once on mount and cleans up on unmount

    const currentStepArrayIndex = currentExecStep ? steps.findIndex(s => s.index === currentExecStep.index) : -1
    let chevronDisplayLeftPosition = 0

    if (currentStepArrayIndex !== -1 && sliderRef.current && sliderRef.current.children[currentStepArrayIndex]) {
        const currentStepElement = sliderRef.current.children[currentStepArrayIndex] as HTMLElement
        if (currentStepElement) { // Double check element exists
            const chevronIconWidth = 20 // ChevronDownIcon is w-5, which is 1.25rem or 20px
            chevronDisplayLeftPosition = currentStepElement.offsetLeft + (currentStepElement.offsetWidth / 2) - (chevronIconWidth / 2)
            chevronDisplayLeftPosition = Math.max(0, chevronDisplayLeftPosition) // Ensure it's not negative
        }
    }

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
                className='w-full flex'
                onMouseDown={handleMouseDownDraggable}
                onTouchStart={handleTouchStartDraggable}
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
                    left: chevronDisplayLeftPosition
                }}
            >
                <ChevronDownIcon className='w-5 h-5' />
            </div>
        </div>
    )
}

export default StepSlider 