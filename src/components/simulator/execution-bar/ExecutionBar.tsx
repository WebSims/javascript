import React from 'react'
import { PlayIcon, PauseIcon, SkipBackIcon, SkipForwardIcon, RotateCcwIcon } from 'lucide-react'
import { Slider } from "@/components/ui/slider"
import { useSimulatorStore } from '@/hooks/useSimulatorStore'

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

    return (
        <div className="h-12 bg-gray-100 px-4 flex items-center gap-4 shadow-sm">
            <div className="flex items-center gap-2">
                <button
                    onClick={() => togglePlaying()}
                    className="p-1.5 rounded-full hover:bg-gray-200 transition-colors"
                    aria-label="Play or pause"
                >
                    {isPlaying ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
                </button>

                <button
                    onClick={stepBackward}
                    className="p-1.5 rounded-full hover:bg-gray-200 transition-colors"
                    aria-label="Step backward"
                >
                    <SkipBackIcon size={18} />
                </button>

                <button
                    onClick={stepForward}
                    className="p-1.5 rounded-full hover:bg-gray-200 transition-colors"
                    aria-label="Step forward"
                >
                    <SkipForwardIcon size={18} />
                </button>
            </div>

            <div className="flex-1">
                <Slider
                    value={[currentExecStep?.index ?? 0]}
                    min={0}
                    max={totalSteps - 1}
                    step={1}
                    onValueChange={(value) => changeStep(value[0])}
                />
            </div>

            <div className="text-sm text-gray-600 min-w-[60px]">
                {(currentExecStep?.index ?? 0) + 1} / {totalSteps}
            </div>

            <button
                onClick={resetSimulation}
                className="p-1.5 rounded-full hover:bg-gray-200 transition-colors"
                aria-label="Reset simulation"
            >
                <RotateCcwIcon size={18} />
            </button>
        </div>
    )
}

export default ExecutionBar