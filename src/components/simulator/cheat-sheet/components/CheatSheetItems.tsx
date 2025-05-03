import React from 'react'

import { CheatSheetItemType } from './CheatSheetBox'

interface CheatSheetItemsProps {
    items: CheatSheetItemType[]
}

const CheatSheetItems: React.FC<CheatSheetItemsProps> = ({ items }) => {
    return (
        <ul className="list-disc pl-5 text-slate-800">
            {items.map((item) => (
                <li key={item.id} className="cheat-sheet-item space-y-1">
                    <span
                        id={item.id}
                        className="py-0.5 px-1.5 rounded-md inline-block"
                    >
                        {item.title}
                    </span>
                    {item.items && item.items.length > 0 && (
                        <CheatSheetItems items={item.items} />
                    )}
                </li>
            ))}
        </ul>
    )
}

export default CheatSheetItems