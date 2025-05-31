import * as ESTree from "estree"

// ----- Memory Model -----
export const TDZ = { type: "primitive", value: "not_initialized" } as const
export const UNDEFINED = { type: "primitive", value: undefined } as const

// Represents a unique reference to an object/array/function in the heap
export type HeapRef = number

// Represents any value in the JavaScript simulation
export type JSValue =
    | { type: "primitive"; value: ESTree.Literal["value"] }
    | { type: "reference"; ref: HeapRef }
// Consider adding symbol/bigint if needed by the code you simulate

// ----- Heap Object -----
export type HeapObjectType = 'OBJECT' | 'ARRAY' | 'FUNCTION'

export const HEAP_OBJECT_TYPE = {
    OBJECT: "OBJECT",
    ARRAY: "ARRAY",
    FUNCTION: "FUNCTION",
} as const satisfies Record<HeapObjectType, HeapObjectType>

export interface BaseObject {
    properties: Record<string, JSValue>
}

export interface Object extends BaseObject {
    type: typeof HEAP_OBJECT_TYPE.OBJECT
}

export interface ArrayObject extends BaseObject {
    type: typeof HEAP_OBJECT_TYPE.ARRAY
    elements: JSValue[]
}

export interface FunctionObject extends BaseObject {
    type: typeof HEAP_OBJECT_TYPE.FUNCTION
    node: ESTree.Function
}

export type HeapObject = Object | ArrayObject | FunctionObject

export type Heap = Record<HeapRef, HeapObject>

// ----- Scope -----
export type ScopeType = "global" | "function" | "block"

export const DECLARATION_TYPE = {
    VAR: "var",
    LET: "let",
    CONST: "const",
    FUNCTION: "function",
    CLASS: "class",
    PARAM: "param",
    GLOBAL: "global",
} as const
export type DeclarationType = 'var' | 'let' | 'const' | 'function' | 'class' | 'param' | 'global'

// Represents a single activation record (scope) on the call stack
export type VariableValue = {
    declarationType: DeclarationType,
    value: JSValue,
}

export type Scope = {
    type: ScopeType
    variables: Record<string, VariableValue> // Maps variable names to their values (primitive or reference)
    thisValue?: JSValue // The 'this' binding for this scope
    // Add other scope-specific info if needed (e.g., is it a block scope?)
}

type PushScopeKind = "program" | "function" | "try" | "catch" | "finally" | "conditional" | "loop" | "block"
export const PUSH_SCOPE_KIND = {
    Program: "program",
    BlockStatement: "block",
    FunctionDeclaration: "function",
    FunctionExpression: "function",
    ArrowFunctionExpression: "function",
    TryStatement: "try",
    CatchClause: "catch",
    FinallyClause: "finally",
    SwitchStatement: "conditional",
    IfStatement: "conditional",
    ForStatement: "loop",
    WhileStatement: "loop",
    DoWhileStatement: "loop",
} as const satisfies Record<string, PushScopeKind>

export type Declaration = {
    declarationType: DeclarationType,
    variableName: string,
    initialValue: JSValue,
    scopeIndex: number
}

// ----- Memory Change -----
export type MemoryChange =
    | { type: "none" }
    | {
        type: "declaration"
        declarations: Declaration[]
        // Declaration implies an initial JSValue (primitive undefined or a function reference)
    }
    | {
        type: "write_variable"
        scopeIndex: number // Index in the memorySnapshot.scopes array
        variableName: string
        value: JSValue // The new JSValue being assigned
    }
    | {
        type: "create_heap_object" // When an object/array/function is allocated
        ref: HeapRef
        value: HeapObject
    }
    | {
        type: "write_property"
        ref: HeapRef
        property: string | number
        value: JSValue // The new JSValue being assigned
    }
    | {
        type: "delete_property"
        ref: HeapRef // Reference to the HeapObject
        property: string | number // Property name or array index being deleted
    }
    | {
        type: "push_scope"
        kind: PushScopeKind
        scope: Scope
        functionRef?: HeapRef // Reference to the function HeapObject that was called
    }
    | {
        type: "pop_scope"
        scopeIndex: number // Index in the memorySnapshot.scopes array
    }

// ----- Memval -----
export type MemVal = JSValue
// kind: "operand" | "evaluated" | "thrown" | "returned"

export type MemvalChange = {
    type: "push" | "pop"
    value: JSValue
}

// ----- Bubble Up -----
export type BubbleUp = 'RETURN' | 'THROW' | 'BREAK' | 'CONTINUE'

export const BUBBLE_UP_TYPE = {
    RETURN: 'RETURN',
    THROW: 'THROW',
    BREAK: 'BREAK',
    CONTINUE: 'CONTINUE',
} as const satisfies Record<BubbleUp, BubbleUp>

// ----- Execution Step -----

// Represents a single step in the code execution simulation
export type ExecStep = {
    index: number // Sequential step index
    node: ESTree.BaseNode // The primary AST node associated with this step
    scopeIndex: number // Index into memorySnapshot.scopes for the *active* scope
    type: 'INITIAL' | 'PUSH_SCOPE' | 'POP_SCOPE' | 'HOISTING' | 'EXECUTING' | 'EXECUTED' | 'EVALUATING' | 'EVALUATED'
    memorySnapshot: { // Snapshot of the entire memory state *after* this step's change
        scopes: Scope[] // The call stack (array of Scope objects)
        heap: Heap // The heap storing shared objects/arrays/functions
        memval: MemvalNew[] // TODO: MemValNew
    }
    memoryChange: MemoryChange // Description of the memory effect of this step
    memvalChanges: MemvalChange[] // The memvals that were added or removed in this step
    // TODO: instead of output and error, refactor to: 
    // consoleAdded: null | {type: "log" | "error" | 'info' | 'warn' | 'debug' | 'table' | ..., values: JSValue[]}
    // consoleSnapshot: {type: "log" | "error" | 'info' | 'warn' | 'debug' | 'table' | ..., values: JSValue[]}[]
    output?: string // Any output generated in this step (e.g., console.log)
    bubbleUp?: BubbleUp
}

export type TraverseASTOptions = {
    parentScopeIndex: number,
    strict?: boolean,
    callee?: ESTree.Function
    catch?: ESTree.CatchClause
    isRoot?: boolean
}

export type NodeHandler<T extends ESTree.Node> = (node: T, options: TraverseASTOptions) => void

export type NodeHandlerMap = {
    [K in ESTree.Node['type']]?: NodeHandler<Extract<ESTree.Node, { type: K }>>
}