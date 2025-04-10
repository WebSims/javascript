import React from 'react'
import CheatSheetItems from './CheatSheetItems'

export type CheatSheetItemType = {
    id: string
    title: string
    items?: CheatSheetItemType[]
    classN?: string
}

interface CheatSheetBoxProps {
    title: string
    path: string
    data: Record<string, string>
}

const CheatSheetBox: React.FC<CheatSheetBoxProps> = ({ title, path, data }) => {
    // Get all items that are descendants of this path
    const getDescendantItems = (parentPath: string): CheatSheetItemType[] => {
        const items: CheatSheetItemType[] = []

        // Get all keys that start with this path
        Object.keys(data).forEach(key => {
            // Skip the current path itself
            if (key === parentPath) return

            // Check if this is a direct child (one level deeper)
            const pathParts = key.split('/')
            const parentPathParts = parentPath.split('/')

            if (pathParts.length === parentPathParts.length + 1 &&
                key.startsWith(parentPath + '/')) {
                // This is a direct child
                const childPath = key
                const childTitle = data[key]

                // Check if this child has its own children
                const hasChildren = Object.keys(data).some(k =>
                    k.startsWith(childPath + '/'))

                const item: CheatSheetItemType = {
                    id: key.replace(/\//g, '-'),
                    title: childTitle
                }

                if (hasChildren) {
                    item.items = getDescendantItems(childPath)
                }

                items.push(item)
            }
        })

        return items
    }

    const items = getDescendantItems(path)

    return (
        <div className="h-full flex flex-col">
            <h2 className="text-lg font-bold mb-1">
                <span id={path} className="py-0.5 px-1.5 rounded-md inline-block">{title}</span>
            </h2>
            {items.length > 0 && (
                <div className="h-full overflow-y-auto pb-9">
                    <CheatSheetItems items={items} />
                </div>
            )}
        </div>
    )
}

export default CheatSheetBox