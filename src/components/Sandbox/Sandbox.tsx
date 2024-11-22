import React from 'react'

import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable"

const Sandbox = () => {
    return (
        <div className="h-screen">
            <ResizablePanelGroup
                direction="horizontal"
            >
                <ResizablePanel
                    className="h-full"
                    defaultSize={50}
                >
                    One
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={50}>
                    <ResizablePanelGroup direction="vertical">
                        <ResizablePanel defaultSize={50}>
                            Two
                        </ResizablePanel>
                        <ResizableHandle withHandle />
                        <ResizablePanel defaultSize={50}>
                            Three
                        </ResizablePanel >
                    </ResizablePanelGroup >
                </ResizablePanel >
            </ResizablePanelGroup >
        </div >
    )
}

export default Sandbox