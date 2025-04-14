import React, { useState } from 'react'
import { ChevronDownIcon, ChevronUpIcon, BookOpenIcon } from 'lucide-react'

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
            <div className={`flex items-center justify-between px-3 ${isOpen ? 'py-2 border-b border-slate-100' : 'py-1 text-sm'}`}>
                <div className="flex items-center gap-2">
                    <BookOpenIcon className={`${isOpen ? 'h-5 w-5' : 'h-4 w-4'} text-muted-foreground`} />
                    <h4 className="font-semibold text-foreground">Cheat Sheet</h4>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenChange(!isOpen)}
                    aria-label={isOpen ? "Collapse cheat sheet" : "Expand cheat sheet"}
                    aria-expanded={isOpen}
                    className="h-6 w-6 hover:bg-accent/80 transition-colors"
                >
                    {isOpen ? (
                        <ChevronUpIcon className="transition-transform duration-200" />
                    ) : (
                        <ChevronDownIcon className="transition-transform duration-200" />
                    )}
                </Button>
            </div>
            <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'h-[calc(100%-48px)] opacity-100' : 'h-0 opacity-0'
                    }`}
            >
                <div className="h-full">
                    <CheatSheet ref={cheatSheetRef} />
                </div>
            </div>
        </div >
    )
}

export default CheatSheetAccordion