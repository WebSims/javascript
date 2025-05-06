import { useSimulatorStore } from '@/hooks/useSimulatorStore'
import { Editor, OnMount } from '@monaco-editor/react'
import React, { useEffect, useRef, useState } from 'react'
import type { editor as MonacoEditor, IDisposable, Uri as MonacoUri } from 'monaco-editor'

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
    const { codeStr, updateCodeStr } = useSimulatorStore()
    const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
    const modelSnapshotRef = useRef<unknown>(null)
    const disposablesRef = useRef<IDisposable[]>([])
    const [isEditorReady, setIsEditorReady] = useState(false)

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
        }
    }

    const handleEditorChange = (value: string | undefined) => {
        updateCodeStr(value || '')
    }

    useEffect(() => {
        if (isEditorReady && editorRef.current) {
            const model = editorRef.current.getModel()
            if (model && model.getValue() !== codeStr) {
                modelSnapshotRef.current = null
            }
        }
    }, [codeStr, isEditorReady])

    useEffect(() => {
        return () => {
            saveModelSnapshot()

            disposablesRef.current.forEach(d => d.dispose())
            disposablesRef.current = []
            setIsEditorReady(false)
        }
    }, [])

    return (
        <Editor
            path={MODEL_PATH}
            language="javascript"
            value={codeStr}
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 14,
            }}
        />
    )
}

export default CodeEditor