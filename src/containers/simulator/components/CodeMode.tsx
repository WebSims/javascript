import React, { useEffect, useState } from 'react'

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import CodeArea from '@/components/simulator/code-area/CodeArea'
import CheatSheetAccordion from './CheatSheetAccordion'
import useDeviceDetection from '@/hooks/useDeviceDetection'

const FUNCTION_CODE_SAMPLE = `function greet(name, family = "Doe") {
const first = "Hello, " + name + " " + family
    return first
}

function newError() {
    throw "Error: "
}

function run(greet) {
    let output
    try {
        newError()
    } catch (error) {
       output = greet
    }
    return output
}
run(greet('Mak', undefined, 28))`

const CodeMode: React.FC = () => {
  const { isDesktop } = useDeviceDetection()

  const [isCheatSheetOpen, setIsCheatSheetOpen] = useState(true)
  const [minSize, setMinSize] = useState(3.5)

  useEffect(() => {
    if (isCheatSheetOpen) {
      if (isDesktop) {
        setMinSize(30)
      } else {
        setMinSize(50)
      }

      const timeout = setTimeout(() => {
        setMinSize(3.5)
      })
      return () => clearTimeout(timeout)
    }
  }, [isCheatSheetOpen, isDesktop])

  if (isDesktop)
    return (
      <ResizablePanelGroup direction="vertical">
        <ResizablePanel>
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel>
              Editor
            </ResizablePanel>

            <ResizableHandle withHandle className="bg-slate-100 hover:bg-slate-200 transition-colors" />

            <ResizablePanel className='p-2'>
              <CodeArea fromAstOf={FUNCTION_CODE_SAMPLE} />
            </ResizablePanel>
          </ResizablePanelGroup >
        </ResizablePanel>

        <ResizableHandle withHandle className="bg-slate-100 hover:bg-slate-200 transition-colors" />

        <ResizablePanel
          defaultSize={30}
          minSize={minSize}
          maxSize={isCheatSheetOpen ? 70 : 3.5}
        >
          <CheatSheetAccordion onOpenChange={setIsCheatSheetOpen} />
        </ResizablePanel>
      </ ResizablePanelGroup>
    )

  return (
    <ResizablePanelGroup direction="vertical">
      <ResizablePanel>
        <div className='p-2 h-full'>
          <Tabs defaultValue="source" className='h-full overflow-auto'>
            <TabsList>
              <TabsTrigger value="source">Source</TabsTrigger>
              <TabsTrigger value="parsed">Parsed</TabsTrigger>
            </TabsList>
            <TabsContent value="source">Editor</TabsContent>
            <TabsContent value="parsed">
              <CodeArea fromAstOf={FUNCTION_CODE_SAMPLE} />
            </TabsContent>
          </Tabs>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle className="bg-slate-100 hover:bg-slate-200 transition-colors" />

      <ResizablePanel
        minSize={minSize}
        maxSize={isCheatSheetOpen ? 80 : 3.5}
      >
        <CheatSheetAccordion onOpenChange={setIsCheatSheetOpen} />
      </ResizablePanel>
    </ResizablePanelGroup >

  )
}

export default CodeMode