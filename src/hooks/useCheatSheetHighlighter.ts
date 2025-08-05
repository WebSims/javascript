import { useEffect, useRef } from "react"

type UseCheatSheetHighlighterProps = {
    onHighlight?: (id: string) => void
    enabled?: boolean
}

export const useCheatSheetHighlighter = ({
    onHighlight,
    enabled = true
}: UseCheatSheetHighlighterProps = {}) => {
    const codeAreaRef = useRef<HTMLDivElement>(null)
    const cheatSheetRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!enabled) return

        // Add a small delay to ensure elements are properly mounted
        const timeoutId = setTimeout(() => {
            const codeArea = codeAreaRef.current
            const cheatSheet = cheatSheetRef.current

            if (!codeArea || !cheatSheet) return

            const highlightCheatSheetItem = (e: MouseEvent | TouchEvent) => {
                const element = (e.target as HTMLElement)?.closest('[data-cheat-sheet-id]')
                if (!element) return

                const cheatSheetId = (element as HTMLElement).dataset.cheatSheetId
                if (!cheatSheetId) return
                if (onHighlight) onHighlight(cheatSheetId)

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

                    element.classList.add('cheat-sheet-item', 'highlighted')
                    if (path === lastPath) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }
                })
            }

            const unhighlightCheatSheetItem = () => {
                const highlightedElements = cheatSheet.querySelectorAll('.highlighted')
                highlightedElements.forEach((element) => {
                    element.classList.remove('highlighted')
                })
            }

            // Mouse events for desktop
            codeArea.addEventListener('mouseover', highlightCheatSheetItem)
            codeArea.addEventListener('mouseout', unhighlightCheatSheetItem)

            return () => {
                codeArea.removeEventListener('mouseover', highlightCheatSheetItem)
                codeArea.removeEventListener('mouseout', unhighlightCheatSheetItem)
            }
        }, 100)

        return () => {
            clearTimeout(timeoutId)
        }
    }, [enabled, onHighlight])

    return {
        codeAreaRef,
        cheatSheetRef
    }
} 