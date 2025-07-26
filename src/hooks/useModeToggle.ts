import { useSearchParams } from 'react-router'

export const useModeToggle = () => {
    const [searchParams, setSearchParams] = useSearchParams()

    const toggleMode = () => {
        const newSearchParams = new URLSearchParams(searchParams)
        const currentMode = searchParams.get('mode')

        if (currentMode === 'run') {
            newSearchParams.delete('mode')
        } else {
            newSearchParams.set('mode', 'run')
        }

        setSearchParams(newSearchParams, { replace: true })
    }

    const currentMode: 'CODE' | 'RUN' = searchParams.get('mode') === 'run' ? 'RUN' : 'CODE'

    return {
        toggleMode,
        currentMode
    }
} 