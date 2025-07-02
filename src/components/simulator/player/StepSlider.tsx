import React, { useState, useRef, useCallback, useEffect } from 'react'
import { CustomNode, EXEC_STEP_TYPE, ExecStep, ExecStepType } from '@/types/simulator'
import { cn } from '@/lib/utils'
import { useSimulatorStore } from '@/hooks/useSimulatorStore'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import get from 'lodash/get'
import { decorations } from '../code-area/CodeArea'
import { useResponsive } from '@/hooks/useResponsive'

const STEP_ITEM_WIDTH = 40;

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
    const [isDragging, setIsDragging] = useState(false)
    const [knobPosition, setKnobPosition] = useState(0)
    const [tapeTranslate, setTapeTranslate] = useState(0)

    const handleStepClick = (index: number) => {
        changeStep(index)
    }

    useEffect(() => {
        if (!containerRef.current || !steps.length) return;

        const viewportWidth = containerRef.current.offsetWidth;
        const tapeWidth = steps.length * STEP_ITEM_WIDTH;

        const deadZoneStart = viewportWidth * 0.4;
        const deadZoneEnd = viewportWidth * 0.6;
        const deadZoneCenter = (deadZoneStart + deadZoneEnd) / 2;

        const idealKnobX = currentStepIndex * STEP_ITEM_WIDTH;
        let newTapeTranslate = tapeTranslate;

        if (tapeWidth > viewportWidth) {
            const idealTapeTranslate = deadZoneCenter - idealKnobX;
            const minTranslate = viewportWidth - tapeWidth;
            const maxTranslate = 0;
            newTapeTranslate = Math.max(minTranslate, Math.min(idealTapeTranslate, maxTranslate));
        }

        const newKnobPosition = idealKnobX + newTapeTranslate;

        setTapeTranslate(newTapeTranslate);
        setKnobPosition(newKnobPosition);

    }, [currentStepIndex, steps.length]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!containerRef.current) return;
        setIsDragging(true);
        e.preventDefault();
    }, []);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;

        const idealStep = (mouseX - tapeTranslate) / STEP_ITEM_WIDTH;
        const newIndex = Math.round(idealStep);
        const clampedIndex = Math.max(0, Math.min(steps.length - 1, newIndex));

        if (clampedIndex !== currentStepIndex) {
            changeStep(clampedIndex);
        }

    }, [isDragging, tapeTranslate, steps.length, changeStep, currentStepIndex]);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);


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

    const isHighlighted = (index: number) => index === currentStepIndex

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
                className='w-full relative flex items-end overflow-hidden pt-4 h-16'
                style={{
                    userSelect: 'none'
                }}
                onMouseDown={handleMouseDown}
            >
                <div
                    className='absolute top-8 flex items-center'
                    style={{
                        transform: `translateX(${tapeTranslate}px)`,
                        transition: isDragging ? 'none' : 'transform 0.2s ease-out'
                    }}
                >
                    {steps.map((step, index) => {
                        const highlighted = isHighlighted(index)
                        return (
                            <div
                                key={step.index}
                                role="button"
                                tabIndex={-1}
                                aria-label={`Step ${index + 1}: ${getStepTooltip(step)}`}
                                onClick={() => handleStepClick(index)}
                                className={cn(
                                    'min-w-10 flex items-center justify-center border-t border-b transition-all duration-300 cursor-pointer hover:opacity-100',
                                    getStepColor(step),
                                    {
                                        'border-2 border-blue-600': highlighted,
                                        'h-8 border-gray-300 opacity-70': !highlighted,
                                    }
                                )}
                            >
                                <span className={cn(
                                    "font-semibold transition-all",
                                    highlighted ? 'text-lg' : 'text-sm'
                                )}>
                                    {getStepContent(step)}
                                </span>
                            </div>
                        )
                    })}
                </div>

                <Tooltip open={isDragging || isHighlighted(currentStepIndex)}>
                    <TooltipTrigger asChild>
                        <div
                            className='absolute h-full top-0 z-20 cursor-grab'
                            style={{
                                left: `${knobPosition}px`,
                                transform: 'translateX(-50%)',
                                transition: isDragging ? 'none' : 'left 0.2s ease-out'
                            }}
                        >
                            <div
                                className='w-10 h-10 rounded-full flex items-center justify-center
                                           bg-blue-400/20 backdrop-blur-lg shadow-md
                                           border border-blue-300/30
                                           absolute top-1/2 -translate-y-1/2'
                            >
                                <span className='text-blue-900 font-bold'>
                                    {currentStepIndex + 1}
                                </span>
                            </div>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent
                        side={isDesktop ? 'bottom' : 'top'}
                        sideOffset={isDesktop ? 4 : 20}
                        align={'center'}
                        className="bg-gray-900 text-white"
                    >
                        <div className="text-center">
                            <div className="text-xs opacity-90">
                                {getStepTooltip(currentActualStepForTooltip)}
                                {astNodeDetailsTooltip}
                            </div>
                        </div>
                    </TooltipContent>
                </Tooltip>

                <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white to-transparent pointer-events-none z-10" />
                <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white to-transparent pointer-events-none z-10" />
            </div>
        </TooltipProvider >
    )
}

export default StepSlider