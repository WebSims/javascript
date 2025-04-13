import React, { useState } from 'react'

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

import CodeArea from '@/components/simulator/code-area/CodeArea'
import CheatSheetAccordion from './components/CheatSheetAccordion'
import Console from '@/components/simulator/console-output/ConsoleOutput'
import MemoryModel from '@/components/simulator/memory-model/MemoryModel'
import ExecutionBar from '@/components/simulator/execution-bar/ExecutionBar'
import NewCodeArea from '@/components/simulator/code-area/NewCodeArea'

const CODE_SAMPLE = `
let a;
const b = 1;
function greet(name) { 
 const first = "Hello, ";
 return first + name
 };
 const arrowFn = (x) => {
  const y = x * x
  return y
 }
((1 + 2));
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
  const [isCheatSheetOpen, setIsCheatSheetOpen] = useState(true)

  return (
    <div className="h-screen">
      <ExecutionBar />
      <div className="h-[calc(100vh-50px)]">
        <ResizablePanelGroup
          direction="horizontal"
        >
          <ResizablePanel
            className="h-full"
            defaultSize={60}
            minSize={50}
            maxSize={70}
          >
            <ResizablePanelGroup direction="vertical" className='left-side'>
              <ResizablePanel
                defaultSize={70}
              >
                <div className="h-full flex flex-col">
                  <h4 className="text-xl font-bold p-2">Console (Outputs of code execution)</h4>
                  <div className="flex-1 overflow-auto p-2">
                    {/* <NewCodeArea fromAstOf={CODE_SAMPLE} /> */}
                    <CodeArea fromAstOf={CODE_SAMPLE} />
                  </div>
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel
                defaultSize={30}
                minSize={isCheatSheetOpen ? 30 : 4}
                maxSize={isCheatSheetOpen ? 70 : 4}
              >
                <CheatSheetAccordion onOpenChange={setIsCheatSheetOpen} />
              </ResizablePanel >
            </ResizablePanelGroup >
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
    </div >
  )
}

export default SimulatorContainer