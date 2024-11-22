import React from 'react'

import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable"

import CheatSheetAccordion from './CheatSheetAccordion'

const Sandbox: React.FC = () => {
    return (
        <div className="h-screen">
            <ResizablePanelGroup
                direction="horizontal"
            >
                <ResizablePanel
                    className="h-full"
                    defaultSize={65}
                >
                    <div className="h-full flex flex-col">
                        <div className="flex-1">
                        </div>
                        <div className="mt-auto">
                            <CheatSheetAccordion />
                        </div>
                    </div>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={35}>
                    <ResizablePanelGroup direction="vertical">
                        <ResizablePanel defaultSize={40}>
                            Two
                        </ResizablePanel>
                        <ResizableHandle withHandle />
                        <ResizablePanel defaultSize={60}>
                            Three
                        </ResizablePanel >
                    </ResizablePanelGroup >
                </ResizablePanel >
            </ResizablePanelGroup >
        </div >
    )
}

export default Sandbox