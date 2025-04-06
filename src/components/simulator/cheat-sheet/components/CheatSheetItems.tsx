import React from 'react'

import { CheatSheetItemType } from './CheatSheetBox'

interface CheatSheetItemsProps {
    items: CheatSheetItemType[]
}

const CheatSheetItems: React.FC<CheatSheetItemsProps> = ({ items }) => {
    return (
        <ul className="list-disc pl-5 space-y-1.5 text-slate-800">
            {items.map((item, index) => (
                <li key={index} className={item.classN}>
                    {item.title}
                    {item.items && item.items.length > 0 && (
                        <CheatSheetItems items={item.items} />
                    )}
                </li>
            ))}
        </ul>
    )
}

export default CheatSheetItems