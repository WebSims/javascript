import React from 'react'

import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable"

import CodeEditor from './code-editor/CodeEditor'
import CheatSheetAccordion from './CheatSheetAccordion'

const CODE_SAMPLE = `
2*3+4
  a++
  2*(3+4
    );
    (2*((3+(((4))))))
    const z = (x) => x ** 2
  console.log(1,2, "Hello, " + name)
  console.log(1,something == "xxx" ? myArr[i+1] : false)
  //something == "xxx" ? myArr[i+1] : false
  const emptyArray = []
  const emptyObject = {}
  const array = [1, 2, 3]
  const object = {name: "John", age: 2, isMale: true, nestedProp: object["name"]}
`

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
                        <h4 className="text-xl font-bold p-2">Code Editor</h4>
                        <div className="flex-1 overflow-auto p-2">
                            <CodeEditor fromAstOf={CODE_SAMPLE} />
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