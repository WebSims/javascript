import { useSimulatorStore } from '@/hooks/useSimulatorStore'
import { Editor, OnMount } from '@monaco-editor/react'
import React, { useEffect, useRef, useState } from 'react'
import type { editor as MonacoEditor, IDisposable, Uri as MonacoUri } from 'monaco-editor'
import { Tabs, TabsList, TabsTrigger } from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

const MODEL_PATH = "file:///main-editor-content.js"

interface InternalMonacoModel extends MonacoEditor.ITextModel {
    _commandManager?: {
        _undoRedoService?: {
            createSnapshot: (uri: MonacoUri) => unknown
            restoreSnapshot: (snapshot: unknown) => boolean
        }
    }
}

const CodeEditor: React.FC = () => {
    const { files, updateFileContent, currentFile, changeCurrentFile, toggleMode } = useSimulatorStore()
    const fileContent = files[currentFile]
    const [unsavedFiles, setUnsavedFiles] = useState<Set<string>>(new Set())

    const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
    const modelSnapshotRef = useRef<unknown>(null)
    const disposablesRef = useRef<IDisposable[]>([])
    const [isEditorReady, setIsEditorReady] = useState(false)

    // Load saved files from localStorage to compare with current files
    useEffect(() => {
        const savedFilesString = localStorage.getItem('simulatorFiles')
        if (!savedFilesString) return

        const savedFiles = JSON.parse(savedFilesString)
        const newUnsavedFiles = new Set<string>()

        // Check which files have unsaved changes
        Object.entries(files).forEach(([fileName, content]) => {
            if (savedFiles[fileName] !== content) {
                newUnsavedFiles.add(fileName)
            }
        })

        setUnsavedFiles(newUnsavedFiles)
    }, [files])

    // Listen for the custom filesaved event
    useEffect(() => {
        const handleFileSaved = (e: CustomEvent<{ file: string }>) => {
            const { file } = e.detail
            setUnsavedFiles(prev => {
                const updated = new Set(prev)
                updated.delete(file)
                return updated
            })
        }

        window.addEventListener('filesaved', handleFileSaved as EventListener)
        return () => {
            window.removeEventListener('filesaved', handleFileSaved as EventListener)
        }
    }, [])

    const saveModelSnapshot = () => {
        if (editorRef.current) {
            const model = editorRef.current.getModel() as InternalMonacoModel | null
            if (model && model.uri.toString() === MODEL_PATH) {
                const undoRedoService = model._commandManager?._undoRedoService
                if (undoRedoService && typeof undoRedoService.createSnapshot === 'function') {
                    const snapshot = undoRedoService.createSnapshot(model.uri)
                    if (snapshot) {
                        modelSnapshotRef.current = snapshot
                    }
                }
            }
        }
    }

    const restoreModelSnapshot = () => {
        if (editorRef.current && modelSnapshotRef.current) {
            const model = editorRef.current.getModel() as InternalMonacoModel | null
            if (model && model.uri.toString() === MODEL_PATH) {
                const undoRedoService = model._commandManager?._undoRedoService
                if (undoRedoService && typeof undoRedoService.restoreSnapshot === 'function') {
                    const success = undoRedoService.restoreSnapshot(modelSnapshotRef.current)
                    if (success === false) {
                        modelSnapshotRef.current = null
                    }
                }
            }
        }
    }

    const handleEditorDidMount: OnMount = (editor) => {
        editorRef.current = editor
        setIsEditorReady(true)

        restoreModelSnapshot()

        const model = editor.getModel()
        if (model) {
            disposablesRef.current.forEach(d => d.dispose())
            disposablesRef.current = []

            const changeListener = model.onDidChangeContent(() => {
                saveModelSnapshot()
                // Mark current file as unsaved when content changes
                setUnsavedFiles(prev => new Set(prev).add(currentFile))
            })
            disposablesRef.current.push(changeListener)

            // Add select all action
            editor.addAction({
                id: 'selectAll',
                label: 'Select All',
                keybindings: [
                    // @ts-expect-error monaco is a global variable
                    monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyA,
                ],
                contextMenuGroupId: 'selection',
                contextMenuOrder: 2,
                run: (edt) => {
                    const currentModel = edt.getModel()
                    if (currentModel) {
                        edt.setSelection(currentModel.getFullModelRange())
                    }
                },
            })

            // Add save action
            editor.addAction({
                id: 'saveFile',
                label: 'Save File',
                keybindings: [
                    // @ts-expect-error monaco is a global variable
                    monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
                ],
                contextMenuGroupId: 'navigation',
                contextMenuOrder: 1.5,
                run: (edt) => {
                    const currentModel = edt.getModel()
                    if (currentModel) {
                        const newFiles = { ...files, [currentFile]: currentModel.getValue() }
                        localStorage.setItem('simulatorFiles', JSON.stringify(newFiles))

                        // Remove current file from unsaved files after saving
                        setUnsavedFiles(prev => {
                            const updated = new Set(prev)
                            updated.delete(currentFile)
                            return updated
                        })
                    }
                },
            })

            // Add execution mode toggle action
            editor.addAction({
                id: 'toggleExecutionMode',
                label: 'Change to Execution Mode',
                keybindings: [
                    // @ts-expect-error monaco is a global variable
                    monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyR,
                ],
                run: () => {
                    toggleMode()
                },
            })
        }
    }

    const handleEditorChange = (value: string | undefined) => {
        updateFileContent(currentFile, value || '')
    }

    useEffect(() => {
        if (isEditorReady && editorRef.current) {
            const model = editorRef.current.getModel()
            if (model && model.getValue() !== fileContent) {
                modelSnapshotRef.current = null
            }
        }
    }, [fileContent, isEditorReady])

    useEffect(() => {
        return () => {
            saveModelSnapshot()

            disposablesRef.current.forEach(d => d.dispose())
            disposablesRef.current = []
            setIsEditorReady(false)
        }
    }, [])

    return (
        <div className="flex flex-col h-full">
            <Tabs
                className='flex-none bg-gray-100'
                defaultValue={currentFile}
            >
                <TabsList>
                    {Object.keys(files).map((file) => (
                        <TabsTrigger
                            className={cn(currentFile === file && 'bg-gray-50', 'px-4 py-2')}
                            key={file}
                            value={file}
                            onClick={() => changeCurrentFile(file)}
                        >
                            {file}
                            {unsavedFiles.has(file) && (
                                <span className="inline-block ml-2 w-2 h-2 bg-blue-500 rounded-full" />
                            )}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
            <div className="flex-grow">
                <Editor
                    path={MODEL_PATH}
                    language="javascript"
                    value={fileContent}
                    onChange={handleEditorChange}
                    onMount={handleEditorDidMount}
                    options={{
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        fontSize: 14,
                    }}
                />
            </div>
        </div>
    )
}

export default CodeEditor