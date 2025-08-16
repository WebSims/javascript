import React, { useState, useRef } from 'react'

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import CodeArea from '@/components/simulator/code-area/CodeArea'
import CheatSheetAccordion from './CheatSheetAccordion'
import { useResponsive } from '@/hooks/useResponsive'
import { useSimulatorStore } from '@/hooks/useSimulatorStore'
import CodeEditor, { CodeEditorRef } from '@/components/code-editor/CodeEditor'

const CodeMode: React.FC = () => {
  const { isDesktop } = useResponsive()
  const { updateFileContent, activeFile, files } = useSimulatorStore()
  const fileContent = files[activeFile]
  const codeEditorRef = useRef<CodeEditorRef>(null)

  const [isCheatSheetOpen, setIsCheatSheetOpen] = useState(true)

  const handleTabChange = (value: string) => {
    updateFileContent(activeFile, fileContent)
    if (value === "EDITOR") {
      // Use setTimeout to ensure the tab content is rendered before focusing
      setTimeout(() => {
        codeEditorRef.current?.focus()
      }, 0)
    }
  }

  if (isDesktop) {
    return (
      <ResizablePanelGroup direction="vertical">
        <ResizablePanel>
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel minSize={20} maxSize={80}>
              <CodeEditor />
            </ResizablePanel>
            <ResizableHandle withHandle className="bg-slate-100 hover:bg-slate-200 transition-colors" />
            <ResizablePanel>
              <CodeArea />
            </ResizablePanel>
          </ResizablePanelGroup >
        </ResizablePanel>
        <ResizableHandle withHandle className="bg-slate-100 hover:bg-slate-200 transition-colors" />
        <ResizablePanel
          defaultSize={30}
          minSize={30}
          maxSize={isCheatSheetOpen ? 70 : 5}
        >
          <CheatSheetAccordion onOpenChange={setIsCheatSheetOpen} />
        </ResizablePanel>
      </ ResizablePanelGroup>
    )
  }

  return (
    <ResizablePanelGroup direction="vertical">
      <ResizablePanel className='p-1'>
        <Tabs
          className='h-full'
          defaultValue="PARSED"
          onValueChange={handleTabChange}
        >
          <TabsList>
            <TabsTrigger value="EDITOR">Editor</TabsTrigger>
            <TabsTrigger value="PARSED">Parsed</TabsTrigger>
          </TabsList>
          <div className='h-[calc(100%-44px)]'>
            <TabsContent value="EDITOR" className='h-full overflow-auto'>
              <CodeEditor ref={codeEditorRef} />
            </TabsContent>
            <TabsContent value="PARSED" className='h-full overflow-auto'>
              <CodeArea />
            </TabsContent>
          </div>
        </Tabs>
      </ResizablePanel>
      <ResizableHandle withHandle className="bg-slate-100 hover:bg-slate-200 transition-colors" />
      <ResizablePanel
        defaultSize={50}
        maxSize={isCheatSheetOpen ? 70 : 5}
        minSize={30}
        onResize={(size) => {
          if (size === 5) {
            setIsCheatSheetOpen(false)
          }
        }}
      >
        <CheatSheetAccordion open={isCheatSheetOpen} onOpenChange={setIsCheatSheetOpen} />
      </ResizablePanel>
    </ResizablePanelGroup >
  )
}

export default CodeMode