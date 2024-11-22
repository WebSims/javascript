import React from 'react'

import { CheatSheetItemType } from './CheatSheetBox'

interface CheatSheetItemsProps {
    items: CheatSheetItemType[]
}
const CheatSheetItems: React.FC<CheatSheetItemsProps> = ({ items }) => {
    return (
        <ul className="list-disc pl-5 space-y-1.5 text-slate-800">
            {items.map((item) => (
                <>
                    <li>
                        {item.title}
                    </li>
                    {item.items && <CheatSheetItems items={item.items} />}
                </>
            ))}
        </ul>
    )
}

export default CheatSheetItems