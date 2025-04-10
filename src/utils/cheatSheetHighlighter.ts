import React from "react"

export const cheatSheetHighlighter = (
    codeAreaRef: React.RefObject<HTMLDivElement>,
    cheatSheetRef: React.RefObject<HTMLDivElement>
) => {
    if (!codeAreaRef.current || !cheatSheetRef.current) return () => { }

    const codeArea = codeAreaRef.current
    const cheatSheet = cheatSheetRef.current

    const highlightCheatSheetItem = (e: MouseEvent) => {
        const element = (e.target as HTMLElement)?.closest('[data-cheat-sheet-id]')
        if (!element) return

        const cheatSheetId = (element as HTMLElement).dataset.cheatSheetId
        if (!cheatSheetId) return

        const paths: string[] = []
        let currentPath = ''

        cheatSheetId.split('-').forEach((part: string) => {
            currentPath = currentPath ? `${currentPath}-${part}` : part
            paths.push(currentPath)
        })

        const lastPath = paths[paths.length - 1]

        paths.forEach(path => {
            const element = cheatSheet.querySelector(`#${path}`)
            if (!element) return

            element.classList.add('bg-red-300', 'transition-colors', 'duration-300')
            if (path === lastPath) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
        })
    }

    const unhighlightCheatSheetItem = () => {
        const highlightedElements = cheatSheet.querySelectorAll('.bg-red-300')
        highlightedElements.forEach((element) => {
            element.classList.remove('bg-red-300')
        })
    }

    codeArea.addEventListener('mouseover', highlightCheatSheetItem)
    codeArea.addEventListener('mouseout', unhighlightCheatSheetItem)

    return () => {
        codeArea.removeEventListener('mouseover', highlightCheatSheetItem)
        codeArea.removeEventListener('mouseout', unhighlightCheatSheetItem)
    }
} 