import React from 'react'
import { PlayIcon, PauseIcon, SkipBackIcon, SkipForwardIcon } from 'lucide-react'
import { Slider } from "@/components/ui/slider"
import { useSimulatorContext } from '@/hooks/useSimulatorContext'

const ExecutionBar = () => {
    const {
        isPlaying,
        togglePlaying,
        currentExecStep,
        stepForward,
        stepBackward,
        changeStep,
        totalSteps
    } = useSimulatorContext()

    return (
        <div className="h-12 bg-gray-100 px-4 flex items-center gap-4 shadow-sm">
            <div className="flex items-center gap-2">
                <button
                    onClick={stepBackward}
                    className="p-1.5 rounded-full hover:bg-gray-200 transition-colors"
                >
                    <SkipBackIcon size={18} />
                </button>

                <button
                    onClick={() => togglePlaying()}
                    className="p-1.5 rounded-full hover:bg-gray-200 transition-colors"
                >
                    {isPlaying ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
                </button>

                <button
                    onClick={stepForward}
                    className="p-1.5 rounded-full hover:bg-gray-200 transition-colors"
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
        </div>
    )
}

export default ExecutionBar