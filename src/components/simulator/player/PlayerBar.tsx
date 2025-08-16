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
        astError,
        currentStep,
    } = useSimulatorStore()

    // Disable player controls when there's an AST error or no current step
    const isDisabled = Boolean(astError) || !currentStep

    const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            action()
        }
    }

    const handleTogglePlaying = () => {
        if (!isDisabled) {
            togglePlaying()
        }
    }

    return (
        <div className="w-full flex flex-col-reverse lg:relative border-t border-slate-200 px-2.5 py-2 lg:py-0 lg:px-2.5 bg-slate-50">
            <div className="lg:absolute z-30 top-4 flex items-center gap-2 justify-start px-1.5 lg:px-0">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={handleTogglePlaying}
                                onKeyDown={(e) => handleKeyDown(e, handleTogglePlaying)}
                                className={`p-1 lg:p-2 rounded-full ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
                                aria-label={isPlaying ? "Pause simulation" : "Play simulation"}
                                tabIndex={0}
                                disabled={isDisabled}
                            >
                                {isPlaying ? <PauseIcon size={20} className="text-gray-700" /> : <PlayIcon size={20} className="text-gray-700" />}
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{isDisabled ? "Fix syntax error to enable" : (isPlaying ? "Pause" : "Play")}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() => !isDisabled && stepBackward()}
                                onKeyDown={(e) => handleKeyDown(e, () => !isDisabled && stepBackward())}
                                className={`p-1 lg:p-2 rounded-full ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
                                aria-label="Step backward"
                                tabIndex={0}
                                disabled={isDisabled}
                            >
                                <SkipBackIcon size={20} className="text-gray-700" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{isDisabled ? "Fix syntax error to enable" : "Step backward"}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() => !isDisabled && stepForward()}
                                onKeyDown={(e) => handleKeyDown(e, () => !isDisabled && stepForward())}
                                className={`p-1 lg:p-2 rounded-full ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
                                aria-label="Step forward"
                                tabIndex={0}
                                disabled={isDisabled}
                            >
                                <SkipForwardIcon size={20} className="text-gray-700" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{isDisabled ? "Fix syntax error to enable" : "Step forward"}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            <div className='w-full px-1 lg:px-2'>
                <StepSlider />
            </div>
        </div>
    )
}

export default PlayerBar