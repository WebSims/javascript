import * as ESTree from 'estree'
import {
    JS_VALUE_UNDEFINED,
    BUBBLE_UP_TYPE,
    SCOPE_KIND,
    DECLARATION_TYPE,
    HEAP_OBJECT_TYPE,
    ExecStep,
    JSValue,
    MemoryChange,
    HeapObject,
    Declaration,
    ScopeType,
    MemvalChange,
    BubbleUp,
    Scope,
    TraverseASTOptions,
    NodeHandlerMap,
    NodeHandler,
    DeclarationType,
    VariableValue,
    EXEC_STEP_TYPE,
    ExecStepType,
    ScopeKind,
    Memval,
    HeapRef,
    PrimitiveValue,
    JSValuePrimitive,
} from "../types/simulator"
import { cloneDeep } from "lodash" // Import cloneDeep from lodash
import { execHandlers } from './execution'
import { hoistingHandlers } from './hoisting'
import { coerceHandlers } from './coercion'

class Simulator {
    private ast: ESTree.Program
    private steps: ExecStep[]
    private scopes: Scope[]
    private heap: Record<number, HeapObject>
    private memval: Memval[]
    private lastScopeIndex: number
    private lastRef: number
    private stepCounter: number
    private stepMemoryChange: MemoryChange
    private stepMemvalChanges: MemvalChange[]
    private declarations: Declaration[]
    private hoistingHandlers: NodeHandlerMap
    private execHandlers: NodeHandlerMap
    private consoleOutput: { type: "log" | "error" | 'info' | 'warn' | 'debug' | 'table' | 'group' | 'groupEnd' | 'groupCollapsed', values: JSValue[] }[]

    /* Constructor */
    constructor(ast: ESTree.Program) {
        if (!ast) {
            throw new Error("Invalid AST provided to Simulator constructor.")
        }

        this.ast = ast
        this.steps = [
            {
                index: 0,
                node: ast,
                type: EXEC_STEP_TYPE.INITIAL,
                memorySnapshot: { scopes: [], heap: {}, memval: [] },
                scopeIndex: 0,
                memoryChange: { type: "none" },
                memvalChanges: [],
                consoleSnapshot: [],
            }
        ]
        this.scopes = []
        this.heap = {}
        this.memval = []
        this.lastScopeIndex = -1
        this.lastRef = -1
        this.stepCounter = 1
        this.stepMemoryChange = { type: 'none' }
        this.stepMemvalChanges = []
        this.declarations = []
        this.execHandlers = execHandlers
        this.hoistingHandlers = hoistingHandlers
        this.consoleOutput = []
    }

    /* Run */
    run(): ExecStep[] {
        this.traverseExec(this.ast, { parentScopeIndex: 0 })
        return this.steps
    }

    /* Memory */
    createMemorySnapshot(): ExecStep["memorySnapshot"] {
        return cloneDeep({ scopes: this.scopes, heap: this.heap, memval: this.memval })
    }

    /* Step */
    addStep(astNode: ESTree.BaseNode, type: ExecStepType, bubbleUp?: BubbleUp) {
        const snapshot = this.createMemorySnapshot()
        const step = {
            index: this.stepCounter++,
            node: astNode,
            type,
            scopeIndex: this.lastScopeIndex,
            memorySnapshot: snapshot,
            memoryChange: this.stepMemoryChange,
            memvalChanges: this.stepMemvalChanges,
            consoleSnapshot: this.getConsoleSnapshot(),
            bubbleUp,
        }
        this.steps.push(step)
        this.stepMemoryChange = { type: "none" }
        this.stepMemvalChanges = []
    }

    addPushScopeStep(astNode: ESTree.BaseNode, kind: ScopeKind) {
        const type = kind === SCOPE_KIND.PROGRAM ? "global" : kind === SCOPE_KIND.FUNCTION ? "function" : "block"
        const scope = this.newScope(type)
        this.stepMemoryChange = { type: "push_scope", kind, scope }
        this.addStep(astNode, EXEC_STEP_TYPE.PUSH_SCOPE)
    }

    addHoistingStep(astNode: ESTree.BaseNode) {
        this.stepMemoryChange = { type: "declaration", declarations: this.declarations }
        this.addStep(astNode, EXEC_STEP_TYPE.HOISTING)
        this.declarations = []
    }

    addExecutingStep(astNode: ESTree.BaseNode) {
        this.addStep(astNode, EXEC_STEP_TYPE.EXECUTING)
    }

    addExecutedStep(astNode: ESTree.BaseNode, bubbleUp?: BubbleUp) {
        this.addStep(astNode, EXEC_STEP_TYPE.EXECUTED, bubbleUp)
    }

    addEvaluatingStep(astNode: ESTree.BaseNode) {
        this.addStep(astNode, EXEC_STEP_TYPE.EVALUATING)
    }

    addEvaluatedStep(astNode: ESTree.BaseNode, bubbleUp?: BubbleUp) {
        this.addStep(astNode, EXEC_STEP_TYPE.EVALUATED, bubbleUp)
    }

    addThrownStep(astNode: ESTree.BaseNode) {
        const errorValue = this.popMemval()
        if (errorValue && errorValue.type === 'reference') {
            const errorObject = this.getHeapObject(errorValue.ref)
            this.addConsoleOutput('error', [errorObject.properties.stack])
        }
        this.addStep(astNode, EXEC_STEP_TYPE.EXECUTED, BUBBLE_UP_TYPE.THROW)
        throw BUBBLE_UP_TYPE.THROW
    }

    addPopScopeStep(astNode: ESTree.BaseNode, kind: ScopeKind, bubbleUp?: BubbleUp) {
        this.scopes.splice(this.lastScopeIndex, 1)
        this.stepMemoryChange = { type: "pop_scope", kind, scopeIndex: this.lastScopeIndex }
        this.addStep(astNode, EXEC_STEP_TYPE.POP_SCOPE, bubbleUp)
        this.lastScopeIndex--
    }

    /* Scope */
    getLastScopeIndex(): number {
        return this.lastScopeIndex
    }

    newScope(type: ScopeType): Scope {
        const scope = { type, variables: {} }
        this.scopes.push(scope)
        return scope
    }

    /* Heap */
    getLastRef(): HeapRef {
        return this.lastRef
    }

    getHeapObject(ref: HeapRef): HeapObject {
        return this.heap[ref]
    }

    createHeapObject({ properties, elements, node }: {
        properties?: Record<string, JSValue>,
        elements?: JSValue[],
        node?: ESTree.Function,
    }): HeapObject {
        let object: HeapObject
        const commonProperties = properties || {}

        if (elements) {
            object = { type: HEAP_OBJECT_TYPE.ARRAY, properties: commonProperties, elements: elements }
        } else if (node) {
            object = { type: HEAP_OBJECT_TYPE.FUNCTION, properties: commonProperties, node: node }
        } else {
            object = { type: HEAP_OBJECT_TYPE.OBJECT, properties: commonProperties }
        }

        this.heap[++this.lastRef] = object
        this.stepMemoryChange = { type: "create_heap_object", ref: this.lastRef, value: object }
        return object
    }

    createErrorObject(errorType: string, message: string) {
        this.createHeapObject({
            properties: {
                name: { type: 'primitive', value: errorType },
                message: { type: 'primitive', value: message },
                stack: { type: 'primitive', value: `${errorType}: ${message}` }
            }
        })
        this.pushMemval({ type: 'reference', ref: this.lastRef })
    }

    /* Console */
    addConsoleOutput(type: "log" | "error" | 'info' | 'warn' | 'debug' | 'table' | 'group' | 'groupEnd' | 'groupCollapsed', values: JSValue[]) {
        const consoleEntry = { type, values }
        this.consoleOutput.push(consoleEntry)
        return consoleEntry
    }

    getConsoleSnapshot() {
        return [...this.consoleOutput]
    }

    /* Declaration */
    newDeclaration(name: string, initialValue: JSValue, declarationType: DeclarationType, scopeIndex: number) {
        this.scopes[scopeIndex].variables[name] = { declarationType, value: initialValue }
        this.declarations.push({ declarationType, variableName: name, initialValue, scopeIndex })
    }

    writeVariable(name: string, value: JSValue, declarationType: DeclarationType, parentScopeIndex: number) {
        const lookupResult = this.lookupVariable(name)
        let scopeIndex = parentScopeIndex
        if (lookupResult) {
            this.scopes[lookupResult.scopeIndex].variables[name] = { declarationType, value }
            scopeIndex = lookupResult.scopeIndex
        } else {
            this.scopes[scopeIndex].variables[name] = { declarationType, value }
        }
        this.stepMemoryChange = { type: "write_variable", scopeIndex, variableName: name, value }
    }

    writeProperty(ref: number, property: string, value: JSValue) {
        const heapObj = this.heap[ref]
        if (heapObj.type === HEAP_OBJECT_TYPE.ARRAY) {
            const isNumber = !isNaN(parseInt(property))
            if (isNumber) {
                heapObj.elements[parseInt(property)] = value
            } else {
                heapObj.properties[property] = value
            }
        } else {
            heapObj.properties[property] = value
        }
        this.stepMemoryChange = { type: "write_property", ref, property, value }
    }

    deleteProperty(ref: number, property: string) {
        const heapObj = this.heap[ref]
        if (heapObj.type === HEAP_OBJECT_TYPE.ARRAY) {
            const isNumber = !isNaN(parseInt(property))
            if (isNumber) {
                delete heapObj.elements[parseInt(property)]
            } else {
                delete heapObj.properties[property]
            }
        } else {
            delete heapObj.properties[property]
        }
        this.stepMemoryChange = { type: "delete_property", ref, property }
    }

    lookupVariable(name: string): { variable: VariableValue, scopeIndex: number } | undefined {
        for (let i = this.lastScopeIndex; i >= 0; i--) {
            if (Object.prototype.hasOwnProperty.call(this.scopes[i].variables, name)) {
                return { variable: this.scopes[i].variables[name], scopeIndex: i }
            }
        }
        return undefined
    }

    readProperty(ref: number, property: string): JSValue {
        const heapObj = this.heap[ref]
        if (heapObj.type === HEAP_OBJECT_TYPE.ARRAY) {
            const isNumber = !isNaN(parseInt(property))
            if (isNumber) {
                return heapObj.elements[parseInt(property)]
            } else {
                return heapObj.properties[property] || JS_VALUE_UNDEFINED
            }
        } else {
            return heapObj.properties[property] || JS_VALUE_UNDEFINED
        }
    }

    /* Memval */
    pushMemval(value: Memval) {
        this.memval.push(value)
        this.stepMemvalChanges.push({ type: "push", value })
    }

    popMemval(): Memval {
        const value = this.memval.pop()
        if (value) {
            this.stepMemvalChanges.push({ type: "pop", value })
        }
        return value as Memval
    }

    readMemval(shift?: number): Memval {
        return shift ? this.memval[this.memval.length - 1 - shift] : this.memval[this.memval.length - 1]
    }

    /* Traverse */
    traverseHoisting(astNode: ESTree.Node, options: TraverseASTOptions, isRoot: boolean = true) {
        if (options.callee || options.catch) {
            const params = options.callee ? options.callee.params : options.catch ? [options.catch.param as ESTree.Pattern] : []
            const args: JSValue[] = []
            if (options.callee) {
                const argsCount = this.popMemval()
                if (argsCount.type === 'primitive' && typeof argsCount.value === 'number') {
                    for (let i = 0; i < argsCount.value; i++) {
                        args.push(this.popMemval())
                    }
                }
                delete options.callee
            } else if (options.catch) {
                args.push(this.popMemval())
                delete options.catch
            }
            for (const param of params) {
                let paramValue = args.pop() || JS_VALUE_UNDEFINED
                if (param.type === "AssignmentPattern" && paramValue === JS_VALUE_UNDEFINED) {
                    this.traverseExec(param.right, options)
                    paramValue = this.popMemval()
                }
                const identifier = this.getIdentifierFromPattern(param)
                if (identifier) {
                    this.newDeclaration(identifier.name, paramValue, DECLARATION_TYPE.PARAM, this.lastScopeIndex)
                }
            }
        }

        const handler = this.hoistingHandlers[astNode.type] as NodeHandler<typeof astNode>
        if (handler) {
            handler.call(this, astNode, { ...options, isRoot })
        }
    }

    traverseExec(
        astNode: ESTree.Node,
        options: TraverseASTOptions
    ) {
        if (this.isBlock(astNode) || options.callee || options.for) {
            const scopeKind = this.getScopeKind(astNode, options)
            try {
                const isForInit = Boolean(options.for)
                delete options.for
                options.strict = this.isStrict(astNode, options)

                this.lastScopeIndex++
                if (options.callee) {
                    options.parentScopeIndex = this.lastScopeIndex
                }

                this.addPushScopeStep(astNode, scopeKind)
                this.traverseHoisting(astNode, options)
                this.addHoistingStep(astNode)

                const handler = this.execHandlers[astNode.type] as NodeHandler<typeof astNode>
                if (handler) {
                    handler.call(this, astNode, options)
                } else {
                    console.warn(`Execution Pass: Unhandled node type - ${astNode.type}`)
                }

                if (this.lastScopeIndex !== 0 && !isForInit) {
                    this.addPopScopeStep(astNode, scopeKind)
                }
            } catch (bubbleUp) {
                if (this.lastScopeIndex !== 0) {
                    this.addPopScopeStep(astNode, scopeKind, bubbleUp as BubbleUp)
                    throw bubbleUp
                }
            }
        } else {
            const handler = this.execHandlers[astNode.type] as NodeHandler<typeof astNode>
            if (handler) {
                handler.call(this, astNode, options)
            } else {
                console.warn(`Execution Pass: Unhandled node type - ${astNode.type}`)
            }
        }
    }


    /* Helper Functions */
    isBlock(node: ESTree.BaseNode): boolean {
        return node.type === "BlockStatement" || node.type === "Program"
    }

    isStrict(astNode: ESTree.BaseNode, options: TraverseASTOptions): boolean {
        if (options.strict) return true
        if (astNode.type === "Program" || (options.callee && options.callee.body.type === "BlockStatement")) {
            const firstStatement = (astNode as ESTree.BlockStatement).body[0]
            if (firstStatement && firstStatement.type === "ExpressionStatement") {
                const expr = firstStatement.expression
                return expr.type === "Literal" && (expr as ESTree.Literal).value === "use strict"
            }
        }
        return false
    }

    getScopeKind(astNode: ESTree.BaseNode, options: TraverseASTOptions) {
        if (astNode.type === "Program") return SCOPE_KIND.PROGRAM
        else if (options.callee) return SCOPE_KIND.FUNCTION
        else if (options.catch) return SCOPE_KIND.CATCH
        else if (options.for) return SCOPE_KIND.LOOP
        else return SCOPE_KIND.BLOCK
    }

    getIdentifierFromPattern(pattern: ESTree.Pattern): ESTree.Identifier | undefined {
        if (pattern.type === "Identifier") {
            return pattern
        } else if (pattern.type === "AssignmentPattern") {
            return this.getIdentifierFromPattern(pattern.left)
        } else {
            console.warn("Unhandled pattern type:", pattern.type)
            return undefined
        }
    }

    /* Coercion */
    toBoolean(jsValue: JSValue, recordCoercion: boolean = true): boolean {
        return coerceHandlers.toBoolean.call(this, jsValue, recordCoercion)
    }
    toNumber(jsValue: JSValue): number {
        return coerceHandlers.toNumber.call(this, jsValue)
    }
    toInt32(jsValue: JSValue): number {
        return coerceHandlers.toInt32.call(this, jsValue)
    }
    toUint32(jsValue: JSValue): number {
        return coerceHandlers.toUint32.call(this, jsValue)
    }
    toString(jsValue: JSValue): string {
        return coerceHandlers.toString.call(this, jsValue)
    }
    toPrimitive(jsValue: JSValue): PrimitiveValue {
        return coerceHandlers.toPrimitive.call(this, jsValue)
    }
    binaryOperatorHandler(operator: ESTree.BinaryOperator, left: JSValue, right: JSValue): JSValuePrimitive {
        return coerceHandlers.binaryOperator.call(this, operator, left, right)
    }
    logicalOperatorHandler(operator: ESTree.LogicalOperator, left: JSValue, getRightValue: () => JSValue): JSValue {
        return coerceHandlers.logicalOperator.call(this, operator, left, getRightValue)
    }
    assignmentOperatorHandler(operator: ESTree.AssignmentOperator, left: JSValue, getRightValue: () => JSValue): JSValue {
        return coerceHandlers.assignmentOperator.call(this, operator, left, getRightValue)
    }
    updateOperatorHandler(operator: ESTree.UpdateOperator, operand: JSValue, isPrefix: boolean): { newValue: JSValue, returnValue: JSValue } {
        return coerceHandlers.updateOperator.call(this, operator, operand, isPrefix)
    }
    unaryOperatorHandler(operator: ESTree.UnaryOperator, operand: JSValue): JSValue {
        return coerceHandlers.unaryOperator.call(this, operator, operand)
    }
}

export default Simulator