import React, { useEffect, useState } from 'react'

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
import CodeEditor from '@/components/code-editor/CodeEditor'

const CodeMode: React.FC = () => {
  const { isDesktop } = useResponsive()
  const { updateFileContent, activeFile, files } = useSimulatorStore()
  const fileContent = files[activeFile]

  const [isCheatSheetOpen, setIsCheatSheetOpen] = useState(true)
  const [minSize, setMinSize] = useState(5)

  useEffect(() => {
    if (isCheatSheetOpen) {
      if (isDesktop) {
        setMinSize(30)
      } else {
        setMinSize(50)
      }
      const timeout = setTimeout(() => {
        setMinSize(5)
      }, 100)
      return () => clearTimeout(timeout)
    }
  }, [isCheatSheetOpen, isDesktop])

  if (isDesktop) {
    return (
      <ResizablePanelGroup direction="vertical">
        <ResizablePanel>
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel>
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
          defaultSize={minSize}
          minSize={minSize}
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
          defaultValue="EDITOR"
          onValueChange={() => updateFileContent(activeFile, fileContent)}
        >
          <TabsList>
            <TabsTrigger value="EDITOR">Editor</TabsTrigger>
            <TabsTrigger value="PARSED">Parsed</TabsTrigger>
          </TabsList>
          <TabsContent value="EDITOR" className='h-full  overflow-auto'>
            <CodeEditor />
          </TabsContent>
          <TabsContent value="PARSED" className='h-full overflow-auto'>
            <CodeArea />
          </TabsContent>
        </Tabs>
      </ResizablePanel>
      <ResizableHandle withHandle className="bg-slate-100 hover:bg-slate-200 transition-colors" />
      <ResizablePanel
        defaultSize={minSize}
        minSize={minSize}
        maxSize={isCheatSheetOpen ? 80 : 5}
      >
        <CheatSheetAccordion onOpenChange={setIsCheatSheetOpen} />
      </ResizablePanel>
    </ResizablePanelGroup >
  )
}

export default CodeMode