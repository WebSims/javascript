import React from 'react'
import { PlayIcon, PauseIcon, SkipBackIcon, SkipForwardIcon, RotateCcwIcon } from 'lucide-react'
import { Slider } from "@/components/ui/slider"
import { useSimulatorStore } from '@/hooks/useSimulatorStore'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const ExecutionBar = () => {
    const {
        isPlaying,
        togglePlaying,
        currentExecStep,
        stepForward,
        stepBackward,
        changeStep,
        resetSimulation,
        totalSteps
    } = useSimulatorStore()

    const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            action()
        }
    }

    const handleTogglePlaying = () => {
        togglePlaying()
    }

    return (
        <div className="h-12 bg-white border-b border-slate-200 px-3 flex items-center gap-6">
            <div className="flex items-center gap-3">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={handleTogglePlaying}
                                onKeyDown={(e) => handleKeyDown(e, handleTogglePlaying)}
                                className="p-2 rounded-full hover:bg-gray-100"
                                aria-label={isPlaying ? "Pause simulation" : "Play simulation"}
                                tabIndex={0}
                            >
                                {isPlaying ? <PauseIcon size={20} className="text-gray-700" /> : <PlayIcon size={20} className="text-gray-700" />}
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{isPlaying ? "Pause" : "Play"}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={stepBackward}
                                onKeyDown={(e) => handleKeyDown(e, stepBackward)}
                                className="p-2 rounded-full hover:bg-gray-100"
                                aria-label="Step backward"
                                tabIndex={0}
                            >
                                <SkipBackIcon size={20} className="text-gray-700" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Step backward</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={stepForward}
                                onKeyDown={(e) => handleKeyDown(e, stepForward)}
                                className="p-2 rounded-full hover:bg-gray-100"
                                aria-label="Step forward"
                                tabIndex={0}
                            >
                                <SkipForwardIcon size={20} className="text-gray-700" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Step forward</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            <div className="flex-1 flex items-center gap-4">
                <Slider
                    value={[currentExecStep?.index ?? 0]}
                    min={0}
                    max={totalSteps - 1}
                    step={1}
                    onValueChange={(value) => changeStep(value[0])}
                    className="flex-1"
                />
                <div className="text-sm text-gray-600 text-right">
                    <span className="font-medium">{(currentExecStep?.index ?? 0) + 1}</span>
                    <span className="text-gray-400"> / {totalSteps}</span>
                </div>
            </div>

            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={resetSimulation}
                            onKeyDown={(e) => handleKeyDown(e, resetSimulation)}
                            className="p-2 rounded-full hover:bg-gray-100"
                            aria-label="Reset simulation"
                            tabIndex={0}
                        >
                            <RotateCcwIcon size={20} className="text-gray-700" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Reset simulation</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    )
}

export default ExecutionBar