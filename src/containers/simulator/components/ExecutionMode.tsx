import React from 'react'
import ExecutionBar from '@/components/simulator/execution-bar/ExecutionBar'
import { ResizableHandle } from '@/components/ui/resizable'
import { ResizablePanel } from '@/components/ui/resizable'
import { ResizablePanelGroup } from '@/components/ui/resizable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import CodeArea from '@/components/simulator/code-area/CodeArea'
import MemoryModelVisualizer from '@/components/simulator/memory-model/MemoryModelVisualizer'
import ConsoleOutput from '@/components/simulator/console-output/ConsoleOutput'

import { useDeviceDetection } from '@/hooks/useDeviceDetection'

const ExecutionMode: React.FC = () => {
    const { isDesktop } = useDeviceDetection()

    if (isDesktop) {
        return (
            <ResizablePanelGroup direction="horizontal">
                <ResizablePanel className='p-2'>
                    <MemoryModelVisualizer />
                </ResizablePanel>
                <ResizableHandle withHandle className="bg-slate-100 hover:bg-slate-200 transition-colors" />
                <ResizablePanel>
                    <ResizablePanelGroup direction="vertical">
                        <ResizablePanel className='p-2'>
                            <CodeArea />
                        </ResizablePanel>
                        <ResizableHandle withHandle className="bg-slate-100 hover:bg-slate-200 transition-colors" />
                        <ResizablePanel
                            className='p-2'
                            defaultSize={30}
                        >
                            <ConsoleOutput code={`console.log("Hello, world!");`} />
                        </ResizablePanel>
                    </ResizablePanelGroup>
                </ResizablePanel>
            </ResizablePanelGroup>
        )
    }

    return (
        <div className='flex flex-col h-full'>
            <ResizablePanelGroup direction="vertical">
                <ResizablePanel>
                    <CodeArea />
                </ResizablePanel>
                <ResizableHandle withHandle className="bg-slate-100 hover:bg-slate-200 transition-colors" />
                <ResizablePanel className='p-1'>
                    <Tabs defaultValue="MEMORY">
                        <TabsList>
                            <TabsTrigger value="MEMORY">Memory</TabsTrigger>
                            <TabsTrigger value="CONSOLE">Console</TabsTrigger>
                        </TabsList>
                        <TabsContent value="MEMORY">
                            <MemoryModelVisualizer />
                        </TabsContent>
                        <TabsContent value="CONSOLE">
                            <ConsoleOutput code={`console.log("Hello, world!");`} />
                        </TabsContent>
                    </Tabs>
                </ResizablePanel>
            </ResizablePanelGroup>
            <ExecutionBar />
        </div>
    )
}

export default ExecutionMode