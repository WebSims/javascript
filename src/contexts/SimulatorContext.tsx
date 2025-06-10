import { createContext, useState, useEffect, useRef } from "react"
import { astOf } from "@/utils/ast"
import { cheatSheetHighlighter } from "@/utils/cheatSheetHighlighter"
import * as ts from "typescript"
import { ExecStep } from "@/types/simulator"
import * as ESTree from 'estree'
import Simulator from "@/core/simulator"

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
    steps: ExecStep[]
    currentStep: ExecStep | null
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
    const [steps, setSteps] = useState<ExecStep[]>([])
    const [currentStep, setCurrentExecStep] = useState<ExecStep | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [speed, setSpeed] = useState(2)
    const [highlightedId, setHighlightedId] = useState<string | null>(null)
    const [settings] = useState<Record<string, boolean>>({
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

    const totalSteps = steps.length

    const updateFileContent = (filename: string, newContent: string) => {
        const newFiles = { ...files, [filename]: newContent }
        setFiles(newFiles)
        try {
            const ast = astOf(newFiles[filename])

            if (ast) {
                const simulator = new Simulator(ast)
                const steps = simulator.run()
                console.log(steps)
                setAstError(null)
                setAstOfCode(ast)
                setSteps(steps)
                setCurrentExecStep(steps[0] || null)
            }
        } catch (error) {
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
        const currentIndex = currentStep?.index ?? -1
        if (currentIndex < totalSteps - 1) {
            const nextIndex = currentIndex + 1
            setCurrentExecStep(steps[nextIndex])
        } else {
            setIsPlaying(false)
        }
    }

    const stepBackward = () => {
        const currentIndex = currentStep?.index ?? 0
        if (currentIndex > 0) {
            const prevIndex = currentIndex - 1
            setCurrentExecStep(steps[prevIndex])
        }
    }

    const changeStep = (index: number) => {
        if (index >= 0 && index < totalSteps) {
            setCurrentExecStep(steps[index])
        }
    }

    const resetSimulation = () => {
        setCurrentExecStep(steps[0] ?? null)
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
    }, [isPlaying, speed, currentStep, totalSteps])

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
                steps,
                currentStep,
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