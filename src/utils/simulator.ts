import * as ESTree from 'estree'
import {
    UNDEFINED,
    TDZ,
    BUBBLE_UP_TYPE,
    SCOPE_KIND,
    DECLARATION_TYPE,
    HEAP_OBJECT_TYPE,
    ExecStep,
    JSValue,
    Heap,
    MemoryChange,
    HeapObject,
    HeapRef,
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
    NAN,
} from "../types/simulation"
import { cloneDeep, forEach } from "lodash" // Import cloneDeep from lodash
import { coerceBinaryOperator, toBoolean } from './coercion'

export const simulateExecution = (astNode: ESTree.Program | null): ExecStep[] => {
    if (!astNode) {
        console.error("Invalid AST provided to simulateExecution.")
        return []
    }

    const steps: ExecStep[] = [
        {
            index: 0,
            node: astNode,
            type: EXEC_STEP_TYPE.INITIAL,
            memorySnapshot: { scopes: [], heap: {}, memval: [] },
            scopeIndex: 0,
            memoryChange: { type: "none" },
            memvalChanges: [],
        }
    ]
    const scopes: Scope[] = []
    const heap: Heap = {}
    const memval: Memval[] = []

    let lastScopeIndex = -1
    let lastRef: HeapRef = -1
    let stepCounter: number = 1
    let stepMemoryChange: MemoryChange = { type: "none" }
    let stepMemvalChanges: MemvalChange[] = []
    let declarations: Declaration[] = []

    // --- Helper Functions ---
    const createMemorySnapshot = (): ExecStep["memorySnapshot"] => {
        // Crucial: Use a reliable deep copy mechanism here!
        // Use lodash cloneDeep
        return cloneDeep({ scopes, heap, memval })
    }

    // --- Step Helpers ---
    const addStep = (astNode: ESTree.BaseNode, type: ExecStepType, bubbleUp?: BubbleUp) => {
        const snapshot = createMemorySnapshot()
        const step = {
            index: stepCounter++,
            node: astNode,
            type,
            scopeIndex: lastScopeIndex,
            memorySnapshot: snapshot,
            memoryChange: stepMemoryChange,
            memvalChanges: stepMemvalChanges,
            bubbleUp,
        }
        steps.push(step)

        stepMemoryChange = { type: "none" }
        stepMemvalChanges = []
    }

    const addPushScopeStep = (astNode: ESTree.BaseNode, kind: ScopeKind) => {
        const type = kind === SCOPE_KIND.PROGRAM ? "global" : kind === SCOPE_KIND.FUNCTION ? "function" : "block"
        const scope = newScope(type)
        stepMemoryChange = { type: "push_scope", kind, scope }

        addStep(astNode, EXEC_STEP_TYPE.PUSH_SCOPE)
    }

    const addHoistingStep = (astNode: ESTree.BaseNode) => {
        stepMemoryChange = { type: "declaration", declarations }
        addStep(astNode, EXEC_STEP_TYPE.HOISTING)
        declarations = []
    }

    const addExecutingStep = (astNode: ESTree.BaseNode) => {
        addStep(astNode, EXEC_STEP_TYPE.EXECUTING)
    }

    const addExecutedStep = (
        astNode: ESTree.BaseNode,
        bubbleUp?: BubbleUp
    ) => {
        addStep(astNode, EXEC_STEP_TYPE.EXECUTED, bubbleUp)
    }

    const addEvaluatingStep = (astNode: ESTree.BaseNode) => {
        addStep(astNode, EXEC_STEP_TYPE.EVALUATING)
    }

    const addEvaluatedStep = (astNode: ESTree.BaseNode, bubbleUp?: BubbleUp) => {
        addStep(astNode, EXEC_STEP_TYPE.EVALUATED, bubbleUp)
    }

    const addThrownStep = (astNode: ESTree.BaseNode) => {
        addStep(astNode, EXEC_STEP_TYPE.EXECUTED, BUBBLE_UP_TYPE.THROW)
        throw BUBBLE_UP_TYPE.THROW
    }

    const addPopScopeStep = (astNode: ESTree.BaseNode, kind: ScopeKind, bubbleUp?: BubbleUp) => {
        console.log(kind)
        scopes.splice(lastScopeIndex, 1)
        stepMemoryChange = { type: "pop_scope", kind, scopeIndex: lastScopeIndex }
        addStep(astNode, EXEC_STEP_TYPE.POP_SCOPE, bubbleUp)
    }

    // --- Memory Manipulation Helpers (Simplified placeholders) ---
    const newScope = (type: ScopeType): Scope => {
        const scope = { type, variables: {} }
        scopes.push(scope)
        return scope
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
                type: HEAP_OBJECT_TYPE.ARRAY,
                properties: commonProperties,
                elements: elements
            }

        } else if (node) {
            object = {
                type: HEAP_OBJECT_TYPE.FUNCTION,
                properties: commonProperties,
                node: node
            }
        } else {
            object = {
                type: HEAP_OBJECT_TYPE.OBJECT,
                properties: commonProperties
            }
        }

        heap[++lastRef] = object
        stepMemoryChange = { type: "create_heap_object", ref: lastRef, value: object }
        return object
    }

    const lookupVariable = (name: string): { variable: VariableValue, scopeIndex: number } | undefined => {
        for (let i = lastScopeIndex; i >= 0; i--) {
            if (Object.prototype.hasOwnProperty.call(scopes[i].variables, name)) {
                return { variable: scopes[i].variables[name], scopeIndex: i }
            }
        }
    }

    const newDeclaration = (
        name: string,
        initialValue: JSValue,
        declarationType: DeclarationType,
        scopeIndex: number,
    ) => {
        scopes[scopeIndex].variables[name] = {
            declarationType,
            value: initialValue,
        }
        declarations.push({
            declarationType,
            variableName: name,
            initialValue,
            scopeIndex
        })
    }

    const writeVariable = (name: string, value: JSValue, declarationType: DeclarationType, parentScopeIndex: number) => {
        const lookupResult = lookupVariable(name)
        let scopeIndex = parentScopeIndex
        if (lookupResult) {
            // if (lookupResult.variable.declarationType === declarationType || declarationType === DECLARATION_TYPE.FUNCTION) {
            scopes[lookupResult.scopeIndex].variables[name] = { declarationType, value }
            scopeIndex = lookupResult.scopeIndex
            // }
        } else {
            scopes[scopeIndex].variables[name] = { declarationType, value }
        }
        stepMemoryChange = {
            type: "write_variable",
            scopeIndex,
            variableName: name,
            value
        }

    }

    const writeProperty = (ref: number, property: string, value: JSValue) => {
        const heapObj = heap[ref]

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

        stepMemoryChange = {
            type: "write_property",
            ref,
            property,
            value
        }
    }

    const readProperty = (ref: number, property: string): JSValue => {
        const heapObj = heap[ref]
        if (heapObj.type === HEAP_OBJECT_TYPE.ARRAY) {
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
    const pushMemval = (value: Memval) => {
        memval.push(value)
        stepMemvalChanges.push({ type: "push", value })
    }

    const popMemval = (): Memval => {
        const value = memval.pop()
        if (value) {
            stepMemvalChanges.push({ type: "pop", value })
        }
        return value as Memval
    }

    const readMemval = (shift?: number): Memval => {
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

    const execHandlers: NodeHandlerMap = {}

    execHandlers["Program"] = (astNode, options) => {
        for (const statement of astNode.body) {
            if (statement.type === "FunctionDeclaration") {
                continue
            }
            traverseExec(statement, options)
        }
    }

    execHandlers["BlockStatement"] = (astNode, options) => {
        for (const statement of astNode.body) {
            if (statement.type === "FunctionDeclaration") {
                continue
            }
            traverseExec(statement, options)
        }
    }

    execHandlers["ExpressionStatement"] = (astNode, options) => {
        addExecutingStep(astNode)

        traverseExec(astNode.expression, options)

        popMemval()
        addExecutedStep(astNode)
    }

    execHandlers["Literal"] = (astNode) => {
        addEvaluatingStep(astNode)

        const evaluatedValue: JSValue = { type: "primitive", value: astNode.value }
        pushMemval(evaluatedValue)

        addEvaluatedStep(astNode)
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

    execHandlers["VariableDeclaration"] = (astNode, options) => {
        for (const declarator of astNode.declarations) {
            addExecutingStep(astNode)

            let evaluatedValue: JSValue = UNDEFINED
            if (declarator.init) {
                traverseExec(declarator.init, options)
                evaluatedValue = popMemval()
            }

            const identifier = getIdentifierFromPattern(declarator.id)
            if (identifier) {
                const declarationType = astNode.kind === DECLARATION_TYPE.CONST ? DECLARATION_TYPE.CONST : astNode.kind === DECLARATION_TYPE.LET ? DECLARATION_TYPE.LET : DECLARATION_TYPE.VAR
                writeVariable(identifier.name, evaluatedValue, declarationType, options.parentScopeIndex)
            }
            addExecutedStep(astNode)
        }
    }

    execHandlers["CallExpression"] = (astNode, options) => {
        addEvaluatingStep(astNode)

        traverseExec(astNode.callee, options)

        for (const arg of astNode.arguments) {
            traverseExec(arg, options)
        }
        const args: JSValue[] = []
        astNode.arguments.forEach(() => args.unshift(popMemval()))

        const fnRef = popMemval()
        if (fnRef.type === "reference") {
            const object = heap[fnRef.ref]
            if (object.type === HEAP_OBJECT_TYPE.FUNCTION) {
                args.forEach(arg => pushMemval(arg))
                pushMemval({ type: 'primitive', value: args.length })
                pushMemval(fnRef)

                addStep(astNode, EXEC_STEP_TYPE.FUNCTION_CALL)

                popMemval()

                try {
                    traverseExec(
                        object.node.body,
                        { ...options, callee: object.node }
                    )
                    if (object.node.body.type === "BlockStatement") {
                        pushMemval(UNDEFINED)
                    }
                    addEvaluatedStep(astNode)
                } catch (bubbleUp) {
                    if (bubbleUp === BUBBLE_UP_TYPE.RETURN) {
                        addEvaluatedStep(astNode, bubbleUp)
                    } else if (bubbleUp === BUBBLE_UP_TYPE.THROW) {
                        addThrownStep(astNode)
                    } else {
                        throw bubbleUp
                    }
                }
            } else {
                createErrorObject('TypeError', `${astNode.callee.name} is not a function`)
                addThrownStep(astNode)
                throw BUBBLE_UP_TYPE.THROW
            }
        } else {
            createErrorObject('ReferenceError', `${astNode.callee.name} is not a function`)
            addThrownStep(astNode)
        }
    }

    execHandlers["Identifier"] = (astNode) => {
        addEvaluatingStep(astNode)

        if (astNode.name === 'undefined') {
            pushMemval(UNDEFINED)
            addEvaluatedStep(astNode)
        } else if (astNode.name === 'NaN') {
            pushMemval(NAN)
            addEvaluatedStep(astNode)
        } else {
            const lookupResult = lookupVariable(astNode.name)
            if (lookupResult) {
                const evaluatedValue = lookupResult.variable.value
                if (evaluatedValue === TDZ) {
                    createErrorObject('ReferenceError', `Cannot access '${astNode.name}' before initialization`)
                    addThrownStep(astNode)
                } else {
                    pushMemval(evaluatedValue)
                    addEvaluatedStep(astNode)
                }
            } else {
                createErrorObject('ReferenceError', `${astNode.name} is not defined`)
                addThrownStep(astNode)
            }
        }
    }

    execHandlers["BinaryExpression"] = (astNode, options) => {
        addEvaluatingStep(astNode)

        traverseExec(astNode.left, options)
        traverseExec(astNode.right, options)

        const evaluatedRight = popMemval()
        const evaluatedLeft = popMemval()

        try {
            const evaluatedValue = coerceBinaryOperator(astNode.operator, evaluatedLeft, evaluatedRight, heap)
            console.log(evaluatedValue)
            pushMemval(evaluatedValue)
            addEvaluatedStep(astNode)

        } catch (error: unknown) {
            createErrorObject('TypeError', error instanceof Error ? error.message : 'Unknown error')
            addThrownStep(astNode)
        }
    }

    execHandlers["LogicalExpression"] = (astNode, options) => {
        addEvaluatingStep(astNode)

        traverseExec(astNode.left, options)
        const evaluatedLeft = readMemval()
        const coercionLeft = toBoolean(readMemval())
        let evaluatedValue: JSValue

        switch (astNode.operator) {
            case "&&": {
                if (coercionLeft) {
                    traverseExec(astNode.right, options)
                    evaluatedValue = popMemval()
                    popMemval()
                } else {
                    evaluatedValue = popMemval()
                }
                break
            }
            case "||": {
                if (coercionLeft) {
                    evaluatedValue = popMemval()
                } else {
                    traverseExec(astNode.right, options)
                    evaluatedValue = popMemval()
                    popMemval()
                }
                break
            }
            case "??": {
                if (evaluatedLeft.type === "primitive" && (evaluatedLeft.value === null || evaluatedLeft.value === undefined)) {
                    traverseExec(astNode.right, options)
                    evaluatedValue = popMemval()
                    popMemval()
                } else {
                    evaluatedValue = popMemval()
                }
                break
            }
        }

        pushMemval(evaluatedValue)
        addEvaluatedStep(astNode)
    }

    execHandlers["ReturnStatement"] = (astNode, options) => {
        addExecutingStep(astNode)
        if (astNode.argument) {
            traverseExec(astNode.argument, options)
        } else {
            pushMemval(UNDEFINED)
        }
        addExecutedStep(astNode, BUBBLE_UP_TYPE.RETURN)
        throw BUBBLE_UP_TYPE.RETURN
    }

    execHandlers["ThrowStatement"] = (astNode, options) => {
        addExecutingStep(astNode)
        traverseExec(astNode.argument, options)
        addThrownStep(astNode)
    }

    execHandlers["TryStatement"] = (astNode, options) => {
        addExecutingStep(astNode)

        const finalizerHandler = () => {
            if (astNode.finalizer) {
                try {
                    traverseExec(astNode.finalizer, options)
                } catch (finalizerBubbleUp) {
                    if (finalizerBubbleUp === BUBBLE_UP_TYPE.THROW) {
                        addThrownStep(astNode)
                    }
                    addExecutedStep(astNode)
                    throw finalizerBubbleUp
                }
            }
        }

        const catchHandler = () => {
            if (astNode.handler) {
                try {
                    traverseExec(astNode.handler.body, { ...options, catch: astNode.handler })
                } catch (catchBubbleUp) {
                    if (astNode.finalizer) {
                        const catchValue = popMemval()
                        finalizerHandler()
                        pushMemval(catchValue)
                    }

                    if (catchBubbleUp === BUBBLE_UP_TYPE.THROW) {
                        addThrownStep(astNode)
                    }
                    addExecutedStep(astNode)
                    throw catchBubbleUp
                }
            }
        }

        try {
            traverseExec(astNode.block, options)
            finalizerHandler()
            addExecutedStep(astNode)
        } catch (tryBubbleUp) {
            if (tryBubbleUp === BUBBLE_UP_TYPE.THROW) {
                if (astNode.handler) {
                    catchHandler()
                    finalizerHandler()
                    addExecutedStep(astNode)
                } else {
                    if (astNode.finalizer) {
                        finalizerHandler()
                    }
                    addThrownStep(astNode)
                }
            }

            if (tryBubbleUp === BUBBLE_UP_TYPE.RETURN) {
                if (astNode.finalizer) {
                    const tryValue = popMemval()
                    finalizerHandler()
                    pushMemval(tryValue)
                }
                addExecutedStep(astNode)
                throw tryBubbleUp
            }
        }
    }

    execHandlers["AssignmentExpression"] = (astNode, options) => {
        addEvaluatingStep(astNode)

        if (astNode.operator === "=") {
            // Assignment
            if (astNode.left.type === "MemberExpression") {
                const memberExpression = astNode.left
                traverseExec(memberExpression.object, options)

                if (memberExpression.computed) {
                    traverseExec(memberExpression.property, options)
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
                    addThrownStep(astNode)
                }

                traverseExec(astNode.right, options)
                const evaluatedValue = popMemval()
                const evaluatedProperty = popMemval()
                const evaluatedObject = popMemval()

                if (evaluatedObject.type === "reference" && evaluatedProperty.type === "primitive") {
                    const stringProperty = String(evaluatedProperty.value)
                    writeProperty(evaluatedObject.ref, stringProperty, evaluatedValue)
                    pushMemval(evaluatedValue)
                    addEvaluatedStep(astNode)
                } else {
                    pushMemval(evaluatedValue)
                    addEvaluatedStep(astNode)
                }
            } else {
                const identifier = getIdentifierFromPattern(astNode.left)
                if (identifier) {
                    traverseExec(astNode.right, options)
                    const evaluatedValue = popMemval()

                    const lookupResult = lookupVariable(identifier.name)
                    if (lookupResult) {
                        if (lookupResult.variable.value === TDZ) {
                            createErrorObject('ReferenceError', `Cannot access '${identifier.name}' before initialization`)
                            addThrownStep(astNode)
                        } else {
                            writeVariable(
                                identifier.name,
                                evaluatedValue,
                                lookupResult.variable.declarationType,
                                options.parentScopeIndex
                            )
                        }
                    } else {
                        if (options.strict) {
                            createErrorObject('ReferenceError', `${identifier.name} is not defined`)
                            addThrownStep(astNode)
                        } else {
                            newDeclaration(identifier.name, evaluatedValue, DECLARATION_TYPE.GLOBAL, 0)
                        }
                    }

                    pushMemval(evaluatedValue)
                    addEvaluatedStep(astNode)
                }
            }
        } else {
            // Update && Assignment
            if (astNode.left.type === "MemberExpression") {
                const memberExpression = astNode.left
                traverseExec(memberExpression.object, options)

                if (memberExpression.computed) {
                    traverseExec(memberExpression.property, options)
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
                    addThrownStep(astNode)
                }

                traverseExec(astNode.right, options)

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
                    addEvaluatedStep(astNode)
                } else {
                    pushMemval(evaluatedValue)
                    addEvaluatedStep(astNode)
                }
            } else {
                const identifier = getIdentifierFromPattern(astNode.left)
                if (identifier) {
                    const lookupResult = lookupVariable(identifier.name)
                    if (lookupResult) {
                        traverseExec(astNode.right, options)

                        const evaluatedRight = popMemval()
                        const evaluatedLeft = lookupResult.variable.value
                        // TODO: reference have problem.
                        const leftRaw = JSON.stringify(evaluatedLeft.value)
                        const rightRaw = JSON.stringify(evaluatedRight.value)
                        const value = eval(`${leftRaw}${astNode.operator.replace("=", "")}${rightRaw}`)
                        const evaluatedValue = { type: "primitive", value } as const

                        writeVariable(
                            identifier.name,
                            evaluatedValue,
                            lookupResult.variable.declarationType,
                            options.parentScopeIndex
                        )
                        pushMemval(evaluatedValue)
                        addEvaluatedStep(astNode)
                    } else {
                        createErrorObject('ReferenceError', `${identifier.name} is not defined`)
                        addThrownStep(astNode)
                    }
                }
            }
        }
    }

    execHandlers["ConditionalExpression"] = (astNode, options) => {
        addEvaluatingStep(astNode)

        traverseExec(astNode.test, options)

        const evaluatedTest = popMemval()
        const coercionValue = toBoolean(evaluatedTest)
        if (coercionValue) {
            traverseExec(astNode.consequent, options)
        } else {
            traverseExec(astNode.alternate, options)
        }

        popMemval()
        addEvaluatedStep(astNode)
    }

    execHandlers["ArrayExpression"] = (astNode, options) => {
        addEvaluatingStep(astNode)

        for (const element of astNode.elements) {
            if (element) {
                traverseExec(element, options)
            } else {
                pushMemval(UNDEFINED)
            }
        }

        const elements: JSValue[] = []
        forEach(astNode.elements, () => {
            elements.unshift(popMemval())
        })

        createHeapObject({ elements })
        pushMemval({ type: "reference", ref: lastRef })
        addEvaluatedStep(astNode)
    }

    execHandlers["ObjectExpression"] = (astNode, options) => {
        addEvaluatingStep(astNode)

        const properties: Record<string, JSValue> = {}
        for (const property of astNode.properties) {
            traverseExec(property.value, options)
        }

        for (let i = astNode.properties.length - 1; i >= 0; i--) {
            const property = astNode.properties[i]
            const keyNode = property.key
            const key = keyNode.name || keyNode.value
            properties[key] = popMemval()
        }

        createHeapObject({ properties })
        pushMemval({ type: "reference", ref: lastRef })
        addEvaluatedStep(astNode)
    }

    execHandlers["MemberExpression"] = (astNode, options) => {
        addEvaluatingStep(astNode)

        traverseExec(astNode.object, options)

        let evaluatedValue: JSValue = UNDEFINED

        const evaluatedObject = readMemval()
        if (evaluatedObject.type === "reference") {
            if (astNode.computed) {
                traverseExec(astNode.property, options)
                const evaluatedProperty = popMemval()
                evaluatedValue = readProperty(evaluatedObject.ref, evaluatedProperty.value)
            } else {
                evaluatedValue = readProperty(evaluatedObject.ref, astNode.property.name)
            }
        }

        if (evaluatedObject.type === "primitive") {
            if (astNode.computed) {
                traverseExec(astNode.property, options)
                const evaluatedProperty = popMemval()

                if (evaluatedObject === UNDEFINED) {
                    popMemval()
                    createErrorObject('TypeError', `Cannot read properties of undefined (reading ${evaluatedProperty.value})`)
                    addThrownStep(astNode)
                }
            } else {
                if (evaluatedObject === UNDEFINED) {
                    popMemval()
                    createErrorObject('TypeError', `Cannot read properties of undefined (reading ${astNode.property.name})`)
                    addThrownStep(astNode)
                }
            }
        }

        popMemval()
        pushMemval(evaluatedValue)
        return addEvaluatedStep(astNode)
    }

    execHandlers["ArrowFunctionExpression"] = (astNode) => {
        addEvaluatingStep(astNode)

        createHeapObject({ node: astNode })
        pushMemval({ type: "reference", ref: lastRef })
        addEvaluatedStep(astNode)
    }

    execHandlers["IfStatement"] = (astNode, options) => {
        addExecutingStep(astNode)

        traverseExec(astNode.test, options)
        const evaluatedTest = popMemval()
        const coercionValue = toBoolean(evaluatedTest)
        if (coercionValue) {
            traverseExec(astNode.consequent, options)
        } if (astNode.alternate) {
            traverseExec(astNode.alternate, options)
        }

        addExecutedStep(astNode)
    }

    execHandlers["ForStatement"] = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        addExecutingStep(astNode)

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
                const bodyStep = traverseExec(astNode.body, scopeIndex, false)
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

    execHandlers["ContinueStatement"] = (astNode) => {
        addExecutingStep(astNode)
        return addExecutedStep(astNode)
    }

    execHandlers["UpdateExpression"] = (astNode, options) => {
        console.log(astNode)
        addEvaluatingStep(astNode)

        if (astNode.argument.type === "MemberExpression") {
            const memberExpression = astNode.argument
            traverseExec(memberExpression.object, options)

            if (memberExpression.computed) {
                traverseExec(memberExpression.property, options)
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
                addThrownStep(astNode)
            }

            const evaluatedProperty = popMemval()
            const evaluatedObject = popMemval()

            let currentValue: JSValue = UNDEFINED
            if (evaluatedObject.type === "reference" && evaluatedProperty.type === "primitive") {
                currentValue = readProperty(evaluatedObject.ref, String(evaluatedProperty.value))
            }

            // TODO: reference have problem.
            const value = eval(`${currentValue.value}${astNode.operator[0]}1`)
            const evaluatedValue = { type: "primitive", value } as const
            if (evaluatedObject.type === "reference" && evaluatedProperty.type === "primitive") {
                const stringProperty = String(evaluatedProperty.value)
                writeProperty(evaluatedObject.ref, stringProperty, evaluatedValue)
                pushMemval(evaluatedValue)
                addEvaluatedStep(astNode)
            } else {
                pushMemval(evaluatedValue)
                addEvaluatedStep(astNode)
            }
        } else if (astNode.argument.type === 'Identifier') {
            const identifier = astNode.argument
            const lookupResult = lookupVariable(identifier.name)
            if (lookupResult) {
                // TODO: reference have problem.
                const value = eval(`${lookupResult.variable.value.value}${astNode.operator[0]}1`)
                const evaluatedValue = { type: "primitive", value } as const
                writeVariable(
                    identifier.name,
                    evaluatedValue,
                    lookupResult.variable.declarationType,
                    options.parentScopeIndex
                )

                if (astNode.operator === '++') {
                    if (astNode.prefix) {
                        pushMemval(evaluatedValue)
                    } else {
                        pushMemval({ type: "primitive", value: lookupResult.variable.value.value++ })
                    }
                } else if (astNode.operator === '--') {
                    if (astNode.prefix) {
                        pushMemval(evaluatedValue)
                    } else {
                        pushMemval({ type: "primitive", value: lookupResult.variable.value.value-- })
                    }
                }
                addEvaluatedStep(astNode)
            } else {
                createErrorObject('ReferenceError', `${identifier.name} is not defined`)
                addThrownStep(astNode)
            }
        } else {
            console.warn(`UpdateExpression: Unhandled argument type - ${astNode.argument.type}`)
        }
    }

    execHandlers["EmptyStatement"] = (astNode) => {
        addExecutingStep(astNode)
        addExecutedStep(astNode)
    }

    const isBlock = (node: ESTree.BaseNode): boolean => {
        return node.type === "BlockStatement" || node.type === "Program"
    }

    const isStrict = (astNode: ESTree.BaseNode, options: TraverseASTOptions): boolean => {
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


    const hoistingHandlers: NodeHandlerMap = {}
    hoistingHandlers["Program"] = (astNode, options) => {
        for (const node of astNode.body) {
            if (isBlock(node) || !options.isRoot) {
                traverseHoisting(node, options, false)
            } else {
                traverseHoisting(node, options, true)
            }
        }
    }
    hoistingHandlers["BlockStatement"] = (astNode, options) => {
        for (const node of astNode.body) {
            if (isBlock(node) || !options.isRoot) {
                traverseHoisting(node, options, false)
            } else {
                traverseHoisting(node, options, true)
            }
        }
    }
    hoistingHandlers["FunctionDeclaration"] = (astNode, options) => {
        const lookupResult = lookupVariable(astNode.id.name)
        if (lookupResult) {
            if (options.isRoot && lookupResult.scopeIndex !== lastScopeIndex) {
                if (lookupResult.variable.declarationType === DECLARATION_TYPE.VAR || lookupResult.variable.declarationType === DECLARATION_TYPE.FUNCTION) {
                    createHeapObject({ node: astNode })
                    writeVariable(
                        astNode.id.name,
                        { type: "reference", ref: lastRef },
                        DECLARATION_TYPE.FUNCTION,
                        options.parentScopeIndex
                    )
                } else {
                    createHeapObject({ node: astNode })
                    const initialValue = { type: "reference", ref: lastRef } as const
                    newDeclaration(
                        astNode.id.name,
                        initialValue,
                        DECLARATION_TYPE.FUNCTION,
                        lastScopeIndex
                    )
                }
            }
        } else {
            if (options.parentScopeIndex === lastScopeIndex) {
                createHeapObject({ node: astNode })
                const initialValue = { type: "reference", ref: lastRef } as const
                newDeclaration(
                    astNode.id.name,
                    initialValue,
                    DECLARATION_TYPE.FUNCTION,
                    options.parentScopeIndex
                )
            } else {
                const initialValue = UNDEFINED
                newDeclaration(
                    astNode.id.name,
                    initialValue,
                    DECLARATION_TYPE.FUNCTION,
                    options.parentScopeIndex
                )
            }
        }
    }
    hoistingHandlers["VariableDeclaration"] = (astNode, options) => {
        for (const declarator of astNode.declarations) {
            const identifier = getIdentifierFromPattern(declarator.id)
            if (identifier) {
                const declarationType = astNode.kind === DECLARATION_TYPE.CONST ? DECLARATION_TYPE.CONST : astNode.kind === DECLARATION_TYPE.LET ? DECLARATION_TYPE.LET : DECLARATION_TYPE.VAR
                const initialValue = astNode.kind === DECLARATION_TYPE.VAR ? UNDEFINED : TDZ
                const scopeIndex = astNode.kind === DECLARATION_TYPE.VAR ? options.parentScopeIndex : lastScopeIndex
                const lookupResult = lookupVariable(identifier.name)
                if (lookupResult) {
                    if (options.parentScopeIndex === lastScopeIndex && lookupResult.variable.declarationType !== DECLARATION_TYPE.FUNCTION) {
                        newDeclaration(
                            identifier.name,
                            initialValue,
                            declarationType,
                            scopeIndex
                        )
                    }
                    if (declarationType === DECLARATION_TYPE.LET || declarationType === DECLARATION_TYPE.CONST) {
                        newDeclaration(
                            identifier.name,
                            initialValue,
                            declarationType,
                            scopeIndex
                        )
                    }
                } else {
                    if (declarationType === DECLARATION_TYPE.VAR) {
                        newDeclaration(
                            identifier.name,
                            initialValue,
                            declarationType,
                            scopeIndex
                        )
                    }
                }
            }
        }

    }
    hoistingHandlers["IfStatement"] = (astNode, options) => {
        if (astNode.consequent) {
            traverseHoisting(astNode.consequent, options, false)
        }
        if (astNode.alternate) {
            traverseHoisting(astNode.alternate, options, false)
        }
    }

    function traverseHoisting(astNode: ESTree.Node, options: TraverseASTOptions, isRoot: boolean = true) {
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
                    traverseExec(param.right, options)
                    paramValue = popMemval()
                }
                const identifier = getIdentifierFromPattern(param)
                if (!identifier) continue

                newDeclaration(identifier.name, paramValue, DECLARATION_TYPE.PARAM, lastScopeIndex)
            }
        }

        console.log(astNode.type, isRoot, options.isRoot)
        const handler = hoistingHandlers[astNode.type] as NodeHandler<typeof astNode>
        if (handler) {
            handler(astNode, { ...options, isRoot })
        }
    }

    const getScopeKind = (astNode: ESTree.BaseNode, options: TraverseASTOptions) => {
        if (astNode.type === "Program") {
            return SCOPE_KIND.PROGRAM
        } else if (options.callee) {
            return SCOPE_KIND.FUNCTION
        } else if (options.catch) {
            return SCOPE_KIND.CATCH
        } else {
            return SCOPE_KIND.BLOCK
        }
    }

    // --- Simulation Execution --- 
    function traverseExec(
        astNode: ESTree.Node,
        options: TraverseASTOptions
    ) {
        if (isBlock(astNode) || options.callee) {
            const scopeKind = getScopeKind(astNode, options)
            try {
                options.strict = isStrict(astNode, options)

                lastScopeIndex++
                if (options.callee) {
                    options.parentScopeIndex = lastScopeIndex
                }

                // Phase 1: push scope - hoisting and declarations
                addPushScopeStep(astNode, scopeKind)
                traverseHoisting(astNode, options)
                addHoistingStep(astNode)

                // Phase 2: execution  
                const handler = execHandlers[astNode.type] as NodeHandler<typeof astNode>
                if (handler) {
                    handler(astNode, options)
                } else {
                    console.warn(`Execution Pass: Unhandled node type - ${astNode.type}`)
                }

                // Phase 3: pop scope - except for global scope
                if (lastScopeIndex !== 0) {
                    addPopScopeStep(astNode, scopeKind)
                    lastScopeIndex--
                }
            } catch (bubbleUp) {
                if (lastScopeIndex !== 0) {
                    addPopScopeStep(astNode, scopeKind, bubbleUp as BubbleUp)
                    lastScopeIndex--
                    throw bubbleUp
                }
            }
        } else {
            const handler = execHandlers[astNode.type] as NodeHandler<typeof astNode>
            if (handler) {
                handler(astNode, options)
            } else {
                console.warn(`Execution Pass: Unhandled node type - ${astNode.type}`)
            }
        }
    }

    traverseExec(astNode, { parentScopeIndex: 0 })

    console.log("Simulation finished. Steps:", steps.length)
    return steps
}

