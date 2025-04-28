import React, { useState } from 'react'
import { Code2Icon, TerminalIcon, MemoryStickIcon } from 'lucide-react'

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

import CodeArea from '@/components/simulator/code-area/CodeArea'
import CheatSheetAccordion from './components/CheatSheetAccordion'
import Console from '@/components/simulator/console-output/ConsoleOutput'
import ExecutionBar from '@/components/simulator/execution-bar/ExecutionBar'
import { astOf } from '@/utils/ast'
import { simulateExecution } from '@/utils/simulator'
import { ESNode } from 'hermes-parser'
import MemoryModelVisualizer from '@/components/simulator/memory-model/MemoryModelVisualizer'
import { ExecStep, Scope, Heap } from '@/types/simulation' // Import your types

const CODE_SAMPLE = `
let a;
const b = 1;
function greet(name) { 
  const first = "Hello, ";
  return first + name
}
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
//a++
const emptyArray = []
const emptyObject = {}
const array = [1, 2, 3]
const object = {name: "John", age: 2, isMale: true, nestedProp: object["name"]}  
function bye(name) { 
  const first = "Bye, ";
  return first + name
}`

const MULTIPLE_SCOPE_CODE_SAMPLE = `
const g = true && false && true
const h = true || false
const i = g && false || h
const j = g || false && h
const a = 2
const b = a + 1
const c = (a + 1) + (b + 2)
const d = (a + 1) + (b + 2) + (c + 3)
const e = (a + 1) * (b + 2) + (c - 3) / (d + 4)
`

const FUNCTION_CODE_SAMPLE = `
function b() {
  throw 1
}

function a() {
  try {
    const c = 1
    b()
  } catch (error) {
    1 + 2
  }
}
a()
`
// const FUNCTION_CODE_SAMPLE = `
// function a() {
// function b(){
// const gg = 'GG'
//   throw 1 + 1
//   const l = 13
// }
//   return b()
//   const h = 2
// }
// a()
// const c = 1
// `

// const FUNCTION_CODE_SAMPLE = `
// const a = 2
// const b = a + 1
// const outerConst = 'outerConst text'
// var outerVar = "I am in outerFunction";
// function outerFunction() {
//   const innerVar = "I am in innerFunction";
//   function innerFunction() {
//   const test1 = "test1"
//   return 2
//   }
//   return innerFunction();
// }
// outerFunction();
// `
const CLASS_CODE_SAMPLE = `
class Person {
  // Field declarations
  name;
  age;
  #privateField = "secret";
  
  // Static fields
  static count = 0;
  static #privateStaticField = "static secret";
  
  // Constructor
  constructor(name, age) {
    this.name = name;
    this.age = age;
    Person.count++;
  }
  
  // Normal method
  greet() {
    return "Hello, my name is " + this.name;
  }
  
  // Method with parameters
  celebrateBirthday(message) {
    this.age++;
    return message + " You are now " + this.age;
  }
  
  // Getter
  get info() {
    return this.name + " is " + this.age + " years old";
  }
  
  // Setter
  set info(value) {
    const parts = value.split(" ");
    this.name = parts[0];
    this.age = parseInt(parts[1]);
  }
  
  // Arrow function as class field
  getUpperName = () => {
    return this.name.toUpperCase();
  }
  
  // Static method
  static createAnonymous() {
    return new Person("Anonymous", 0);
  }
  
  // Computed property name
  ["say" + "Hello"]() {
    return "Hello from computed method";
  }
}

class Student extends Person {
  grade;
  
  constructor(name, age, grade) {
    super(name, age);
    this.grade = grade;
  }
  
  static schoolName = "High School";
  
  // Override method
  greet() {
    return super.greet() + " and I'm a student in grade " + this.grade;
  }
  
  getGrade() {
    return this.grade;
  }
}`

const steps = simulateExecution(astOf(FUNCTION_CODE_SAMPLE) as ESNode)
console.log(steps)

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
              <ResizablePanel defaultSize={70}>
                <div className="h-full flex flex-col">
                  <div className="flex items-center gap-2 py-2 px-3 border-b border-slate-100">
                    <Code2Icon className="w-5 h-5 text-slate-500" />
                    <h4 className=" font-semibold text-slate-700">Code Editor</h4>
                  </div>
                  <div className="flex-1 overflow-auto">
                    <CodeArea fromAstOf={FUNCTION_CODE_SAMPLE} />
                  </div>
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle className="bg-slate-100 hover:bg-slate-200 transition-colors" />
              <ResizablePanel
                defaultSize={30}
                minSize={isCheatSheetOpen ? 30 : 3.5}
                maxSize={isCheatSheetOpen ? 70 : 3.5}
              >
                <CheatSheetAccordion onOpenChange={setIsCheatSheetOpen} />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle withHandle className="bg-slate-100 hover:bg-slate-200 transition-colors" />
          <ResizablePanel defaultSize={35} className="bg-white">
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={40} minSize={30}>
                <div className="h-full flex flex-col">
                  <div className="flex items-center gap-2 py-2 px-3 border-b border-slate-100">
                    <TerminalIcon className="w-5 h-5 text-slate-500" />
                    <h4 className="font-semibold text-slate-700">Console Output</h4>
                  </div>
                  <div className="flex-1 overflow-auto p-2">
                    <Console code={CODE_SAMPLE} />
                  </div>
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle className="bg-slate-100 hover:bg-slate-200 transition-colors" />
              <ResizablePanel defaultSize={60} minSize={30}>
                <div className="h-full flex flex-col">
                  <div className="flex items-center gap-2 py-2 px-3 border-b border-slate-100">
                    <MemoryStickIcon className="w-5 h-5 text-slate-500" />
                    <h4 className="font-semibold text-slate-700">Memory Model</h4>
                  </div>
                  <div className="flex-1 overflow-auto p-2">
                    <MemoryModelVisualizer />
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}

export default SimulatorContainer