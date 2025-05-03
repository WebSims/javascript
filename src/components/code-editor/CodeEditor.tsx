import { useSimulatorStore } from '@/hooks/useSimulatorStore'
import { Editor } from '@monaco-editor/react'
import React from 'react'

const CodeEditor: React.FC = () => {
    const { codeStr, updateCodeStr } = useSimulatorStore()

    const handleEditorChange = (value: string | undefined) => {
        updateCodeStr(value || '')
    }

    return (
        <Editor
            language="javascript"
            value={codeStr}
            onChange={handleEditorChange}
            options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 14,
            }}
        />
    )
}

export default CodeEditor