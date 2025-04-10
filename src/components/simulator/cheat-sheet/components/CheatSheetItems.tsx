import React from 'react'

import { CheatSheetItemType } from './CheatSheetBox'

interface CheatSheetItemsProps {
    items: CheatSheetItemType[]
}

const CheatSheetItems: React.FC<CheatSheetItemsProps> = ({ items }) => {
    return (
        <ul className="list-disc pl-5 space-y-1.5 text-slate-800">
            {items.map((item) => (
                <li key={item.id}>
                    <span id={item.id} className="p-1 rounded-md inline-block">{item.title}</span>
                    {item.items && item.items.length > 0 && (
                        <CheatSheetItems items={item.items} />
                    )}
                </li>
            ))}
        </ul>
    )
}

export default CheatSheetItems