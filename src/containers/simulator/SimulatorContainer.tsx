import React, { useEffect } from 'react'

import CodeMode from './components/CodeMode'
import MainLayout from '@/layouts/MainLayout'
import ExecutionMode from './components/ExecutionMode'

import { useSimulatorStore } from '@/hooks/useSimulatorStore'

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
const TRY_CODE_SAMPLE = `function greet(name, family = "Doe") {
const first = "Hello, " + name + " " + family
    return first
}

function newError() {
    throw "Error: "
}

function run(greet) {
    let output
    try {
        newError()
    } catch (error) {
       output = greet
    }
    return output
}
run(greet('Mak', undefined, 28))`

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

const FIBONACCI_CODE_SAMPLE = `function f(n) {
  return n <= 1 ? n : f(n-1) + f(n-2)
}
let fib5 = f(5); // 0 + 1 + 1 + 2 + 3 = 5`

const FUNCTION_CODE_SAMPLE = `function functionThatSucceeds() {
  let result = "Starting functionThatSucceeds"
  result = "functionThatSucceeds completed successfully"
  return result // Returns successfully
}

function functionThatThrows() {
  let result = "Starting functionThatThrows"
  throw "Error intentionally thrown from functionThatThrows"
  // Unreachable code:
  result = "This won't be assigned"
  return result
}

function middleLayerExecution(targetFunction) {
  let middleResult = "Initial middle value"
  var middleVar = "Var in middle"
  try {
    middleResult = "Inside middle try"
    // Call the actual target function (which might succeed or throw)
    const innerResult = targetFunction()
    middleResult += " | Inner func result: " + innerResult
    // Optionally, throw another error here to test outer catch
    // throw "Error thrown from middle layer try";
  } catch (innerError) {
    middleResult = "Caught error in middle: " + innerError
    middleVar = "Var updated after middle catch"
    // Optionally re-throw to be caught by the outer layer
    // throw innerError;
  } finally {
    middleResult += " | Middle finally executed"
    // Errors in finally can be tricky, avoid if possible unless testing specific scenarios
    // throw "Error from middle finally";
  }
  return middleResult + " | " + middleVar
}


function outerLayerExecution(targetFunction) {
  const outerConst = "Outer const value"
  let outerResult = "Initial outer value"
  var outerVar = "Var in outer"

  try {
    outerResult = "Inside outer try"
    // Call the middle layer function, passing the innermost function
    const middleLayerResult = middleLayerExecution(targetFunction)
    outerResult = outerConst + " | Middle layer returned: " + middleLayerResult
  } catch (outerError) {
    // This catch will trigger if the middle layer re-throws an error,
    // or if an error occurs in the middle layer's finally block.
    outerResult = "Caught error in outer: " + outerError
    outerVar = "Var updated after outer catch"
  } finally {
    outerResult += " | Outer finally executed"
  }
  return outerResult + " | " + outerVar
}


// Scenario 1: Call the function that succeeds through nested try-catch
const resultSuccessNested = outerLayerExecution(functionThatSucceeds)

// Scenario 2: Call the function that throws, caught by middle layer
const resultErrorNestedCaughtMiddle = outerLayerExecution(functionThatThrows)

// To test the outer catch, you would need to uncomment a 'throw'
// in the middle layer's catch or finally block.`

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

const SIMULATOR_CODE_SAMPLE = `const adam = {name: "Adam"}
const eve = {name: "Eve"}
try {
  eve['name'][0][1][0]
} catch(e) {
  eve.a.b.c
}
`

const SimulatorContainer: React.FC = () => {
  const { mode, codeStr, updateCodeStr } = useSimulatorStore()

  useEffect(() => {
    updateCodeStr(codeStr || SIMULATOR_CODE_SAMPLE)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  return (
    <MainLayout>
      {mode === 'CODE' && <CodeMode />}
      {mode === 'EXECUTION' && <ExecutionMode />}
    </MainLayout>
  )
}

export default SimulatorContainer