import React from 'react'

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import CheatSheet from './cheat-sheet/CheatSheet'

const CheatSheetAccordion: React.FC = () => {
    return (
        <Accordion type="single" defaultValue="cheat-sheet" collapsible >
            <AccordionItem value="cheat-sheet">
                <AccordionTrigger className="flex justify-center" />
                <AccordionContent className="p-0">
                    <CheatSheet />
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    )
}

export default CheatSheetAccordion