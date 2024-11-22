import React from 'react'

import { ScrollArea } from "@/components/ui/scroll-area"

import CHEAT_SHEET_DATA from './CheatSheetData.json'
import CheatSheetBox from './components/CheatSheetBox'

const CheatSheet = () => {
    return (
        <div className='flex h-full'>
            {CHEAT_SHEET_DATA.map((item, index) => (
                <ScrollArea className="h-[calc(30vh)] w-full p-4">
                    <CheatSheetBox key={index} item={item} />
                </ScrollArea>
            ))}
        </div>
    )
}

export default CheatSheet