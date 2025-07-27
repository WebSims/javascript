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
    mode: 'CODE' | 'RUN'
    files: Record<string, string>
    activeFile: string
    changeCurrentFile: (filename: string) => void
    updateFileContent: (filename: string, newContent: string) => void
    setFiles: (files: Record<string, string>) => void
    initializeFiles: (files: Record<string, string>) => void
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

export const SimulatorProvider = ({
    children,
    mode
}: {
    children: React.ReactNode
    mode: 'CODE' | 'RUN'
}) => {
    const [files, setFiles] = useState<Record<string, string>>({ "main.js": "" })
    const [activeFile, setActiveFile] = useState("main.js")
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
        const cleanup = cheatSheetHighlighter(codeAreaRef, cheatSheetRef, setHighlightedId)
        return cleanup
    }, [astOfCode])

    const totalSteps = steps.length

    const parseAndSetAst = (code: string) => {
        try {
            const ast = astOf(code)
            if (ast) {
                setAstError(null)
                setAstOfCode(ast)
                if (mode === 'RUN') {
                    runSimulator(ast)
                }
            }
        } catch (error) {
            setAstError(error instanceof Error ? error.message : 'Unknown error')
        }
    }

    const initializeFiles = (files: Record<string, string>) => {
        setFiles(files)
        const fileNames = Object.keys(files)
        const mainFile = fileNames.find(filename => filename.includes('main.js')) || fileNames[0]
        setActiveFile(mainFile)
        parseAndSetAst(files[mainFile])
    }

    const updateFileContent = (filename: string, newContent: string) => {
        const newFiles = { ...files, [filename]: newContent }
        setFiles(newFiles)
        parseAndSetAst(newContent)
    }

    const runSimulator = (astOfCode: ESTree.Program) => {
        const simulator = new Simulator(astOfCode as ESTree.Program)
        const steps = simulator.run()
        console.log(steps)
        setSteps(steps)
        changeStep(0)
        setCurrentExecStep(steps[0])
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
            changeStep(nextIndex)
        } else {
            setIsPlaying(false)
        }
    }

    const stepBackward = () => {
        const currentIndex = currentStep?.index ?? 0
        if (currentIndex > 0) {
            const prevIndex = currentIndex - 1
            changeStep(prevIndex)
        }
    }

    const changeStep = (index: number) => {
        if (index >= 0 && index < totalSteps) {
            setCurrentExecStep(steps[index])
        }
    }

    const resetSimulation = () => {
        changeStep(0)
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
        setActiveFile(filename)
    }

    return (
        <SimulatorContext.Provider
            value={{
                mode,
                files,
                activeFile,
                changeCurrentFile,
                updateFileContent,
                setFiles,
                initializeFiles,
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