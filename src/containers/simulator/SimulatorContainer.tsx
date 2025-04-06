import React from 'react'

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

import CodeArea from '@/components/simulator/code-area/CodeArea'
import CheatSheetAccordion from './components/CheatSheetAccordion'
import Console from '@/components/simulator/console-output/ConsoleOutput'
import MemoryModel from '@/components/simulator/memory-model/MemoryModel'

const CODE_SAMPLE = `
2*3+4
  2*(3+4
    );
    (2*((3+(((4))))))
    const z = (x) => x ** 2
  console.log(1,2, "Hello, " + name)
  console.log(1,something == "xxx" ? myArr[i+1] : false)
  //something == "xxx" ? myArr[i+1] : false
  a++
  const emptyArray = []
  const emptyObject = {}
  const array = [1, 2, 3]
  const object = {name: "John", age: 2, isMale: true, nestedProp: object["name"]}
`

const SimulatorContainer: React.FC = () => {
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
              <CodeArea fromAstOf={CODE_SAMPLE} />
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
              <div className="h-full flex flex-col">
                <h4 className="text-xl font-bold p-2">Console (Outputs of code execution)</h4>
                <div className="flex-1 overflow-auto p-2">
                  <Console code={CODE_SAMPLE} />
                </div>
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={60}>
              <div className="h-full flex flex-col">
                <h4 className="text-xl font-bold p-2">Memory Model (updates on execution steps)</h4>
                <div className="flex-1 overflow-auto p-2">
                  <MemoryModel code={CODE_SAMPLE} />
                </div>
              </div>
            </ResizablePanel >
          </ResizablePanelGroup >
        </ResizablePanel >
      </ResizablePanelGroup >
    </div >
  )
}

export default SimulatorContainer