import React, { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

import CheatSheet from '@/components/simulator/cheat-sheet/CheatSheet'
import { Button } from '@/components/ui/button'

interface CheatSheetAccordionProps {
    open?: boolean
    onOpenChange?: (isOpen: boolean) => void
}

const CheatSheetAccordion: React.FC<CheatSheetAccordionProps> = ({ open = true, onOpenChange }) => {
    const [isOpen, setIsOpen] = useState<boolean>(open)

    const handleOpenChange = (value: boolean) => {
        setIsOpen(value)
        onOpenChange?.(value)
    }

    return (
        <div className='h-full w-full flex flex-col'>
            <Button
                variant="link"
                size="icon"
                onClick={() => handleOpenChange(!isOpen)}
                className="w-full flex items-center justify-center p-4"
            >
                {isOpen ? <ChevronUp className='scale-125' /> : <ChevronDown className='scale-125' />}
            </Button>
            {isOpen && <CheatSheet />}
        </div>
    )
}

export default CheatSheetAccordion