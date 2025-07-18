import Simulator from "@/core/simulator"
import * as ESTree from "estree"

// ----- Memory Model -----
export const JS_VALUE_TDZ = { type: "primitive", value: "not_initialized" } as const
export const JS_VALUE_UNDEFINED = { type: "primitive", value: undefined } as const
export const JS_VALUE_NAN = { type: "primitive", value: NaN } as const

export type PrimitiveValue = ESTree.Literal["value"]
export type HeapRef = number

export type JSValuePrimitive = { type: "primitive"; value: PrimitiveValue }
export type JSValueReference = { type: "reference"; ref: HeapRef }
export type JSValue = JSValuePrimitive | JSValueReference
// Consider adding symbol/bigint if needed by the code you simulate

// ----- Heap Object -----

export const HEAP_OBJECT_TYPE = {
    OBJECT: "object",
    ARRAY: "array",
    FUNCTION: "function",
} as const
export type HeapObjectType = 'object' | 'array' | 'function'

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

export const SCOPE_KIND = {
    PROGRAM: "program",
    FUNCTION: "function",
    BLOCK: "block",
    TRY: "try",
    CATCH: "catch",
    FINALLY: "finally",
    CONDITIONAL: "conditional",
    LOOP: "loop",
} as const
export type ScopeKind = "program" | "function" | "try" | "catch" | "finally" | "conditional" | "loop" | "block"

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
        kind: ScopeKind
        scope: Scope
    }
    | {
        type: "pop_scope"
        kind: ScopeKind
        scopeIndex: number // Index in the memorySnapshot.scopes array
    }

// ----- Memval -----
export type Memval = JSValue
// kind: "operand" | "evaluated" | "thrown" | "returned"

export type MemvalChange = {
    type: "push" | "pop"
    value: JSValue
}

// ----- Console -----
export type ConsoleEntry = {
    type: "log" | "error" | 'info' | 'warn' | 'debug' | 'table' | 'group' | 'groupEnd' | 'groupCollapsed',
    values: JSValue[]
}

// ----- Bubble Up -----
export const BUBBLE_UP_TYPE = {
    RETURN: 'return',
    THROW: 'throw',
    BREAK: 'break',
    CONTINUE: 'continue',
} as const
export type BubbleUp = 'return' | 'throw' | 'break' | 'continue'

// ----- Execution Step -----
export const EXEC_STEP_TYPE = {
    INITIAL: 'initial',
    PUSH_SCOPE: 'push_scope',
    POP_SCOPE: 'pop_scope',
    FUNCTION_CALL: 'function_call',
    HOISTING: 'hoisting',
    EXECUTING: 'executing',
    EXECUTED: 'executed',
    EVALUATING: 'evaluating',
    EVALUATED: 'evaluated',
} as const
export type ExecStepType =
    | 'initial'
    | 'push_scope'
    | 'pop_scope'
    | 'function_call'
    | 'hoisting'
    | 'executing'
    | 'executed'
    | 'evaluating'
    | 'evaluated'

// Represents a single step in the code execution simulation
export type ExecStep = {
    index: number // Sequential step index
    node: ESTree.BaseNode // The primary AST node associated with this step
    type: ExecStepType
    scopeIndex: number // Index into memorySnapshot.scopes for the *active* scope
    memorySnapshot: { // Snapshot of the entire memory state *after* this step's change
        scopes: Scope[] // The call stack (array of Scope objects)
        heap: Heap // The heap storing shared objects/arrays/functions
        memval: Memval[] // TODO: MemValNew
    }
    memoryChange: MemoryChange // Description of the memory effect of this step
    memvalChanges: MemvalChange[] // The memvals that were added or removed in this step
    // TODO: instead of output and error, refactor to: 
    consoleAdded?: ConsoleEntry
    consoleSnapshot: ConsoleEntry[]
    bubbleUp?: BubbleUp
}

export type TraverseASTOptions = {
    parentScopeIndex: number,
    strict?: boolean,
    callee?: ESTree.Function
    catch?: ESTree.CatchClause
    typeof?: boolean
    isRoot?: boolean
    for?: ESTree.ForStatement
}

export type NodeHandler<T extends ESTree.Node> = (this: Simulator, node: T, options: TraverseASTOptions) => void

export type NodeHandlerMap = {
    [K in ESTree.Node['type']]: NodeHandler<Extract<ESTree.Node, { type: K }>>
}

// Custom AST Node type that includes the category property
export interface CustomNode extends ESTree.BaseNode {
    category?: string
}

export type CoerceHandlerMap = {
    'toBoolean': (this: Simulator, jsValue: JSValue, recordCoercion: boolean) => boolean,
    'toString': (this: Simulator, jsValue: JSValue) => string,
    'toNumber': (this: Simulator, jsValue: JSValue) => number,
    'toInt32': (this: Simulator, jsValue: JSValue) => number,
    'toUint32': (this: Simulator, jsValue: JSValue) => number,
    'toPrimitive': (this: Simulator, jsValue: JSValue) => PrimitiveValue,
    'binaryOperator': (this: Simulator, operator: ESTree.BinaryOperator, left: JSValue, right: JSValue) => JSValuePrimitive,
    'logicalOperator': (this: Simulator, operator: ESTree.LogicalOperator, left: JSValue, getRightValue: () => JSValue) => JSValue,
    'assignmentOperator': (this: Simulator, operator: ESTree.AssignmentOperator, left: JSValue, getRightValue: () => JSValue) => JSValue,
    'updateOperator': (this: Simulator, operator: ESTree.UpdateOperator, operand: JSValue, isPrefix: boolean) => { newValue: JSValue, returnValue: JSValue },
    'unaryOperator': (this: Simulator, operator: ESTree.UnaryOperator, operand: JSValue) => JSValue,
}

export const COERCION_TYPE = {
    TO_BOOLEAN: 'to_boolean',
    TO_NUMBER: 'to_number',
    TO_STRING: 'to_string',
    TO_PRIMITIVE: 'to_primitive',
    TO_OBJECT: 'to_object',
} as const
export type CoercionType = 'to_boolean' | 'to_number' | 'to_string' | 'to_primitive' | 'to_object'

export type CoercionInfo = {
    type: CoercionType,
    from: JSValue,
    to: JSValue,
    operation: string,
    operator: ESTree.BinaryOperator | ESTree.AssignmentOperator | ESTree.UpdateOperator
}
