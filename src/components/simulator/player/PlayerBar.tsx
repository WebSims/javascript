import React from 'react'
import { PlayIcon, PauseIcon, SkipBackIcon, SkipForwardIcon } from 'lucide-react'
import { useSimulatorStore } from '@/hooks/useSimulatorStore'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import StepSlider from './StepSlider'

const PlayerBar = () => {
    const {
        isPlaying,
        togglePlaying,
        stepForward,
        stepBackward,
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
        <div className="w-full flex flex-col lg:flex-row lg:items-center lg:px-3 overflow-hidden border-t lg:border-t-0 pb-1 lg:pb-0">
            <div className="flex items-center gap-1 lg:gap-3 justify-end">
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

            <div className='h-16 lg:h-12 w-full overflow-hidden'>
                <StepSlider />
            </div>
        </div>
    )
}

export default PlayerBar