import { useHotkeys } from 'react-hotkeys-hook'

export type UseSimulatorHotkeysProps = {
    files: Record<string, string>
    activeFile: string
    mode: string
    toggleMode: () => void
    exampleId?: string
    navigate: (path: string, options?: { replace?: boolean }) => void
}

const useSimulatorHotkeys = ({ files, activeFile, mode, toggleMode, exampleId, navigate }: UseSimulatorHotkeysProps) => {
    useHotkeys(
        'mod+s',
        (event) => {
            event.preventDefault()
            if (files && Object.keys(files).length > 0) {
                localStorage.setItem('simulatorFiles', JSON.stringify(files))
                console.log('Files saved to localStorage!')
                window.dispatchEvent(new CustomEvent('filesaved', {
                    detail: { file: activeFile }
                }))
                if (exampleId) {
                    navigate('/', { replace: true })
                }
            }
        },
        { preventDefault: true },
        [files, activeFile]
    )

    useHotkeys(
        'mod+shift+r',
        (event) => {
            event.preventDefault()
            if (mode !== 'EXECUTION') {
                toggleMode()
            }
        },
        { preventDefault: true },
        [mode, toggleMode]
    )

    useHotkeys(
        'mod+shift+e',
        (event) => {
            event.preventDefault()
            if (mode !== 'CODE') {
                toggleMode()
            }
        },
        { preventDefault: true },
        [mode, toggleMode]
    )
}

export default useSimulatorHotkeys 