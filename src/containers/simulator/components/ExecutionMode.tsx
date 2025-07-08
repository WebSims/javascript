import React from 'react'
import { ResizableHandle } from '@/components/ui/resizable'
import { ResizablePanel } from '@/components/ui/resizable'
import { ResizablePanelGroup } from '@/components/ui/resizable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import CodeArea from '@/components/simulator/code-area/CodeArea'
import MemoryModelVisualizer from '@/components/simulator/memory-model/MemoryModelVisualizer'
import ConsoleOutput from '@/components/simulator/console-output/ConsoleOutput'
import PlayerBar from '@/components/simulator/player/PlayerBar'

import { useResponsive } from '@/hooks/useResponsive'

const ExecutionMode: React.FC = () => {
    const { isDesktop } = useResponsive()

    if (isDesktop) {
        return (
            <div className='flex flex-col h-full'>
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
                <PlayerBar />
            </div>
        )
    }

    return (
        <div className='h-full flex flex-col'>
            <ResizablePanelGroup direction="vertical">
                <ResizablePanel>
                    <CodeArea />
                </ResizablePanel>
                <ResizableHandle withHandle className="bg-slate-100 hover:bg-slate-200 transition-colors" />
                <ResizablePanel className='p-1'>
                    <Tabs defaultValue="MEMORY" className='h-full'>
                        <TabsList>
                            <TabsTrigger value="MEMORY">Memory</TabsTrigger>
                            <TabsTrigger value="CONSOLE">Console</TabsTrigger>
                        </TabsList>
                        <TabsContent value="MEMORY" className='h-[calc(100%-36px)]'>
                            <MemoryModelVisualizer />
                        </TabsContent>
                        <TabsContent value="CONSOLE">
                            <ConsoleOutput code={`console.log("Hello, world!");`} />
                        </TabsContent>
                    </Tabs>
                </ResizablePanel>
            </ResizablePanelGroup>
            <PlayerBar />
        </div>
    )
}

export default ExecutionMode