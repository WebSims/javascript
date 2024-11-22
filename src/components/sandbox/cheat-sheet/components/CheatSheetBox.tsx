import React from 'react'
import CheatSheetItems from './CheatSheetItems'

export type CheatSheetItemType = {
    title: string
    items?: CheatSheetItemType[]
}

interface CheatSheetBoxProps {
    item: CheatSheetItemType
}

const CheatSheetBox: React.FC<CheatSheetBoxProps> = ({ item }) => {
    return (
        <>
            <h2 className="text-lg font-bold mb-2">{item.title}</h2>
            {item.items && <CheatSheetItems items={item.items} />}
        </>
    )
}

export default CheatSheetBox