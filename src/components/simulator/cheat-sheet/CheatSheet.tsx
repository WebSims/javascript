import React, { forwardRef, ForwardedRef } from 'react'

import CHEAT_SHEET_DATA from './CheatSheetData.json'
import CheatSheetBox from './components/CheatSheetBox'

// Define the type for the cheat sheet data
type CheatSheetDataType = Record<string, string>

// Define props type extending div props without ref
type CheatSheetProps = React.ComponentPropsWithoutRef<'div'>

const CheatSheet = forwardRef<HTMLDivElement, CheatSheetProps>(({ ...props }, ref: ForwardedRef<HTMLDivElement>) => {
    // Get top-level categories (those without a slash in their key)
    const getTopLevelCategories = () => {
        return Object.keys(CHEAT_SHEET_DATA as CheatSheetDataType).filter(key => !key.includes('/'))
    }

    const topLevelCategories = getTopLevelCategories()

    return (
        <div className='flex h-full' ref={ref} {...props}>
            {topLevelCategories.map((category) => (
                <div key={category} className="h-full w-full px-3 pb-3">
                    <CheatSheetBox
                        title={(CHEAT_SHEET_DATA as CheatSheetDataType)[category]}
                        path={category}
                        data={CHEAT_SHEET_DATA as CheatSheetDataType}
                    />
                </div>
            ))}
        </div>
    )
})

// Add display name for better debugging
CheatSheet.displayName = 'CheatSheet'

export default CheatSheet