import * as ESTree from 'estree'
import { ExecStep, JSValue, Heap, MemoryChange, HeapObject, HeapRef, Declaration, TDZ, ScopeType, PUSH_SCOPE_KIND, MemvalNew, MemvalChange, BubbleUp, UNDEFINED, BUBBLE_UP_VALUE, Scope, NodeHandler, TraverseASTOptions } from "../types/simulation"
import { cloneDeep, forEach } from "lodash" // Import cloneDeep from lodash

/**
 * Simulates the execution of JavaScript code represented by an AST.
 * Performs a two-pass process: hoisting followed by execution.
 *
 * @param programNode The root Program node of the AST.
 * @returns An array of execution steps representing the simulation.
 */
export const simulateExecution = (astNode: ESTree.BaseNode | null): ExecStep[] => {
    // Ensure we have a valid Program node
    if (!astNode) {
        console.error("Invalid AST provided to simulateExecution.")
        return []
    }

    const steps: ExecStep[] = [
        {
            index: 0,
            memorySnapshot: { scopes: [], heap: {}, memval: [] },
            phase: "initial",
            scopeIndex: 0,
            memoryChange: { type: "none" },
            memvalChanges: [],
            executing: false,
            executed: false,
            evaluating: false,
            evaluated: false,
        }
    ]
    const scopes: Scope[] = []
    const heap: Heap = {}
    const memval: MemvalNew[] = []

    let lastScopeIndex = -1
    let lastRef: HeapRef = -1
    let stepCounter: number = 1
    let stepMemvalChanges: MemvalChange[] = []

    // --- Helper Functions ---
    const createMemorySnapshot = (): ExecStep["memorySnapshot"] => {
        // Crucial: Use a reliable deep copy mechanism here!
        // Use lodash cloneDeep
        return cloneDeep({ scopes, heap, memval })
    }

    // --- Step Helpers ---
    const addStep = (stepData: Omit<ExecStep, "index" | "memorySnapshot">): ExecStep => {
        const snapshot = createMemorySnapshot()
        const step = {
            ...stepData,
            index: stepCounter++,
            memorySnapshot: snapshot,
            memvalChanges: stepMemvalChanges,
        }
        steps.push(step)
        stepMemvalChanges = []
        return step
    }
    const addPushScopeStep = (astNode: ESTree.BaseNode) => {
        const getPushScopeType = (astNode: ESTree.BaseNode): ScopeType => {
            switch (astNode.type) {
                case "Program":
                    return "global"
                case "FunctionDeclaration":
                case "ArrowFunctionExpression":
                    return "function"
                default:
                    return "block"
            }
        }
        const type = getPushScopeType(astNode)
        const { scope, scopeIndex } = newScope(type)

        const kind = PUSH_SCOPE_KIND[astNode.type as keyof typeof PUSH_SCOPE_KIND]

        addStep({
            node: astNode,
            phase: "creation",
            scopeIndex,
            memoryChange: { type: "push_scope", kind, scope },
            memvalChanges: [],
            executing: true,
            executed: false,
            evaluating: false,
            evaluated: false,
            type: 'EXECUTING',
        })
    }
    const addHoistingStep = (astNode: ESTree.BaseNode, scopeIndex: number, declarations: Declaration[]): ExecStep => {
        return addStep({
            node: astNode,
            phase: "creation",
            scopeIndex,
            memoryChange: { type: "declaration", declarations, scopeIndex },
            memvalChanges: [],
            executing: true,
            executed: false,
            evaluating: false,
            evaluated: false,
            type: 'EXECUTING',
        })
    }
    const addExecutingStep = ({
        astNode,
        scopeIndex,
    }: {
        astNode: ESTree.BaseNode,
        scopeIndex: number
    }): ExecStep => {
        return addStep({
            node: astNode,
            phase: "execution",
            scopeIndex,
            memoryChange: { type: "none" },
            memvalChanges: [],
            executing: true,
            executed: false,
            evaluating: false,
            evaluated: false,
            type: 'EXECUTING',
        })
    }

    const addExecutedStep = ({
        astNode,
        scopeIndex,
        memoryChange = { type: "none" },
        bubbleUp,
    }: {
        astNode: ESTree.BaseNode,
        scopeIndex: number,
        memoryChange?: MemoryChange,
        bubbleUp?: 'RETURN' | 'THROW' | 'BREAK' | 'CONTINUE'
    }) => {
        return addStep({
            node: astNode,
            phase: "execution",
            scopeIndex,
            memoryChange,
            memvalChanges: [],
            executing: false,
            executed: true,
            evaluating: false,
            evaluated: false,
            type: 'EXECUTED',
            bubbleUp
        })
    }

    const addEvaluatingStep = ({
        astNode,
        scopeIndex,
    }: {
        astNode: ESTree.BaseNode,
        scopeIndex: number
    }): ExecStep => {
        return addStep({
            node: astNode,
            phase: "execution",
            scopeIndex,
            memoryChange: { type: "none" },
            memvalChanges: [],
            executing: false,
            executed: false,
            evaluating: true,
            evaluated: false,
            type: 'EVALUATING',
        })
    }

    const addEvaluatedStep = ({
        astNode,
        scopeIndex,
        memoryChange = { type: "none" },
        bubbleUp,
    }: {
        astNode: ESTree.BaseNode,
        scopeIndex: number,
        memoryChange?: MemoryChange,
        bubbleUp?: BubbleUp,
    }) => {
        addStep({
            node: astNode,
            phase: "execution",
            scopeIndex,
            memoryChange,
            memvalChanges: stepMemvalChanges,
            executing: false,
            executed: false,
            evaluating: false,
            evaluated: true,
            type: 'EVALUATED',
            bubbleUp
        })
        stepMemvalChanges = []
    }

    const addErrorThrownStep = ({
        astNode,
        scopeIndex,
    }: {
        astNode: ESTree.BaseNode,
        scopeIndex: number,
        error?: JSValue,
    }) => {
        return addStep({
            node: astNode,
            phase: "execution",
            scopeIndex,
            memoryChange: { type: "none" },
            memvalChanges: stepMemvalChanges,
            type: 'EXECUTED',
            bubbleUp: 'THROW'
        })
    }

    const addPopScopeStep = ({
        astNode,
        scopeIndex,
        bubbleUp,
    }: {
        astNode: ESTree.BaseNode,
        scopeIndex: number,
        bubbleUp?: BubbleUp
    }) => {
        scopes.splice(scopeIndex, 1)
        addStep({
            node: astNode,
            phase: "destruction",
            scopeIndex: scopeIndex,
            memvalChanges: stepMemvalChanges,
            memoryChange: { type: "pop_scope", scopeIndex },
            executing: false,
            executed: true,
            evaluating: false,
            evaluated: false,
            type: 'EXECUTED',
            bubbleUp,
        })
        stepMemvalChanges = []
    }

    // --- Memory Manipulation Helpers (Simplified placeholders) ---
    const newScope = (type: ScopeType): { scope: Scope, scopeIndex: number } => {
        const scopeIndex = scopes.length
        const scope = { type, variables: {} }
        scopes.push(scope)
        return { scope, scopeIndex }
    }

    const createHeapObject = ({
        properties,
        elements,
        node
    }: {
        properties?: Record<string, JSValue>,
        elements?: JSValue[],
        node?: ESTree.Function,
    }): HeapObject => {
        let object: HeapObject
        const commonProperties = properties || {}

        if (elements) {
            object = {
                type: "array",
                properties: commonProperties,
                elements: elements
            }
        } else if (node) {
            object = {
                type: "function",
                properties: commonProperties,
                node: node
            }
        } else {
            object = {
                type: "object",
                properties: commonProperties
            }
        }

        heap[++lastRef] = object
        return object
    }

    const lookupVariable = (name: string, startingScopeIndex: number): { value: JSValue, scopeIndex: number } | -1 => {
        for (let i = startingScopeIndex; i >= 0; i--) {
            if (Object.prototype.hasOwnProperty.call(scopes[i].variables, name)) {
                return { value: scopes[i].variables[name], scopeIndex: i }
            }
        }
        return -1
    }

    const newDeclaration = (name: string, kind: Extract<MemoryChange, { type: 'declaration' }>['declarations'][number]['kind'], scopeIndex: number, initialValue: JSValue): Declaration => {
        scopes[scopeIndex].variables[name] = initialValue
        return {
            kind,
            variableName: name,
            initialValue,
            scopeIndex
        }
    }

    const writeVariable = (name: string, value: JSValue, scopeIndex: number): number => {
        const lookup = lookupVariable(name, scopeIndex)
        if (lookup !== -1) {
            scopes[lookup.scopeIndex].variables[name] = value
            return lookup.scopeIndex
        }
        console.warn(`Attempted to write to undeclared variable ${name}`)
        // For simplicity, let's assign to global if not found (like non-strict mode)
        scopes[0].variables[name] = value
        return 0
    }

    const writeProperty = (ref: number, property: string, value: JSValue) => {
        const heapObj = heap[ref]
        if (heapObj.type === 'array') {
            const isNumber = !isNaN(parseInt(property))
            if (isNumber) {
                heapObj.elements[parseInt(property)] = value
            } else {
                heapObj.properties[property] = value
            }
        } else {
            heapObj.properties[property] = value
        }
    }

    const readProperty = (ref: number, property: string): JSValue => {
        const heapObj = heap[ref]
        if (heapObj.type === "array") {
            const isNumber = !isNaN(parseInt(property))
            if (isNumber) {
                return heapObj.elements[parseInt(property)]
            } else {
                return heapObj.properties[property] || UNDEFINED
            }
        } else {
            return heapObj.properties[property] || UNDEFINED
        }
    }

    // --- MemVal Helpers ---
    const pushMemval = (value: MemvalNew) => {
        memval.push(value)
        stepMemvalChanges.push({ type: "push", value })
    }

    const popMemval = (): MemvalNew => {
        const value = memval.pop()
        if (value) {
            stepMemvalChanges.push({ type: "pop", value })
        }
        return value as MemvalNew
    }

    const readMemval = (shift?: number): MemvalNew => {
        return shift ? memval[memval.length - 1 - shift] : memval[memval.length - 1]
    }

    /**
     * Creates a JavaScript error object and adds it to the heap and memVal
     * 
     * @param errorType The type of error (TypeError, ReferenceError, etc.)
     * @param message The error message
     * @param astNode Optional AST node for tracking
     * @returns A JSValue representing the error
     */
    const createErrorObject = (errorType: string, message: string) => {
        createHeapObject({
            properties: {
                name: { type: 'primitive', value: errorType },
                message: { type: 'primitive', value: message },
                stack: { type: 'primitive', value: `${errorType}: ${message}` }
            }
        })

        pushMemval({ type: 'reference', ref: lastRef })
    }

    const getErrorString = (error: JSValue): string => {
        const errorObject = heap[error.ref]
        return errorObject?.properties?.stack?.value
    }
    const printError = (error: JSValue): void => {
        console.error(getErrorString(error))
    }

    const nodeHandlers: Partial<{
        Program: NodeHandler<ESTree.BlockStatement>
        BlockStatement: NodeHandler<ESTree.BlockStatement>
        ExpressionStatement: NodeHandler<ESTree.ExpressionStatement>
        Literal: NodeHandler<ESTree.Literal>
        VariableDeclaration: NodeHandler<ESTree.VariableDeclaration>
        CallExpression: NodeHandler<ESTree.CallExpression>
        Identifier: NodeHandler<ESTree.Identifier>
        BinaryExpression: NodeHandler<ESTree.BinaryExpression>
        LogicalExpression: NodeHandler<ESTree.LogicalExpression>
        ReturnStatement: NodeHandler<ESTree.ReturnStatement>
        ThrowStatement: NodeHandler<ESTree.ThrowStatement>
        TryStatement: NodeHandler<ESTree.TryStatement>
        AssignmentExpression: NodeHandler<ESTree.AssignmentExpression>
        ConditionalExpression: NodeHandler<ESTree.ConditionalExpression>
        ArrayExpression: NodeHandler<ESTree.ArrayExpression>
        ObjectExpression: NodeHandler<ESTree.ObjectExpression>
        MemberExpression: NodeHandler<ESTree.MemberExpression>
        ArrowFunctionExpression: NodeHandler<ESTree.ArrowFunctionExpression>
        IfStatement: NodeHandler<ESTree.IfStatement>
        ForStatement: NodeHandler<ESTree.ForStatement>
        ContinueStatement: NodeHandler<ESTree.ContinueStatement>
        UpdateExpression: NodeHandler<ESTree.UpdateExpression>
        EmptyStatement: NodeHandler<ESTree.EmptyStatement>
    }> = {}

    nodeHandlers["BlockStatement"] = (astNode, options) => {
        const statements = astNode.body

        if (Array.isArray(statements)) {
            for (const statement of statements) {
                // Skip function declarations as they are already handled in the creation phase
                if (statement.type === "FunctionDeclaration") {
                    continue
                }
                traverseAST(statement, options)
            }
        }
    }

    nodeHandlers["Program"] = nodeHandlers["BlockStatement"]

    nodeHandlers["ExpressionStatement"] = (astNode, options) => {
        addExecutingStep({ astNode, scopeIndex: lastScopeIndex })

        traverseAST(astNode.expression, options)

        popMemval()
        addExecutedStep({ astNode, scopeIndex: lastScopeIndex })
    }

    nodeHandlers["Literal"] = (astNode) => {
        addEvaluatingStep({ astNode, scopeIndex: lastScopeIndex })

        const evaluatedValue: JSValue = { type: "primitive", value: astNode.value }
        pushMemval(evaluatedValue)

        addEvaluatedStep({ astNode, scopeIndex: lastScopeIndex })
    }

    const getIdentifierFromPattern = (pattern: ESTree.Pattern) => {
        if (pattern.type === "Identifier") {
            return pattern
        } else if (pattern.type === "AssignmentPattern") {
            return getIdentifierFromPattern(pattern.left)
        } else {
            console.warn("Unhandled pattern type:", pattern.type)
        }
    }

    nodeHandlers["VariableDeclaration"] = (astNode, options) => {
        for (const declarator of astNode.declarations) {
            addExecutingStep({ astNode, scopeIndex: lastScopeIndex })

            let evaluatedValue: JSValue = UNDEFINED
            if (declarator.init) {
                traverseAST(declarator.init, options)
                evaluatedValue = popMemval()
            }

            const identifier = getIdentifierFromPattern(declarator.id)
            let memoryChange: MemoryChange | undefined
            if (identifier) {
                const targetScopeIndex = writeVariable(identifier.name, evaluatedValue, lastScopeIndex)
                memoryChange = {
                    type: "write_variable",
                    scopeIndex: targetScopeIndex,
                    variableName: identifier.name,
                    value: evaluatedValue,
                }
            }
            addExecutedStep({ astNode, scopeIndex: lastScopeIndex, memoryChange })
        }
    }

    nodeHandlers["CallExpression"] = (astNode, options) => {
        traverseAST(astNode.callee, options)

        const args = []
        for (const arg of astNode.arguments) {
            traverseAST(arg, options)
            const popedArg = popMemval()
            args.push(popedArg)
        }

        const fnRef = popMemval()
        if (fnRef) {
            if (fnRef.type !== "reference") {
                createErrorObject('ReferenceError', `${astNode.callee.name} is not a function`)
                addErrorThrownStep({ astNode, scopeIndex: lastScopeIndex })
                throw BUBBLE_UP_VALUE.THROW
            }

            const object = heap[fnRef.ref]
            if (object.type === "function") {
                args.forEach(arg => pushMemval(arg))
                pushMemval({ type: 'primitive', value: args.length })
                pushMemval(fnRef)

                addEvaluatingStep({ astNode, scopeIndex: lastScopeIndex })

                popMemval()

                try {
                    traverseAST(object.node.body, { ...options, callee: object.node })
                    pushMemval(UNDEFINED)
                    addEvaluatedStep({ astNode, scopeIndex: lastScopeIndex })
                } catch (bubbleUp) {
                    switch (bubbleUp) {
                        case BUBBLE_UP_VALUE.RETURN:
                            addEvaluatedStep({ astNode, scopeIndex: lastScopeIndex, bubbleUp })
                            break
                        case BUBBLE_UP_VALUE.THROW:
                            addErrorThrownStep({ astNode, scopeIndex: lastScopeIndex })
                            throw bubbleUp
                        default:
                            throw bubbleUp
                    }
                }
            } else {
                createErrorObject('TypeError', `${astNode.callee.name} is not a function`)
                addErrorThrownStep({ astNode, scopeIndex: lastScopeIndex })
                throw BUBBLE_UP_VALUE.THROW
            }
        }
    }

    nodeHandlers["Identifier"] = (astNode) => {
        addEvaluatingStep({ astNode, scopeIndex: lastScopeIndex })

        const varName = astNode.name
        if (varName === 'undefined') {
            const evaluatedValue = { type: "primitive", value: undefined } as const
            pushMemval(evaluatedValue)
            addEvaluatedStep({ astNode, scopeIndex: lastScopeIndex })
        } else {
            const variable = lookupVariable(varName, lastScopeIndex)
            if (variable !== -1) {
                const evaluatedValue = variable.value
                if (evaluatedValue === TDZ) {
                    createErrorObject('ReferenceError', `${varName} is not defined`)
                    addErrorThrownStep({ astNode, scopeIndex: lastScopeIndex })
                    throw BUBBLE_UP_VALUE.THROW
                } else {
                    pushMemval(evaluatedValue)
                    addEvaluatedStep({ astNode, scopeIndex: lastScopeIndex })
                }
            } else {
                createErrorObject('ReferenceError', `${varName} is not defined`)
                addErrorThrownStep({ astNode, scopeIndex: lastScopeIndex })
                throw BUBBLE_UP_VALUE.THROW
            }
        }
    }

    nodeHandlers["BinaryExpression"] = (astNode, options) => {
        addEvaluatingStep({ astNode, scopeIndex: lastScopeIndex })


        traverseAST(astNode.left, options)
        traverseAST(astNode.right, options)

        const rightValue = popMemval()
        const leftValue = popMemval()

        // TODO: reference have problem for example:
        // ([] >= {}); => should be false but return true
        // Solution 1: use heap value instead of reference and create it and competive without using eval
        const rightRaw = rightValue.type === "reference"
            ? `heap[${rightValue.ref}]`
            : JSON.stringify(rightValue.value)

        const leftRaw = leftValue.type === "reference"
            ? `heap[${leftValue.ref}]`
            : JSON.stringify(leftValue.value)

        const value = eval(`${leftRaw}${astNode.operator}${rightRaw}`)
        const evaluatedValue = {
            type: "primitive",
            value
        } as const

        pushMemval(evaluatedValue)
        addEvaluatedStep({ astNode, scopeIndex: lastScopeIndex })
    }

    nodeHandlers["LogicalExpression"] = (astNode, options) => {
        addEvaluatingStep({ astNode, scopeIndex: lastScopeIndex })

        let rightValue: JSValue

        if (astNode.operator === "&&") {
            traverseAST(astNode.left, options)

            const leftResult = readMemval()
            if (leftResult.type === "primitive" && leftResult.value === true) {
                traverseAST(astNode.right, options)
                rightValue = popMemval()
            } else {
                rightValue = { type: "primitive", value: false }
            }
        } else if (astNode.operator === "||") {
            traverseAST(astNode.left, options)

            const leftResult = readMemval()
            if (leftResult.type === "primitive" && leftResult.value === true) {
                rightValue = { type: "primitive", value: true }
            } else {
                traverseAST(astNode.right, options)
                rightValue = popMemval()
            }
        } else {
            traverseAST(astNode.left, options)
            traverseAST(astNode.right, options)
            rightValue = popMemval()
        }
        const leftValue = popMemval()

        // TODO: reference have problem for example:
        // ([] >= {}); => should be false but return true
        // Solution 1: use heap value instead of reference and create it and competive without using eval
        const rightRaw = rightValue.type === "reference"
            ? `heap[${rightValue.ref}]`
            : JSON.stringify(rightValue.value)

        const leftRaw = leftValue.type === "reference"
            ? `heap[${leftValue.ref}]`
            : JSON.stringify(leftValue.value)

        const value = eval(`${leftRaw}${astNode.operator}${rightRaw}`)
        const evaluatedValue = {
            type: "primitive",
            value
        } as const

        pushMemval(evaluatedValue)
        addEvaluatedStep({ astNode, scopeIndex: lastScopeIndex })
    }

    nodeHandlers["ReturnStatement"] = (astNode, options) => {
        addExecutingStep({ astNode, scopeIndex: lastScopeIndex })

        if (astNode.argument) {
            traverseAST(astNode.argument, options)
        } else {
            pushMemval(UNDEFINED)
        }

        addExecutedStep({ astNode, scopeIndex: lastScopeIndex, bubbleUp: BUBBLE_UP_VALUE.RETURN })
        throw BUBBLE_UP_VALUE.RETURN
    }

    nodeHandlers["ThrowStatement"] = (astNode, options) => {
        addExecutingStep({ astNode, scopeIndex: lastScopeIndex })

        traverseAST(astNode.argument, options)

        addErrorThrownStep({ astNode, scopeIndex: lastScopeIndex })
        throw BUBBLE_UP_VALUE.THROW
    }

    nodeHandlers["TryStatement"] = (astNode, options) => {
        addExecutingStep({ astNode, scopeIndex: lastScopeIndex })

        const finalizerHandler = () => {
            if (astNode.finalizer) {
                try {
                    traverseAST(astNode.finalizer, options)
                } catch (finalizerBubbleUp) {
                    if (finalizerBubbleUp === BUBBLE_UP_VALUE.THROW) {
                        addErrorThrownStep({ astNode, scopeIndex: lastScopeIndex })
                        throw finalizerBubbleUp
                    }
                    addExecutedStep({ astNode, scopeIndex: lastScopeIndex })
                    throw finalizerBubbleUp
                }
            }
        }

        const catchHandler = () => {
            if (astNode.handler) {
                try {
                    traverseAST(astNode.handler.body, { ...options, catch: astNode.handler })
                } catch (catchBubbleUp) {
                    if (astNode.finalizer) {
                        const catchValue = popMemval()
                        finalizerHandler()
                        pushMemval(catchValue)
                    }

                    if (catchBubbleUp === BUBBLE_UP_VALUE.THROW) {
                        addErrorThrownStep({ astNode, scopeIndex: lastScopeIndex })
                        throw catchBubbleUp
                    }
                    addExecutedStep({ astNode, scopeIndex: lastScopeIndex })
                    throw catchBubbleUp
                }
            }
        }

        try {
            traverseAST(astNode.block, options)
            finalizerHandler()
            addExecutedStep({ astNode, scopeIndex: lastScopeIndex })
        } catch (tryBubbleUp) {
            if (tryBubbleUp === BUBBLE_UP_VALUE.THROW) {
                if (astNode.handler) {
                    catchHandler()
                    finalizerHandler()
                    addExecutedStep({ astNode, scopeIndex: lastScopeIndex })
                } else {
                    if (astNode.finalizer) {
                        finalizerHandler()
                    }
                    addErrorThrownStep({ astNode, scopeIndex: lastScopeIndex })
                    throw tryBubbleUp
                }
            }

            if (tryBubbleUp === BUBBLE_UP_VALUE.RETURN) {
                if (astNode.finalizer) {
                    const tryValue = popMemval()
                    finalizerHandler()
                    pushMemval(tryValue)
                }
                addExecutedStep({ astNode, scopeIndex: lastScopeIndex })
                throw tryBubbleUp
            }
        }
    }

    nodeHandlers["AssignmentExpression"] = (astNode, options) => {
        addEvaluatingStep({ astNode, scopeIndex: lastScopeIndex })

        if (astNode.operator === "=") {
            // Assignment
            if (astNode.left.type === "MemberExpression") {
                const memberExpression = astNode.left
                traverseAST(memberExpression.object, options)

                if (memberExpression.computed) {
                    traverseAST(memberExpression.property, options)
                } else {
                    const propertyNode = memberExpression.property
                    if (propertyNode.type === 'Identifier' || propertyNode.type === 'PrivateIdentifier') {
                        pushMemval({ type: "primitive", value: propertyNode.name })
                    }
                }

                if (readMemval(1) === UNDEFINED) {
                    const evaluatedProperty = popMemval()
                    popMemval()
                    createErrorObject('TypeError', `Cannot set properties of undefined (setting '${evaluatedProperty.value}')`)
                    addErrorThrownStep({ astNode, scopeIndex: lastScopeIndex })
                    throw BUBBLE_UP_VALUE.THROW
                }

                traverseAST(astNode.right, options)
                const evaluatedValue = popMemval()
                const evaluatedProperty = popMemval()
                const evaluatedObject = popMemval()

                if (evaluatedObject.type === "reference" && evaluatedProperty.type === "primitive") {
                    const stringProperty = String(evaluatedProperty.value)
                    writeProperty(evaluatedObject.ref, stringProperty, evaluatedValue)

                    pushMemval(evaluatedValue)

                    const memoryChange: MemoryChange = {
                        type: "write_property",
                        ref: evaluatedObject.ref,
                        property: stringProperty,
                        value: evaluatedValue,
                    }
                    addEvaluatedStep({ astNode, scopeIndex: lastScopeIndex, memoryChange })
                } else {
                    pushMemval(evaluatedValue)
                    addEvaluatedStep({ astNode, scopeIndex: lastScopeIndex })
                }
            } else {
                const identifier = getIdentifierFromPattern(astNode.left)
                if (identifier) {
                    const lookupResult = lookupVariable(identifier.name, lastScopeIndex)

                    traverseAST(astNode.right, options)
                    const evaluatedValue = popMemval()

                    if (lookupResult === -1 && options.strict) {
                        createErrorObject('ReferenceError', `${identifier.name} is not defined`)
                        addErrorThrownStep({ astNode, scopeIndex: lastScopeIndex })
                        throw BUBBLE_UP_VALUE.THROW
                    }

                    const targetScopeIndex = writeVariable(identifier.name, evaluatedValue, lastScopeIndex)
                    pushMemval(evaluatedValue)

                    const memoryChange: MemoryChange = {
                        type: "write_variable",
                        scopeIndex: targetScopeIndex,
                        variableName: identifier.name,
                        value: evaluatedValue,
                    }
                    addEvaluatedStep({ astNode, scopeIndex: lastScopeIndex, memoryChange })
                }
            }
        } else {
            // Update && Assignment
            if (astNode.left.type === "MemberExpression") {
                const memberExpression = astNode.left
                traverseAST(memberExpression.object, options)

                if (memberExpression.computed) {
                    traverseAST(memberExpression.property, options)
                } else {
                    const propertyNode = memberExpression.property
                    if (propertyNode.type === 'Identifier' || propertyNode.type === 'PrivateIdentifier') {
                        pushMemval({ type: "primitive", value: propertyNode.name })
                    }
                }

                if (readMemval(1) === UNDEFINED) {
                    const evaluatedProperty = popMemval()
                    popMemval()
                    createErrorObject('TypeError', `Cannot read properties of undefined (reading '${evaluatedProperty.value}')`)
                    addErrorThrownStep({ astNode, scopeIndex: lastScopeIndex })
                    throw BUBBLE_UP_VALUE.THROW
                }

                traverseAST(astNode.right, options)

                const evaluatedRight = popMemval()
                const evaluatedProperty = popMemval()
                const evaluatedObject = popMemval()

                let evaluatedLeft: JSValue = UNDEFINED
                if (evaluatedObject.type === "reference" && evaluatedProperty.type === "primitive") {
                    evaluatedLeft = readProperty(evaluatedObject.ref, String(evaluatedProperty.value))
                }

                // TODO: reference have problem.
                const leftRaw = JSON.stringify(evaluatedLeft.value)
                const rightRaw = JSON.stringify(evaluatedRight.value)
                const value = eval(`${leftRaw}${astNode.operator.replace("=", "")}${rightRaw}`)
                const evaluatedValue = { type: "primitive", value } as const

                if (evaluatedObject.type === "reference" && evaluatedProperty.type === "primitive") {
                    const stringProperty = String(evaluatedProperty.value)
                    writeProperty(evaluatedObject.ref, stringProperty, evaluatedValue)

                    pushMemval(evaluatedValue)

                    const memoryChange: MemoryChange = {
                        type: "write_property",
                        ref: evaluatedObject.ref,
                        property: stringProperty,
                        value: evaluatedValue,
                    }
                    addEvaluatedStep({ astNode, scopeIndex: lastScopeIndex, memoryChange })
                } else {
                    pushMemval(evaluatedValue)
                    addEvaluatedStep({ astNode, scopeIndex: lastScopeIndex })
                }
            } else {
                const identifier = getIdentifierFromPattern(astNode.left)
                if (identifier) {
                    const lookupResult = lookupVariable(identifier.name, lastScopeIndex)
                    if (lookupResult === -1) {
                        createErrorObject('ReferenceError', `${identifier.name} is not defined`)
                        addErrorThrownStep({ astNode, scopeIndex: lastScopeIndex })
                        throw BUBBLE_UP_VALUE.THROW
                    }

                    traverseAST(astNode.right, options)

                    const evaluatedRight = popMemval()
                    const evaluatedLeft = lookupResult.value
                    // TODO: reference have problem.
                    const leftRaw = JSON.stringify(evaluatedLeft.value)
                    const rightRaw = JSON.stringify(evaluatedRight.value)
                    const value = eval(`${leftRaw}${astNode.operator.replace("=", "")}${rightRaw}`)
                    const evaluatedValue = { type: "primitive", value } as const

                    const targetScopeIndex = writeVariable(identifier.name, evaluatedValue, lastScopeIndex)
                    pushMemval(evaluatedValue)

                    const memoryChange: MemoryChange = {
                        type: "write_variable",
                        scopeIndex: targetScopeIndex,
                        variableName: identifier.name,
                        value: evaluatedValue,
                    }
                    addEvaluatedStep({ astNode, scopeIndex: lastScopeIndex, memoryChange })
                }
            }
        }
    }

    nodeHandlers["ConditionalExpression"] = (astNode, options) => {
        addEvaluatingStep({ astNode, scopeIndex: lastScopeIndex })

        traverseAST(astNode.test, options)

        const evaluatedTest = popMemval()
        if (evaluatedTest.value) {
            traverseAST(astNode.consequent, options)
        } else {
            traverseAST(astNode.alternate, options)
        }

        popMemval()
        addEvaluatedStep({ astNode, scopeIndex: lastScopeIndex })
    }

    nodeHandlers["ArrayExpression"] = (astNode, options) => {
        addEvaluatingStep({ astNode, scopeIndex: lastScopeIndex })

        for (const element of astNode.elements) {
            if (element) {
                traverseAST(element, options)
            } else {
                pushMemval(UNDEFINED)
            }
        }

        const elements: JSValue[] = []
        forEach(astNode.elements, () => {
            elements.unshift(popMemval())
        })

        const object = createHeapObject({
            elements
        })
        pushMemval({ type: "reference", ref: lastRef })

        const memoryChange: MemoryChange = {
            type: "create_heap_object",
            ref: lastRef,
            value: object,
        }
        return addEvaluatedStep({ astNode, scopeIndex: lastScopeIndex, memoryChange })
    }

    nodeHandlers["ObjectExpression"] = (astNode, options) => {
        addEvaluatingStep({ astNode, scopeIndex: lastScopeIndex })

        const properties: Record<string, JSValue> = {}
        for (const property of astNode.properties) {
            traverseAST(property.value, options)
        }

        for (let i = astNode.properties.length - 1; i >= 0; i--) {
            const property = astNode.properties[i]
            const keyNode = property.key
            const key = keyNode.name || keyNode.value
            properties[key] = popMemval()
        }

        const object = createHeapObject({ properties })
        pushMemval({ type: "reference", ref: lastRef })

        const memoryChange: MemoryChange = {
            type: "create_heap_object",
            ref: lastRef,
            value: object,
        }
        return addEvaluatedStep({ astNode, scopeIndex: lastScopeIndex, memoryChange })
    }

    nodeHandlers["MemberExpression"] = (astNode, options) => {
        addEvaluatingStep({ astNode, scopeIndex: lastScopeIndex })

        traverseAST(astNode.object, options)

        let evaluatedValue: JSValue = UNDEFINED

        const evaluatedObject = readMemval()
        if (evaluatedObject.type === "reference") {
            if (astNode.computed) {
                traverseAST(astNode.property, options)
                const evaluatedProperty = popMemval()
                evaluatedValue = readProperty(evaluatedObject.ref, evaluatedProperty.value)
            } else {
                evaluatedValue = readProperty(evaluatedObject.ref, astNode.property.name)
            }
        }

        if (evaluatedObject.type === "primitive") {
            if (astNode.computed) {
                traverseAST(astNode.property, options)
                const evaluatedProperty = popMemval()

                if (evaluatedObject === UNDEFINED) {
                    popMemval()
                    createErrorObject('TypeError', `Cannot read properties of undefined (reading ${evaluatedProperty.value})`)
                    addErrorThrownStep({ astNode, scopeIndex: lastScopeIndex })
                    throw BUBBLE_UP_VALUE.THROW
                }
            } else {
                if (evaluatedObject === UNDEFINED) {
                    popMemval()
                    createErrorObject('TypeError', `Cannot read properties of undefined (reading ${astNode.property.name})`)
                    addErrorThrownStep({ astNode, scopeIndex: lastScopeIndex })
                    throw BUBBLE_UP_VALUE.THROW
                }
            }
        }

        popMemval()
        pushMemval(evaluatedValue)
        return addEvaluatedStep({ astNode, scopeIndex: lastScopeIndex })
    }

    nodeHandlers["ArrowFunctionExpression"] = (astNode) => {
        addEvaluatingStep({ astNode, scopeIndex: lastScopeIndex })

        const object = createHeapObject({ node: astNode })
        pushMemval({ type: "reference", ref: lastRef })

        const memoryChange: MemoryChange = {
            type: "create_heap_object",
            ref: lastRef,
            value: object,
        }
        addEvaluatedStep({ astNode, scopeIndex: lastScopeIndex, memoryChange })
    }

    nodeHandlers["IfStatement"] = (astNode, options) => {
        addExecutingStep({ astNode, scopeIndex: lastScopeIndex })

        traverseAST(astNode.test, options)

        const evaluatedTest = popMemval()

        if (evaluatedTest.value) {
            traverseAST(astNode.consequent, options)
        } if (astNode.alternate) {
            traverseAST(astNode.alternate, options)
        }

        return addExecutedStep({ astNode, scopeIndex: lastScopeIndex })
    }

    nodeHandlers["ForStatement"] = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        addExecutingStep(astNode, scopeIndex)

        lastScopeIndex++
        scopeIndex = lastScopeIndex

        const lastStep = creationPhase(astNode)
        if (lastStep?.errorThrown) return lastStep

        if (astNode.init) {
            const initStep = executionPhase(astNode.init, scopeIndex)
            if (initStep?.errorThrown) {
                destructionPhase(astNode, scopeIndex, initStep)
                return initStep
            }
            removeMemVal(initStep?.evaluatedValue)
        }

        let testStep: ExecStep | undefined
        do {
            if (astNode.test) {
                testStep = executionPhase(astNode.test, scopeIndex)
                if (testStep?.errorThrown) {
                    destructionPhase(astNode, scopeIndex, testStep)
                    return testStep
                }
                removeMemVal(testStep?.evaluatedValue)
            } else {
                testStep = { type: "primitive", value: true }
            }

            if (testStep?.evaluatedValue?.value) {
                const bodyStep = traverseAST(astNode.body, scopeIndex, false)
                if (bodyStep?.evaluatedValue || bodyStep?.errorThrown) {
                    destructionPhase(astNode, scopeIndex, bodyStep)
                    return bodyStep
                }
                removeMemVal(bodyStep?.evaluatedValue)

                if (astNode.update) {
                    const updateStep = executionPhase(astNode.update, lastStep.scopeIndex)
                    if (updateStep?.errorThrown) {
                        destructionPhase(astNode, scopeIndex, updateStep)
                        return updateStep
                    }
                    removeMemVal(updateStep?.evaluatedValue)
                }
            } else {
                destructionPhase(astNode, scopeIndex, lastStep)
            }
        } while (testStep?.evaluatedValue?.value)
    }

    nodeHandlers["ContinueStatement"] = (astNode) => {
        addExecutingStep({ astNode, scopeIndex: lastScopeIndex })
        return addExecutedStep({ astNode, scopeIndex: lastScopeIndex })
    }

    nodeHandlers["UpdateExpression"] = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        addEvaluatingStep(astNode, scopeIndex)

        let objectStep
        let propertyStep
        let property

        if (astNode.argument.type === "MemberExpression") {
            objectStep = executionPhase(astNode.argument.object, scopeIndex)
            if (objectStep && objectStep.errorThrown) {
                return objectStep
            }

            if (astNode.argument.computed) {
                propertyStep = executionPhase(astNode.argument.property, scopeIndex)
                if (propertyStep && propertyStep.errorThrown) {
                    return propertyStep
                }
                property = propertyStep.evaluatedValue
            } else {
                property = { type: "primitive", value: astNode.argument.property.name }
                objectStep?.memorySnapshot.memVal.push(property)
                addMemVal(property)
            }
        }

        const evaluatedStep: ExecStep = {
            node: astNode,
            phase: "execution",
            scopeIndex,
            memoryChange: {
                type: "none",
            },
            executing: false,
            executed: false,
            evaluating: false,
            evaluated: true,
            evaluatedValue: undefined,
        }

        let currentValue: JSValue | undefined
        let evaluatedValue: JSValue | undefined

        if (astNode.argument.type === "Identifier") {
            const variable = lookupVariable(astNode.argument.name, scopeIndex)
            if (variable === -1) {
                const error = createErrorObject('ReferenceError', `${astNode.argument.name} is not defined`)
                return addErrorThrownStep(astNode, scopeIndex, error)
            }
            currentValue = variable.value

            if (astNode.operator === '++') {
                evaluatedValue = { type: "primitive", value: currentValue.value + 1 }
            } else if (astNode.operator === '--') {
                evaluatedValue = { type: "primitive", value: currentValue.value - 1 }
            }
            const targetScopeIndex = writeVariable(astNode.argument.name, evaluatedValue, scopeIndex)

            evaluatedStep.memoryChange = {
                type: "write_variable",
                scopeIndex: targetScopeIndex,
                variableName: astNode.argument.name,
                value: evaluatedValue,
            }
        } else {
            if (objectStep?.evaluatedValue?.type !== "reference") {
                const error = createErrorObject('TypeError', `Cannot read properties of undefined (reading ${property?.value})`)
                return addErrorThrownStep(astNode, scopeIndex, error)
            }

            const ref = objectStep?.evaluatedValue?.ref
            const object = heap[ref]
            if (object) {
                if (object.type === "object") {
                    currentValue = object.properties[property.value]
                } else if (object.type === "array") {
                    currentValue = object.elements[property.value]
                }
            }

            if (currentValue === undefined) {
                currentValue = { type: "primitive", value: undefined }
            }

            if (astNode.operator === '++') {
                evaluatedValue = { type: "primitive", value: currentValue.value + 1 }
            } else if (astNode.operator === '--') {
                evaluatedValue = { type: "primitive", value: currentValue.value - 1 }
            }

            removeMemVal(objectStep?.evaluatedValue)
            removeMemVal(property)

            if (object) {
                const propertyRef = writeProperty(ref, property.value, evaluatedValue)
                if (propertyRef === -1) {
                    const error = createErrorObject('TypeError', `Cannot set properties of undefined (setting '${property}')`)
                    return addErrorThrownStep(astNode, scopeIndex, error)
                }

                evaluatedStep.memoryChange = {
                    type: "write_property",
                    ref,
                    property,
                    value: evaluatedValue,
                }
            }
        }

        if (astNode.prefix || isNaN(evaluatedValue.value)) {
            evaluatedStep.evaluatedValue = evaluatedValue
        } else {
            evaluatedStep.evaluatedValue = currentValue
        }
        addMemVal(evaluatedStep.evaluatedValue)
        return addStep(evaluatedStep)
    }

    nodeHandlers["EmptyStatement"] = (astNode) => {
        addExecutingStep({ astNode, scopeIndex: lastScopeIndex })
        addExecutedStep({ astNode, scopeIndex: lastScopeIndex })
    }

    const isBlock = (node: ESTree.BaseNode): boolean => {
        return node.type === "BlockStatement" || node.type === "Program"
    }

    const isStrict = (astNode: ESTree.BaseNode, options: TraverseASTOptions): boolean => {
        if (options.strict) return true
        if (astNode.type === "Program" || options.callee) {
            const firstStatement = (astNode as ESTree.BlockStatement).body[0]
            if (firstStatement && firstStatement.type === "ExpressionStatement") {
                const expr = firstStatement.expression
                return expr.type === "Literal" && (expr as ESTree.Literal).value === "use strict"
            }
        }
        return false
    }

    // --- Simulation Execution --- 
    function traverseAST(
        astNode: ESTree.BaseNode,
        options: TraverseASTOptions
    ) {
        if (isBlock(astNode)) {
            try {
                options.strict = isStrict(astNode, options)

                lastScopeIndex++
                if (options.callee) {
                    options.parentScopeIndex = lastScopeIndex
                }

                const blockNode = astNode as ESTree.BlockStatement

                // Phase 1: Creation - hoisting and declarations
                addPushScopeStep(blockNode)
                const declarations: Declaration[] = []

                if (options.callee || options.catch) {
                    const params = options.callee ? options.callee.params : options.catch ? [options.catch.param as ESTree.Pattern] : []
                    const args = []

                    if (options.callee) {
                        const argsCount = popMemval()
                        for (let i = 0; i < argsCount.value; i++) {
                            const arg = popMemval()
                            args.push(arg)
                        }
                        delete options.callee
                    } else if (options.catch) {
                        args.push(popMemval())
                        delete options.catch
                    }

                    for (const param of params) {
                        let paramValue = args.pop() || UNDEFINED
                        if (param.type === "AssignmentPattern" && paramValue === UNDEFINED) {
                            traverseAST(param.right, options)
                            paramValue = popMemval()
                        }
                        const identifier = getIdentifierFromPattern(param)
                        if (!identifier) continue

                        const declaration = newDeclaration(identifier.name, "param", lastScopeIndex, paramValue)
                        declarations.push(declaration)
                    }
                }

                for (const node of blockNode.body) {
                    if (node.type === "FunctionDeclaration") {
                        createHeapObject({ node })
                        const declaration = newDeclaration(
                            node.id.name,
                            "function",
                            options.parentScopeIndex,
                            { type: "reference", ref: lastRef }
                        )
                        declarations.push(declaration)
                    }

                    if (node.type === "VariableDeclaration") {
                        for (const declarator of node.declarations) {
                            const identifier = getIdentifierFromPattern(declarator.id)
                            if (!identifier) continue

                            const initialValue = node.kind === "var" ? UNDEFINED : TDZ
                            const scopeIndex = node.kind === "var" ? options.parentScopeIndex : lastScopeIndex
                            const declaration = newDeclaration(
                                identifier.name,
                                node.kind,
                                scopeIndex,
                                initialValue
                            )
                            declarations.push(declaration)
                        }
                    }
                }

                addHoistingStep(blockNode, lastScopeIndex, declarations)

                // Phase 2: Execution  
                const handler = nodeHandlers[astNode.type as keyof typeof nodeHandlers] as NodeHandler<typeof astNode>
                if (handler) {
                    handler(astNode, options)
                } else {
                    console.warn(`Execution Pass: Unhandled node type - ${astNode.type}`)
                }

                // Phase 3: Destruction - except for global scope
                if (lastScopeIndex !== 0) {
                    addPopScopeStep({ astNode, scopeIndex: lastScopeIndex })
                    lastScopeIndex--
                }
            } catch (bubbleUp) {
                if (lastScopeIndex !== 0) {
                    addPopScopeStep({ astNode, scopeIndex: lastScopeIndex, bubbleUp: bubbleUp as BubbleUp })
                    lastScopeIndex--
                    throw bubbleUp
                }
            }
        } else {
            const handler = nodeHandlers[astNode.type as keyof typeof nodeHandlers] as NodeHandler<typeof astNode>
            if (handler) {
                handler(astNode, options)
            } else {
                console.warn(`Execution Pass: Unhandled node type - ${astNode.type}`)
            }
        }
    }

    traverseAST(astNode, { parentScopeIndex: 0 })

    console.log("Simulation finished. Steps:", steps.length)
    return steps
}

