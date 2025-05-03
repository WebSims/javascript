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
                <div key={category} className="h-full w-full flex flex-col px-3 pb-3">
                    <div>
                        <span
                            id={category}
                            className="inline-block rounded-md font-semibold px-1.5 py-0.5 text-gray-900"
                        >
                            {(CHEAT_SHEET_DATA as CheatSheetDataType)[category]}
                        </span>
                    </div>
                    <CheatSheetBox
                        path={category}
                        data={CHEAT_SHEET_DATA as CheatSheetDataType}
                    />
                </div>
            ))}
        </div>
    )
})

export default CheatSheet