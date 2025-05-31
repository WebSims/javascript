import { createContext, useState, useEffect, useRef } from "react"
import { astOf } from "@/utils/ast"
import { cheatSheetHighlighter } from "@/utils/cheatSheetHighlighter"
import * as ts from "typescript"
import { ExecStep } from "@/types/simulation"
import { simulateExecution } from "@/utils/simulator"
import * as ESTree from 'estree'

// Represents a single scope's memory (e.g., global, function scope)
// Values can be primitives or references to other objects/arrays/functions

type SimulatorContextType = {
    mode: 'CODE' | 'EXECUTION'
    toggleMode: () => void
    files: Record<string, string>
    currentFile: string
    changeCurrentFile: (filename: string) => void
    updateFileContent: (filename: string, newContent: string) => void
    astOfCode: ESTree.Program | ts.SourceFile | null
    astError: string | null
    execSteps: ExecStep[]
    currentExecStep: ExecStep | null
    isPlaying: boolean
    togglePlaying: (state?: boolean) => void
    stepForward: () => void
    stepBackward: () => void
    changeStep: (index: number) => void
    resetSimulation: () => void
    totalSteps: number
    codeAreaRef: React.RefObject<HTMLDivElement>
    cheatSheetRef: React.RefObject<HTMLDivElement>
    setSpeed: (speed: number) => void
    highlightedId: string | null
    changeHighlightedId: (id: string) => void
    settings: Record<string, boolean>
}

const SimulatorContext = createContext<SimulatorContextType | undefined>(undefined)

export const SimulatorProvider = ({ children }: { children: React.ReactNode }) => {
    const [mode, setMode] = useState<'CODE' | 'EXECUTION'>('CODE')
    const [files, setFiles] = useState<Record<string, string>>({ "main.js": "" })
    const [currentFile, setCurrentFile] = useState("main.js")
    const [astOfCode, setAstOfCode] = useState<ESTree.Program | ts.SourceFile | null>(null)
    const [astError, setAstError] = useState<string | null>(null)
    const [execSteps, setExecSteps] = useState<ExecStep[]>([])
    const [currentExecStep, setCurrentExecStep] = useState<ExecStep | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [speed, setSpeed] = useState(2)
    const [highlightedId, setHighlightedId] = useState<string | null>(null)
    const [settings, setSettings] = useState<Record<string, boolean>>({
        autoSave: true,
    })

    const codeAreaRef = useRef<HTMLDivElement>(null)
    const cheatSheetRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const savedFilesString = localStorage.getItem('simulatorFiles')
        const savedFiles = JSON.parse(savedFilesString || '{}')
        const currentFile = Object.keys(savedFiles)[0] || "main.js"
        setFiles(savedFiles)
        setCurrentFile(currentFile)
        updateFileContent(currentFile, savedFiles[currentFile])
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        const cleanup = cheatSheetHighlighter(codeAreaRef, cheatSheetRef, setHighlightedId)
        return cleanup
    }, [astOfCode])

    const totalSteps = execSteps.length

    const updateFileContent = (filename: string, newContent: string) => {
        const newFiles = { ...files, [filename]: newContent }
        setFiles(newFiles)
        try {
            const ast = astOf(newFiles[filename])

            if (ast) {
                const steps = simulateExecution(ast)
                console.log(steps)
                setAstError(null)
                setAstOfCode(ast)
                setExecSteps(steps)
                setCurrentExecStep(steps[0] || null)
            }
        } catch (error) {
            console.log(11111, error)
            setAstError(error instanceof Error ? error.message : 'Unknown error')
        }
    }

    const toggleMode = () => {
        setMode(mode === 'CODE' ? 'EXECUTION' : 'CODE')
    }

    const togglePlaying = (state?: boolean) => {
        if (state !== undefined) {
            setIsPlaying(state)
        } else {
            setIsPlaying(!isPlaying)
        }
    }

    const stepForward = () => {
        const currentIndex = currentExecStep?.index ?? -1
        if (currentIndex < totalSteps - 1) {
            const nextIndex = currentIndex + 1
            setCurrentExecStep(execSteps[nextIndex])
        } else {
            setIsPlaying(false)
        }
    }

    const stepBackward = () => {
        const currentIndex = currentExecStep?.index ?? 0
        if (currentIndex > 0) {
            const prevIndex = currentIndex - 1
            setCurrentExecStep(execSteps[prevIndex])
        }
    }

    const changeStep = (index: number) => {
        if (index >= 0 && index < totalSteps) {
            setCurrentExecStep(execSteps[index])
        }
    }

    const resetSimulation = () => {
        setCurrentExecStep(execSteps[0] ?? null)
        togglePlaying(false)
    }

    useEffect(() => {
        let interval: NodeJS.Timeout | undefined

        if (isPlaying && totalSteps > 0) {
            interval = setInterval(() => {
                stepForward()
            }, 1000 / speed)
        } else {
            if (isPlaying) setIsPlaying(false)
        }

        return () => {
            if (interval) clearInterval(interval)
        }
    }, [isPlaying, speed, currentExecStep, totalSteps])

    const changeHighlightedId = (id: string) => {
        setHighlightedId(id)
    }

    const changeCurrentFile = (filename: string) => {
        setCurrentFile(filename)
    }

    return (
        <SimulatorContext.Provider
            value={{
                mode,
                toggleMode,
                files,
                currentFile,
                changeCurrentFile,
                updateFileContent,
                astOfCode,
                astError,
                execSteps,
                currentExecStep,
                isPlaying,
                togglePlaying,
                stepForward,
                stepBackward,
                changeStep,
                resetSimulation,
                totalSteps,
                codeAreaRef,
                cheatSheetRef,
                setSpeed,
                highlightedId,
                changeHighlightedId,
                settings,
            }}
        >
            {children}
        </SimulatorContext.Provider >
    )
}

export default SimulatorContext