import React from 'react'
import { ResizableHandle } from '@/components/ui/resizable'
import { ResizablePanel } from '@/components/ui/resizable'
import { ResizablePanelGroup } from '@/components/ui/resizable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import CodeArea from '@/components/simulator/code-area/CodeArea'
import MemoryModelVisualizer from '@/components/simulator/memory-model/jsx-visualizer'
import ConsoleOutput from '@/components/simulator/console-output/ConsoleOutput'
import PlayerBar from '@/components/simulator/player/PlayerBar'
import { CallStackPanel, ScopeCarousel, ScopeDrawer } from '@/components/simulator/scope-carousel'
import { ActiveScopeProvider, useActiveScope } from '@/contexts/ActiveScopeContext'

import { useResponsive } from '@/hooks/useResponsive'

// Desktop layout with call stack panel
const DesktopRunMode = () => {
    return (
        <div className='flex flex-col h-full'>
            <ResizablePanelGroup direction="horizontal">
                {/* Left side: Code + Console */}
                <ResizablePanel minSize={20} maxSize={60} defaultSize={35}>
                    <ResizablePanelGroup direction="vertical">
                        <ResizablePanel>
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
                
                <ResizableHandle withHandle className="bg-slate-100 hover:bg-slate-200 transition-colors" />
                
                {/* Middle: Call Stack Navigator */}
                <ResizablePanel minSize={15} maxSize={50} defaultSize={30}>
                    <CallStackNavigatorDesktop />
                </ResizablePanel>
                
                <ResizableHandle withHandle className="bg-slate-100 hover:bg-slate-200 transition-colors" />
                
                {/* Right side: Memory Model */}
                <ResizablePanel minSize={20} defaultSize={35}>
                    <MemoryModelVisualizer />
                </ResizablePanel>
            </ResizablePanelGroup>
            <PlayerBar />
        </div>
    )
}

// Desktop call stack navigator with panel + carousel
const CallStackNavigatorDesktop = () => {
    const { hasFrames } = useActiveScope()
    
    if (!hasFrames) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-50 border-x border-slate-200">
                <div className="text-center text-slate-400 p-4">
                    <div className="text-4xl mb-2">📚</div>
                    <p className="text-sm">No active function calls</p>
                    <p className="text-xs mt-1">Call stack will appear here during execution</p>
                </div>
            </div>
        )
    }
    
    return (
        <ResizablePanelGroup direction="vertical">
            {/* Call Stack List */}
            <ResizablePanel minSize={20} maxSize={40} defaultSize={30}>
                <CallStackPanel className="h-full" />
            </ResizablePanel>
            
            <ResizableHandle withHandle className="bg-slate-100 hover:bg-slate-200 transition-colors" />
            
            {/* Active Scope View */}
            <ResizablePanel>
                <div className="h-full p-2 bg-white">
                    <ScopeCarousel 
                        className="h-full"
                        showHeader={true}
                        showNavigation={true}
                        showDots={true}
                    />
                </div>
            </ResizablePanel>
        </ResizablePanelGroup>
    )
}

// Mobile layout with drawer-based call stack
const MobileRunMode = () => {
    return (
        <div className='h-full flex flex-col'>
            <ResizablePanelGroup direction="vertical">
                <ResizablePanel minSize={30} maxSize={70} className='p-1'>
                    <CodeArea />
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
            
            {/* Floating drawer for call stack on mobile */}
            <ScopeDrawer />
        </div>
    )
}

const RunMode: React.FC = () => {
    const { isDesktop } = useResponsive()

    return (
        <ActiveScopeProvider autoFollowDeepest={true}>
            {isDesktop ? <DesktopRunMode /> : <MobileRunMode />}
        </ActiveScopeProvider>
    )
}

export default RunMode
