import React from 'react'

import { ScrollArea } from "@/components/ui/scroll-area"

import CHEAT_SHEET_DATA from './CheatSheetData.json'
import CheatSheetBox from './components/CheatSheetBox'

// Define the type for the cheat sheet data
type CheatSheetDataType = Record<string, string>

const CheatSheet = () => {
    // Get top-level categories (those without a slash in their key)
    const getTopLevelCategories = () => {
        return Object.keys(CHEAT_SHEET_DATA as CheatSheetDataType).filter(key => !key.includes('/'))
    }

    const topLevelCategories = getTopLevelCategories()

    return (
        <div className='flex h-full'>
            {topLevelCategories.map((category) => (
                <ScrollArea key={category} className="h-[calc(30vh)] w-full p-4">
                    <CheatSheetBox
                        title={(CHEAT_SHEET_DATA as CheatSheetDataType)[category]}
                        path={category}
                        data={CHEAT_SHEET_DATA as CheatSheetDataType}
                    />
                </ScrollArea>
            ))}
        </div>
    )
}

export default CheatSheet