import { useSimulatorStore } from '@/hooks/useSimulatorStore'
import { Editor, OnMount } from '@monaco-editor/react'
import React, { useEffect, useRef, useState } from 'react'
import type { editor as MonacoEditor, IDisposable, Uri as MonacoUri } from 'monaco-editor'
import type * as MonacoType from 'monaco-editor'
import { Tabs, TabsList, TabsTrigger } from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'
import { useNavigate, useParams } from 'react-router'
import { useModeToggle } from '@/hooks/useModeToggle'

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
    const { files, updateFileContent, activeFile, changeCurrentFile, settings } = useSimulatorStore()
    const fileContent = files[activeFile]
    const navigate = useNavigate()
    const { exampleId } = useParams()
    const { toggleMode, currentMode } = useModeToggle()

    const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
    const monacoRef = useRef<typeof MonacoType | null>(null)
    const modelSnapshotRef = useRef<unknown>(null)
    const disposablesRef = useRef<IDisposable[]>([])
    const [isEditorReady, setIsEditorReady] = useState(false)

    // Add refs for files and activeFile to avoid stale closure in Monaco actions
    const filesRef = useRef(files)
    const activeFileRef = useRef(activeFile)
    useEffect(() => { filesRef.current = files }, [files])
    useEffect(() => { activeFileRef.current = activeFile }, [activeFile])

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

    }, [files])

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

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor
        monacoRef.current = monaco
        setIsEditorReady(true)

        restoreModelSnapshot()

        const model = editor.getModel()
        if (model) {
            disposablesRef.current.forEach(d => d.dispose())
            disposablesRef.current = []

            // Add select all action
            editor.addAction({
                id: 'selectAll',
                label: 'Select All',
                keybindings: [
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
                    monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
                ],
                contextMenuGroupId: 'navigation',
                contextMenuOrder: 1.5,
                run: (edt) => {
                    const currentModel = edt.getModel()
                    if (currentModel) {
                        const newFiles = { ...filesRef.current, [activeFileRef.current]: currentModel.getValue() }
                        localStorage.setItem('simulatorFiles', JSON.stringify(newFiles))
                    }
                },
            })

            // Add execution mode toggle action
            editor.addAction({
                id: 'toggleExecutionMode',
                label: 'Change to Execution Mode',
                keybindings: [
                    monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyR,
                ],
                run: () => {
                    toggleMode()
                },
            })
        }
    }

    const handleEditorChange = (value: string | undefined) => {
        if (settings.autoSave) {
            const newFiles = { ...files, [activeFile]: value || '' }
            localStorage.setItem('simulatorFiles', JSON.stringify(newFiles))
        }
        updateFileContent(activeFile, value || '')

        // Check if we're in example mode and haven't redirected yet
        if (exampleId) {
            const url = currentMode === 'RUN' ? '/?mode=run' : '/'
            navigate(url, { replace: true })
        }
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
                defaultValue={activeFile}
            >
                <TabsList>
                    {Object.keys(files).map((file) => (
                        <TabsTrigger
                            className={cn(activeFile === file && 'bg-gray-50', 'px-4 py-2')}
                            key={file}
                            value={file}
                            onClick={() => changeCurrentFile(file)}
                        >
                            {file.split('/')[0] === 'src' ? file.split('/')[1] : file.split('/')[0] + '.js'}
                            {!exampleId && (
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