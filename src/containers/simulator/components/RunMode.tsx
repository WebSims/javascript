import React from 'react'
import { ResizableHandle } from '@/components/ui/resizable'
import { ResizablePanel } from '@/components/ui/resizable'
import { ResizablePanelGroup } from '@/components/ui/resizable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import CodeArea from '@/components/simulator/code-area/CodeArea'
import MemoryModelVisualizer from '@/components/simulator/memory-model/jsx-visualizer'
import ConsoleOutput from '@/components/simulator/console-output/ConsoleOutput'
import PlayerBar from '@/components/simulator/player/PlayerBar'

import { useResponsive } from '@/hooks/useResponsive'
import { ActiveScopeProvider } from '@/contexts/ActiveScopeContext'
import { CallStackPanel } from '@/components/simulator/scope-carousel'

const RunMode: React.FC = () => {
    const { isDesktop } = useResponsive()

    if (isDesktop) {
        return (
            <div className='flex flex-col h-full'>
                <ActiveScopeProvider>
                    <ResizablePanelGroup direction="horizontal">
                        <ResizablePanel minSize={20} maxSize={80}>
                            <ResizablePanelGroup direction="vertical">
                                <ResizablePanel>
                                    <div className="flex h-full">
                                        <CallStackPanel className="w-64 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <CodeArea />
                                        </div>
                                    </div>
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
                        <ResizableHandle withHandle className="bg-slate-100 hover:bg-slate-200 transition-colors" />
                        <ResizablePanel>
                            <MemoryModelVisualizer />
                        </ResizablePanel>
                    </ResizablePanelGroup>
                </ActiveScopeProvider>
                <PlayerBar />
            </div>
        )
    }

    return (
        <ActiveScopeProvider>
            <div className='h-full flex flex-col'>
                <ResizablePanelGroup direction="vertical">
                    <ResizablePanel minSize={30} maxSize={70} className='p-1'>
                        <div className="flex flex-col h-full">
                            <div className="shrink-0 max-h-40 overflow-auto">
                                <CallStackPanel compact className="border border-slate-200 rounded" />
                            </div>
                            <div className="flex-1 min-h-0">
                                <CodeArea />
                            </div>
                        </div>
                    </ResizablePanel>
                    <ResizableHandle withHandle className="bg-slate-100 hover:bg-slate-200 transition-colors" />
                    <ResizablePanel className='p-1'>
                        <Tabs defaultValue="MEMORY" className='h-full'>
                            <TabsList>
                                <TabsTrigger value="MEMORY">Memory</TabsTrigger>
                                <TabsTrigger value="CONSOLE">Console</TabsTrigger>
                            </TabsList>
                            <TabsContent value="MEMORY" className='h-[calc(100%-38px)]'>
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
        </ActiveScopeProvider>
    )
}

export default RunMode