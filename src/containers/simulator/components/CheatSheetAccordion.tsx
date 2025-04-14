import React, { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

import CheatSheet from '@/components/simulator/cheat-sheet/CheatSheet'
import { Button } from '@/components/ui/button'
import { useSimulatorStore } from '@/hooks/useSimulatorStore'

interface CheatSheetAccordionProps {
    open?: boolean
    onOpenChange?: (isOpen: boolean) => void
}

const CheatSheetAccordion: React.FC<CheatSheetAccordionProps> = ({ open = true, onOpenChange }) => {
    const { cheatSheetRef } = useSimulatorStore()
    const [isOpen, setIsOpen] = useState<boolean>(open)

    const handleOpenChange = (value: boolean) => {
        setIsOpen(value)
        onOpenChange?.(value)
    }

    return (
        <div className='h-full w-full flex flex-col'>
            <div className='flex items-center relative h-12'>
                <h4 className="text-xl font-bold p-2">Cheat Sheet</h4>
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <Button
                        variant="link"
                        size="icon"
                        onClick={() => handleOpenChange(!isOpen)}
                        aria-label={isOpen ? "Collapse cheat sheet" : "Expand cheat sheet"}
                    >
                        {isOpen ? <ChevronUp className='scale-125' /> : <ChevronDown className='scale-125' />}
                    </Button>
                </div>
            </div>
            <div className={`h-[calc(100%-48px)] ${isOpen ? 'block' : 'hidden'}`}>
                <CheatSheet ref={cheatSheetRef} />
            </div>
        </div>
    )
}

export default CheatSheetAccordion