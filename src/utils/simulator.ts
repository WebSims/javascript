import { ESNode, VariableDeclarator, Identifier, ExpressionStatement } from "hermes-parser"
import { ExecStep, JSValue, Scope, Heap, MemoryChange, HeapObject, HeapRef, Declaration, TDZ, ScopeType, PUSH_SCOPE_KIND, MemVal } from "../types/simulation"
import { cloneDeep } from "lodash" // Import cloneDeep from lodash

/**
 * Simulates the execution of JavaScript code represented by an AST.
 * Performs a two-pass process: hoisting followed by execution.
 *
 * @param programNode The root Program node of the AST.
 * @returns An array of execution steps representing the simulation.
 */
export const simulateExecution = (astNode: ESNode | null): ExecStep[] => {
    // Ensure we have a valid Program node
    if (!astNode) {
        console.error("Invalid AST provided to simulateExecution.")
        return []
    }

    const steps: ExecStep[] = [
        {
            index: 0,
            memorySnapshot: { scopes: [], heap: {}, memVal: [] },
            phase: "initial",
            scopeIndex: 0,
            memoryChange: { type: "none" },
            executing: false,
            executed: false,
            evaluating: false,
            evaluated: false,
        }
    ]
    const scopes: Scope[] = []
    const heap: Heap = {}
    let memVal: MemVal[] = []
    let nextRef: HeapRef = 0
    let lastScopeIndex = -1
    let stepCounter: number = 1

    // --- Helper Functions ---

    const getNextRef = (): HeapRef => nextRef++

    const createMemorySnapshot = (): ExecStep["memorySnapshot"] => {
        // Crucial: Use a reliable deep copy mechanism here!
        // Use lodash cloneDeep
        return cloneDeep({ scopes, heap, memVal })
    }

    // --- Step Helpers ---
    const addStep = (stepData: Omit<ExecStep, "index" | "memorySnapshot">): ExecStep => {
        const snapshot = createMemorySnapshot()
        const step = {
            ...stepData,
            index: stepCounter++,
            memorySnapshot: snapshot,
        }
        steps.push(step)
        return step
    }
    const addPushScopeStep = (astNode: ESNode): ExecStep => {
        const getPushScopeType = (astNode: ESNode): ScopeType => {
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

        const block: ESNode = getBlock(astNode)
        return addStep({
            node: block,
            phase: "creation",
            scopeIndex,
            memoryChange: { type: "push_scope", kind, scope },
            executing: true,
            executed: false,
            evaluating: false,
            evaluated: false,
        })
    }
    const addHoistingStep = (astNode: ESNode, scopeIndex: number, declarations: Declaration[]): ExecStep => {
        const block = getBlock(astNode)
        return addStep({
            node: block,
            phase: "creation",
            scopeIndex,
            memoryChange: { type: "declaration", declarations, scopeIndex },
            executing: true,
            executed: false,
            evaluating: false,
            evaluated: false,
        })
    }
    const addExecutingStep = (astNode: ESNode, scopeIndex: number): ExecStep => {
        return addStep({
            node: astNode,
            phase: "execution",
            scopeIndex,
            memoryChange: { type: "none" },
            executing: true,
            executed: false,
            evaluating: false,
            evaluated: false,
        })
    }
    const addExecutedStep = (astNode: ESNode, scopeIndex: number, evaluatedValue?: JSValue, errorThrown?: JSValue): ExecStep => {
        return addStep({
            node: astNode,
            phase: "execution",
            scopeIndex,
            memoryChange: { type: "none" },
            executing: false,
            executed: true,
            evaluating: false,
            evaluated: false,
            evaluatedValue,
            errorThrown,
        })
    }
    const addEvaluatingStep = (astNode: ESNode, scopeIndex: number): ExecStep => {
        return addStep({
            node: astNode,
            phase: "execution",
            scopeIndex,
            memoryChange: { type: "none" },
            executing: false,
            executed: false,
            evaluating: true,
            evaluated: false,
        })
    }
    const addEvaluatedStep = (astNode: ESNode, scopeIndex: number, evaluatedValue: JSValue): ExecStep => {
        return addStep({
            node: astNode,
            phase: "execution",
            scopeIndex,
            memoryChange: { type: "none" },
            executing: false,
            executed: false,
            evaluating: false,
            evaluated: true,
            evaluatedValue,
        })
    }
    const addErrorThrownStep = (astNode: ESNode, scopeIndex: number, error: JSValue): ExecStep => {
        return addStep({
            node: astNode,
            phase: "execution",
            scopeIndex,
            memoryChange: { type: "none" },
            executing: false,
            executed: false,
            evaluating: false,
            evaluated: false,
            errorThrown: error,
        })
    }
    const addPopScopeStep = (astNode: ESNode, scopeIndex: number, evaluatedValue: JSValue | undefined, errorThrown: JSValue | undefined): ExecStep => {
        // const closingScope = scopes[scopeIndex]
        // const heapItemsToPotentiallyDelete = Object.values(closingScope.variables)
        //     .filter((item): item is Extract<JSValue, { type: 'reference' }> => item.type === 'reference')

        // heapItemsToPotentiallyDelete.forEach(itemToDelete => {
        //     const refToDelete = itemToDelete.ref
        //     let isReferencedElsewhere = false

        //     // Check all *other* scopes
        //     for (let i = 0; i < scopes.length; i++) {
        //         if (i === scopeIndex) continue // Skip the scope being closed

        //         const otherScope = scopes[i]
        //         const variablesInOtherScope = Object.values(otherScope.variables)

        //         for (const variableInOtherScope of variablesInOtherScope) {
        //             if (variableInOtherScope.type === 'reference' && variableInOtherScope.ref === refToDelete) {
        //                 isReferencedElsewhere = true
        //                 break // Found a reference, no need to check further in this scope
        //             }
        //         }

        //         if (isReferencedElsewhere) {
        //             break // Found a reference, no need to check other scopes
        //         }
        //     }

        //     // Only delete if not referenced elsewhere
        //     if (!isReferencedElsewhere) {
        //         // console.log(`Deleting heap item ref: ${refToDelete} as it's no longer referenced.`);
        //         delete heap[refToDelete]
        //     }
        //     // else {
        //     // Optional: console.log(`Keeping heap item ref: ${refToDelete} as it's referenced in another scope.`);
        //     // }
        // })

        scopes.splice(scopeIndex, 1)

        astNode = getBlock(astNode)
        return addStep({
            node: astNode,
            phase: "destruction",
            scopeIndex: scopeIndex,
            memoryChange: { type: "pop_scope", scopeIndex },
            executing: false,
            executed: true,
            evaluating: false,
            evaluated: false,
            evaluatedValue,
            errorThrown,
        })
    }

    // --- Memory Manipulation Helpers (Simplified placeholders) ---
    const newScope = (type: ScopeType): { scope: Scope, scopeIndex: number } => {
        const scopeIndex = scopes.length
        const scope = { type, variables: {} }
        scopes.push(scope)
        return { scope, scopeIndex }
    }

    const allocateHeapObject = (obj: HeapObject): HeapRef => {
        const ref = getNextRef()
        heap[ref] = obj
        // TODO: Consider a step for heap allocation?
        return ref
    }

    const lookupVariable = (name: string, startingScopeIndex: number): { value: JSValue, scopeIndex: number } | -1 => {
        for (let i = startingScopeIndex; i >= 0; i--) {
            if (Object.prototype.hasOwnProperty.call(scopes[i].variables, name)) {
                return { value: scopes[i].variables[name], scopeIndex: i }
            }
        }
        return -1
    }

    const newDeclaration = (name: string, kind: Extract<MemoryChange, { type: 'declaration' }>['declarations'][number]['kind'], scopeIndex: number, initialValue: JSValue): (Declaration | undefined) => {
        if (scopeIndex < 0 || scopeIndex >= scopes.length) {
            console.error(`Invalid scopeIndex ${scopeIndex} for declaring ${name}`)
            return
        }
        scopes[scopeIndex].variables[name] = initialValue
        return { kind, variableName: name, initialValue }
        // Step generation happens in the passes
    }

    const writeVariable = (name: string, value: JSValue, scopeIndex: number): number => {
        const lookup = lookupVariable(name, scopeIndex)
        if (lookup !== -1) {
            scopes[lookup.scopeIndex].variables[name] = value
            return lookup.scopeIndex
        }
        // Handle potential ReferenceError or global assignment (if intended)
        console.warn(`Attempted to write to undeclared variable ${name}`)
        // For simplicity, let's assign to global if not found (like non-strict mode)
        scopes[0].variables[name] = value // Or throw error
        return 0 // Indicate it wasn't found in declared scopes
    }

    const writeProperty = (ref: number, property: string, value: JSValue): number => {
        const heapObj = heap[ref]
        if (heapObj) {
            if (heapObj.type === 'object') {
                heapObj.properties[property] = value
            } else if (heapObj.type === 'array') {
                heapObj.elements[property] = value
            }
            return ref
        } else {
            return -1
        }
    }

    const addMemVal = (value: JSValue) => {
        memVal.push(value)
    }

    const removeMemVal = (value: JSValue) => {
        memVal.splice(memVal.lastIndexOf(value), 1)
    }

    const clearMemVal = (astNode?: ESNode) => {
        if (astNode) {
            memVal = memVal.filter(item => item.parentNode !== astNode)
        } else {
            memVal = []
        }
    }

    /**
     * Creates a JavaScript error object and adds it to the heap and memVal
     * 
     * @param errorType The type of error (TypeError, ReferenceError, etc.)
     * @param message The error message
     * @param astNode Optional AST node for tracking
     * @returns A JSValue representing the error
     */
    const createErrorObject = (errorType: string, message: string): JSValue => {
        const errorObject: HeapObject = {
            type: 'object',
            properties: {
                name: { type: 'primitive', value: errorType },
                message: { type: 'primitive', value: message },
                stack: { type: 'primitive', value: `${errorType}: ${message}` }
            }
        }

        const ref = allocateHeapObject(errorObject)

        const heapRefValue: JSValue = {
            type: 'reference',
            ref: ref
        }

        addMemVal(heapRefValue)

        return heapRefValue
    }
    const getErrorString = (error: JSValue): string => {
        const errorObject = heap[error.ref]
        return errorObject?.properties?.stack?.value
    }

    const printError = (error: JSValue): void => {
        console.error(getErrorString(error))
    }

    // --- Creation Pass --- 
    const getBlock = (astNode: ESNode): ESNode => {
        switch (astNode.type) {
            case "FunctionDeclaration":
            case "ArrowFunctionExpression":
            case "CatchClause":
                return astNode.body as ESNode
            case "TryStatement":
                return astNode.block as ESNode
            case "ForStatement":
                return { ...astNode, body: [astNode.init] } as ESNode
            default:
                return astNode
        }
    }
    const creationPhase = (astNode: ESNode): ExecStep => {
        const scopeIndex = addPushScopeStep(astNode).scopeIndex

        const declarations: Declaration[] = []

        // Use for FunctionDeclaration, ArrowFunctionExpression
        if (astNode.params) {
            for (const param of astNode.params) {
                if (param.type === "Identifier") {
                    const paramName = param.name
                    const paramValueIndex = memVal.findIndex(item => item.parentNode === astNode)
                    const paramValue: JSValue = memVal[paramValueIndex] || { type: "primitive", value: undefined }
                    memVal.splice(paramValueIndex, 1)
                    const declaration = newDeclaration(paramName, "param", scopeIndex, paramValue)
                    if (declaration.parentNode) declarations.push(declaration)
                } else if (param.type === "AssignmentPattern") {
                    const paramName = param.left.name
                    const defaultParamValue = param.right.value
                    const paramValueIndex = memVal.findIndex(item => item.parentNode === astNode)
                    const paramValue: JSValue = memVal[paramValueIndex] || { type: "primitive", value: undefined }
                    if (paramValue.value === undefined) {
                        paramValue.value = defaultParamValue
                    }
                    memVal.splice(paramValueIndex, 1)
                    if (paramValue.parentNode) delete paramValue.parentNode
                    const declaration = newDeclaration(paramName, "param", scopeIndex, paramValue)
                    if (declaration) declarations.push(declaration)
                } else {
                    console.warn("Unhandled param type:", param.type)
                }
            }
            clearMemVal(astNode)
        }
        // Use for CatchClause
        if (astNode.param) {
            const paramName = astNode.param.name
            const paramValueIndex = memVal.findIndex(item => item.parentNode === astNode)
            const paramValue: JSValue = memVal[paramValueIndex]
            memVal.splice(paramValueIndex, 1)
            if (paramValue.parentNode) delete paramValue.parentNode
            const declaration = newDeclaration(paramName, "param", scopeIndex, paramValue)
            if (declaration) declarations.push(declaration)
        }

        const block: ESNode = getBlock(astNode)
        if (block.type === "Program" || block.type === "BlockStatement" || block.type === "ForStatement") {
            for (const node of block.body) {
                if (!node) continue

                switch (node.type) {
                    case "FunctionDeclaration":
                        {
                            // Check type string, id exists, and then CAST id to Identifier to access properties
                            if (node.id) {
                                // Cast node.id to Identifier AFTER checking it exists
                                const idNode = node.id as Identifier
                                if (idNode.type === 'Identifier') { // Check type on the casted object
                                    const functionName = idNode.name // Access name from casted object
                                    // 1. Allocate Function Object on Heap
                                    const functionObject: HeapObject = {
                                        type: "function",
                                        node: node
                                    }
                                    const ref = allocateHeapObject(functionObject)

                                    const declaration = newDeclaration(functionName, "function", scopeIndex, { type: "reference", ref })
                                    if (declaration) declarations.push(declaration)
                                } else {
                                    console.warn("FunctionDeclaration id is not an Identifier?", idNode)
                                }
                            } else {
                                console.warn("Hoisting unnamed FunctionDeclaration?", node)
                            }
                        }
                        break;

                    case "VariableDeclaration":
                        {
                            if (node.kind === "var") {
                                for (const declarator of (node.declarations as VariableDeclarator[])) {
                                    if (declarator.id?.type === "Identifier") {
                                        const idNode = declarator.id as Identifier
                                        const varName = idNode.name
                                        const initialValue: JSValue = { type: "primitive", value: undefined }
                                        const declaration = newDeclaration(varName, "var", scopeIndex, initialValue)
                                        if (declaration) declarations.push(declaration)
                                    } else {
                                        console.warn("Unhandled var declaration pattern in creation:", declarator.id?.type)
                                    }
                                }
                            }
                            if (node.kind === "let" || node.kind === "const") {
                                for (const declarator of (node.declarations as VariableDeclarator[])) {
                                    if (declarator.id?.type === "Identifier") {
                                        const idNode = declarator.id as Identifier
                                        const varName = idNode.name
                                        const initialValue: JSValue = TDZ
                                        const declaration = newDeclaration(varName, node.kind, scopeIndex, initialValue)
                                        if (declaration) declarations.push(declaration)
                                    } else {
                                        console.warn("Unhandled let/const declaration pattern in creation:", declarator.id?.type)
                                    }
                                }
                            }
                        }
                        break;

                    // case "ExpressionStatement":
                    //     {
                    //         const expression = node.expression
                    //         if (expression.type === "AssignmentExpression") {
                    //             const varName = expression.left.name
                    //             const variable = lookupVariable(varName, scopeIndex)
                    //             if (variable === -1) {
                    //                 const initialValue: JSValue = { type: "primitive", value: undefined }
                    //                 const declaration = newDeclaration(varName, "global", 0, initialValue)
                    //                 if (declaration) declarations.push(declaration)
                    //             }
                    //         }
                    //     }
                    //     break;
                }
            }
        }

        console.log("Creation Phase:", scopeIndex)
        return addHoistingStep(astNode, scopeIndex, declarations)
    }

    // --- Execution Pass --- 
    const nodeHandlers: Record<string, (astNode: ESNode, scopeIndex: number) => ExecStep | undefined> = {}

    nodeHandlers["Program"] = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        const statements = astNode.body as ESNode[]
        let lastStep: ExecStep | undefined

        if (!Array.isArray(statements) || statements.length === 0) {
            return lastStep
        }

        for (const statement of statements) {
            // Skip function declarations as they are already handled in the creation phase
            if (statement.type === "FunctionDeclaration" || statement.type === "ArrowFunctionExpression") {
                continue
            }

            if (statement.type === "BlockStatement") {
                lastStep = traverseAST(statement, scopeIndex, false)
            } else {
                lastStep = executionPhase(statement, scopeIndex)
            }

            if (lastStep?.errorThrown) {
                return lastStep
            }

            if (lastStep?.evaluatedValue) {
                return lastStep
            }
        }
    }

    nodeHandlers["BlockStatement"] = nodeHandlers["Program"]

    nodeHandlers["ExpressionStatement"] = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        addExecutingStep(astNode, scopeIndex)
        const expressionNode = (astNode as ExpressionStatement).expression
        let lastStep = executionPhase(expressionNode, scopeIndex)
        if (lastStep?.errorThrown) {
            return lastStep
        }
        if (lastStep?.evaluatedValue) removeMemVal(lastStep.evaluatedValue)
        return addExecutedStep(astNode, scopeIndex)
    }

    nodeHandlers["Literal"] = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        addEvaluatingStep(astNode, scopeIndex)

        let evaluatedValue: JSValue;
        const literalValue = astNode.value
        if (literalValue === null) {
            evaluatedValue = { type: "primitive", value: null };
        } else if (typeof literalValue === 'string' || typeof literalValue === 'number' || typeof literalValue === 'boolean') {
            evaluatedValue = { type: "primitive", value: literalValue };
            // Last resort: cast to any to bypass instanceof type check issue
        } else if (typeof literalValue === 'object' && literalValue !== null && (literalValue as any) instanceof RegExp) {
            console.warn("RegExp Literal evaluation not fully implemented")
            evaluatedValue = { type: "primitive", value: astNode.raw };
        } else {
            console.warn("Unhandled Literal type:", typeof literalValue)
            evaluatedValue = { type: "primitive", value: undefined };
        }

        addMemVal(evaluatedValue)

        return addEvaluatedStep(astNode, scopeIndex, evaluatedValue)
    }

    nodeHandlers["VariableDeclaration"] = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        addExecutingStep(astNode, scopeIndex)
        if (astNode.kind === "const" && astNode.declarations.length === 0) {
            console.warn("Unhandled const declaration pattern in execution:", astNode.kind)
        }

        if (Array.isArray(astNode.declarations)) {
            for (const declarator of (astNode.declarations as VariableDeclarator[])) {
                if (declarator.id?.type === 'Identifier') {
                    const idNode = declarator.id as Identifier;
                    const varName = idNode.name;

                    let value: JSValue = { type: "primitive", value: undefined }
                    if (declarator.init) {
                        const lastStep = executionPhase(declarator.init, scopeIndex)
                        if (lastStep?.errorThrown) {
                            return lastStep
                        }
                        if (lastStep?.evaluatedValue) {
                            value = lastStep.evaluatedValue
                            removeMemVal(lastStep.evaluatedValue)
                        }
                    }
                    const targetScopeIndex = writeVariable(varName, value, scopeIndex)
                    return addStep({
                        node: astNode,
                        phase: "execution",
                        scopeIndex,
                        memoryChange: {
                            type: "write_variable",
                            scopeIndex: targetScopeIndex,
                            variableName: varName,
                            value,
                        },
                        executing: false,
                        executed: true,
                        evaluating: false,
                        evaluated: false,
                    })
                }
            }
        }
    }

    nodeHandlers["CallExpression"] = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        addEvaluatingStep(astNode, scopeIndex)

        let lastStep = executionPhase(astNode.callee, scopeIndex)
        if (lastStep?.errorThrown) {
            return lastStep
        }

        const args = []
        for (const arg of astNode.arguments) {
            const argStep = executionPhase(arg, scopeIndex)
            if (argStep?.errorThrown) {
                return argStep
            }
            if (argStep?.evaluatedValue) {
                args.push(argStep.evaluatedValue)
            }
        }

        if (lastStep?.evaluatedValue === TDZ) {
            const error = createErrorObject('ReferenceError', `Cannot access ${lastStep?.evaluatedValue?.value} before initialization`, astNode)
            return addErrorThrownStep(astNode, scopeIndex, error)
        }

        if (lastStep?.evaluatedValue?.type !== "reference") {
            const error = createErrorObject('ReferenceError', `${lastStep?.evaluatedValue?.value} is not a function`, astNode)
            return addErrorThrownStep(astNode, scopeIndex, error)
        }

        const object = heap[lastStep.evaluatedValue?.ref]
        if (!object) {
            const error = createErrorObject('ReferenceError', `${lastStep?.evaluatedValue?.value} is not defined`, astNode)
            return addErrorThrownStep(astNode, scopeIndex, error)
        }

        if (object?.type === "function") {
            addEvaluatingStep(astNode, scopeIndex)
            removeMemVal(lastStep?.evaluatedValue)

            for (const arg of args) {
                // Hack: rewrite the evaluatedValue to use as parameter for the function call
                removeMemVal(arg)
                addMemVal({ ...arg, parentNode: object.node })
            }

            lastStep = traverseAST(object.node as ESNode, scopeIndex, false)

            if (lastStep?.errorThrown) {
                return addErrorThrownStep(astNode, scopeIndex, lastStep.errorThrown)
            } else {
                if (!lastStep?.evaluatedValue) {
                    addMemVal({ type: "primitive", value: undefined })
                    return addEvaluatedStep(astNode, scopeIndex, { type: "primitive", value: undefined })
                }
                return addEvaluatedStep(astNode, scopeIndex, lastStep?.evaluatedValue)
            }
        } else {
            removeMemVal(lastStep?.evaluatedValue)
            const error = createErrorObject('TypeError', `${lastStep?.node.name} is not a function`, astNode)
            return addErrorThrownStep(astNode, scopeIndex, error)
        }
    }

    nodeHandlers["Identifier"] = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        addEvaluatingStep(astNode, scopeIndex)

        const varName = (astNode as Identifier).name;
        if (varName === 'undefined') {
            addMemVal({ type: "primitive", value: undefined })
            return addEvaluatedStep(astNode, scopeIndex, { type: "primitive", value: undefined })
        }

        const variable = lookupVariable(varName, scopeIndex)
        if (variable !== -1) {
            addMemVal(variable.value)
            if (variable.value.type === "reference") {
                return addEvaluatedStep(astNode, scopeIndex, variable.value)
            } else if (variable.value.type === "primitive" || variable.value.type === "error") {
                return addEvaluatedStep(astNode, scopeIndex, variable.value)
            }
        } else {
            const error = createErrorObject('ReferenceError', `${varName} is not defined`, astNode)
            return addErrorThrownStep(astNode, scopeIndex, error)
        }
    }

    nodeHandlers["BinaryExpression"] = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        addEvaluatingStep(astNode, scopeIndex)

        let leftStep: ExecStep | undefined
        let rightStep: ExecStep | undefined

        if (astNode.operator === "&&") {
            leftStep = executionPhase(astNode.left, scopeIndex)
            if (leftStep?.errorThrown) return leftStep

            if (leftStep?.evaluatedValue?.value === true) {
                rightStep = executionPhase(astNode.right, scopeIndex)
                if (rightStep?.errorThrown) return rightStep
            } else {
                rightStep = { type: "primitive", value: false }
            }
        } else if (astNode.operator === "||") {
            leftStep = executionPhase(astNode.left, scopeIndex)
            if (leftStep?.errorThrown) return leftStep

            if (leftStep?.evaluatedValue?.value === true) {
                rightStep = { type: "primitive", value: true }
            } else {
                rightStep = executionPhase(astNode.right, scopeIndex)
                if (rightStep?.errorThrown) return rightStep
            }
        } else {
            leftStep = executionPhase(astNode.left, scopeIndex);
            if (leftStep?.errorThrown) return leftStep

            rightStep = executionPhase(astNode.right, scopeIndex);
            if (rightStep?.errorThrown) return rightStep
        }


        if (astNode.operator) {
            // TODO: reference have problem for example:
            // ([] >= {}); => should be false but return true
            // Solution 1: use heap value instead of reference and create it and competive without using eval
            const leftRaw = leftStep?.evaluatedValue?.type === "reference"
                ? `heap[${leftStep.evaluatedValue.ref}]`
                : JSON.stringify(leftStep?.evaluatedValue?.value)
            const rightRaw = rightStep?.evaluatedValue?.type === "reference"
                ? `heap[${rightStep.evaluatedValue.ref}]`
                : JSON.stringify(rightStep?.evaluatedValue?.value)
            const value = eval(`${leftRaw}${astNode.operator}${rightRaw}`)
            const evaluatedValue = {
                type: "primitive",
                value
            } as const

            removeMemVal(leftStep.evaluatedValue)
            removeMemVal(rightStep.evaluatedValue)
            addMemVal(evaluatedValue)
            return addEvaluatedStep(astNode, scopeIndex, evaluatedValue)
        }
    }

    nodeHandlers["ReturnStatement"] = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        addExecutingStep(astNode, scopeIndex)
        let evaluatedValue: JSValue | undefined = { type: 'primitive', value: undefined }
        if (astNode.argument) {
            const lastStep = executionPhase(astNode.argument, scopeIndex)
            if (lastStep?.errorThrown) {
                return lastStep
            }
            if (lastStep?.evaluatedValue) {
                evaluatedValue = lastStep.evaluatedValue
            }
        } else {
            addMemVal(evaluatedValue)
        }
        return addExecutedStep(astNode, scopeIndex, evaluatedValue)
    }

    nodeHandlers["ThrowStatement"] = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        addExecutingStep(astNode, scopeIndex)
        const lastStep = executionPhase(astNode.argument, scopeIndex)
        return addExecutedStep(astNode, scopeIndex, undefined, lastStep?.evaluatedValue)
    }

    // --- TryStatement Execution ---
    nodeHandlers["TryStatement"] = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        addExecutingStep(astNode, scopeIndex)
        let evaluatedValue: JSValue | undefined

        const tryLastStep = traverseAST(astNode, scopeIndex, false)

        if (tryLastStep?.errorThrown) {
            // Hack: rewrite the errorThrown to use as parameter for the catch block
            removeMemVal(tryLastStep?.errorThrown)
            addMemVal({ ...tryLastStep?.errorThrown, parentNode: astNode.handler })

            const catchLastStep = traverseAST(astNode.handler, scopeIndex, false)

            if (astNode.finalizer) {
                if (catchLastStep?.errorThrown) {
                    removeMemVal(catchLastStep?.errorThrown)
                }
            } else {
                if (catchLastStep?.errorThrown) {
                    return catchLastStep
                }
            }
            evaluatedValue = catchLastStep?.evaluatedValue
        } else {
            evaluatedValue = tryLastStep?.evaluatedValue
        }

        if (astNode.finalizer) {
            if (astNode.finalizer.body.length > 0) removeMemVal(evaluatedValue)
            const finalizerStep = traverseAST(astNode.finalizer, scopeIndex, false)
            if (finalizerStep?.errorThrown) {
                return finalizerStep
            }
            evaluatedValue = finalizerStep?.evaluatedValue || tryLastStep?.evaluatedValue
        }

        return addExecutedStep(astNode, scopeIndex, evaluatedValue)
    }

    nodeHandlers["AssignmentExpression"] = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        addEvaluatingStep(astNode, scopeIndex)

        let objectStep
        let propertyStep
        let property

        if (astNode.left.type === "MemberExpression") {
            objectStep = executionPhase(astNode.left.object, scopeIndex)
            if (objectStep && objectStep.errorThrown) {
                return objectStep
            }

            if (astNode.left.computed) {
                propertyStep = executionPhase(astNode.left.property, scopeIndex)
                if (propertyStep && propertyStep.errorThrown) {
                    return propertyStep
                }
                property = propertyStep.evaluatedValue
            } else {
                property = { type: "primitive", value: astNode.left.property.name }
                objectStep?.memorySnapshot.memVal.push(property)
                addMemVal(property)
            }
        }

        const rightStep = executionPhase(astNode.right, scopeIndex)
        if (rightStep?.errorThrown) return rightStep

        let evaluatedValue = rightStep?.evaluatedValue
        if (evaluatedValue) {
            if (astNode.operator !== "=") {
                const leftRaw = JSON.stringify(leftStep.evaluatedValue.value)
                const rightRaw = JSON.stringify(rightStep.evaluatedValue.value)
                const value = eval(`${leftRaw}${astNode.operator.replace("=", "")}${rightRaw}`)
                evaluatedValue = { type: "primitive", value } as const
            }

            if (astNode.left.type === "Identifier") {
                const targetScopeIndex = writeVariable(astNode.left.name, evaluatedValue, scopeIndex)
                removeMemVal(rightStep.evaluatedValue)
                addMemVal(evaluatedValue)
                return addStep({
                    node: astNode,
                    phase: "execution",
                    scopeIndex,
                    memoryChange: {
                        type: "write_variable",
                        scopeIndex: targetScopeIndex,
                        variableName: astNode.left.name,
                        value: evaluatedValue,
                    },
                    executing: false,
                    executed: false,
                    evaluating: false,
                    evaluated: true,
                    evaluatedValue,
                })
            } else {
                const ref = leftObjectStep?.evaluatedValue?.ref
                const propertyRef = writeProperty(ref, property.value, evaluatedValue)

                removeMemVal(leftObjectStep?.evaluatedValue)
                removeMemVal(property)
                removeMemVal(rightStep.evaluatedValue)

                if (propertyRef === -1) {
                    const error = createErrorObject('TypeError', `Cannot set properties of undefined (setting '${property}')`)
                    return addErrorThrownStep(astNode, scopeIndex, error)
                }

                addMemVal(evaluatedValue)
                return addStep({
                    node: astNode,
                    phase: "execution",
                    scopeIndex,
                    memoryChange: {
                        type: "write_property",
                        ref,
                        property,
                        value: evaluatedValue,
                    },
                    executing: false,
                    executed: false,
                    evaluating: false,
                    evaluated: true,
                    evaluatedValue,
                })
            }
        }
    }

    nodeHandlers["ConditionalExpression"] = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        addEvaluatingStep(astNode, scopeIndex)
        let evalValue: JSValue | undefined

        const testStep = executionPhase(astNode.test, scopeIndex)
        if (testStep?.errorThrown) {
            return testStep
        }

        const testEvalValue = testStep?.evaluatedValue
        const isTestTruthy = testEvalValue?.value === true
        if (testEvalValue) {
            removeMemVal(testEvalValue)
            if (isTestTruthy) {
                const consequentStep = executionPhase(astNode.consequent, scopeIndex)
                if (consequentStep?.errorThrown) return consequentStep

                if (consequentStep?.evaluatedValue) {
                    evalValue = consequentStep.evaluatedValue
                }
            } else {
                const alternateStep = executionPhase(astNode.alternate, scopeIndex)
                if (alternateStep?.errorThrown) return alternateStep

                if (alternateStep?.evaluatedValue) {
                    evalValue = alternateStep.evaluatedValue
                }
            }
        }

        return addEvaluatedStep(astNode, scopeIndex, evalValue)
    }

    nodeHandlers["ArrayExpression"] = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        addEvaluatingStep(astNode, scopeIndex)

        const elements: JSValue[] = []
        for (const element of astNode.elements) {
            if (element) {
                const elementStep = executionPhase(element, scopeIndex)
                if (elementStep?.errorThrown) return elementStep
                if (elementStep?.evaluatedValue) elements.push(elementStep.evaluatedValue)
            } else {
                elements.push({ type: "primitive", value: undefined })
            }
        }

        for (const element of elements) {
            removeMemVal(element)
        }

        const arrayObject: HeapObject = { type: "array", elements }
        const ref = allocateHeapObject(arrayObject)
        addMemVal({ type: "reference", ref })
        return addEvaluatedStep(astNode, scopeIndex, { type: "reference", ref })
    }

    nodeHandlers["ObjectExpression"] = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        addEvaluatingStep(astNode, scopeIndex)

        const properties: Record<string, JSValue> = {}
        for (const property of astNode.properties) {
            const propertyStep = executionPhase(property.value, scopeIndex)
            if (propertyStep?.errorThrown) return propertyStep

            if (propertyStep?.evaluatedValue === TDZ) {
                const error = createErrorObject('ReferenceError', `${property.key.name || property.key.value} is not defined`, astNode)
                return addErrorThrownStep(astNode, scopeIndex, error)
            }

            if (propertyStep?.evaluatedValue) properties[property.key.name || property.key.value] = propertyStep.evaluatedValue
        }

        for (const property of Object.values(properties)) {
            removeMemVal(property)
        }

        const objectObject: HeapObject = { type: "object", properties }
        const ref = allocateHeapObject(objectObject)
        addMemVal({ type: "reference", ref })
        return addEvaluatedStep(astNode, scopeIndex, { type: "reference", ref })
    }

    nodeHandlers["MemberExpression"] = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        addEvaluatingStep(astNode, scopeIndex)

        const objectStep = executionPhase(astNode.object, scopeIndex)
        if (objectStep?.errorThrown) return objectStep

        let evaluatedValue: JSValue | undefined
        if (objectStep?.evaluatedValue?.type === "reference") {
            const object = heap[objectStep?.evaluatedValue?.ref]
            if (!object) {
                const error = createErrorObject('TypeError', `Cannot read properties of undefined (reading ${objectStep?.evaluatedValue?.value})`, astNode)
                return addErrorThrownStep(astNode, scopeIndex, error)
            }

            if (astNode.computed) {
                const propertyStep = executionPhase(astNode.property, scopeIndex)
                if (propertyStep?.errorThrown) return propertyStep
                removeMemVal(propertyStep?.evaluatedValue)

                if (object.type === "object") {
                    evaluatedValue = object.properties[propertyStep.evaluatedValue?.value]
                } else if (object.type === "array") {
                    evaluatedValue = object.elements[propertyStep.evaluatedValue?.value]
                } else {
                    const error = createErrorObject('ReferenceError', `${objectStep?.node.name} is not an object or array`, astNode)
                    return addErrorThrownStep(astNode, scopeIndex, error)
                }
            } else {
                if (object.type === "object") {
                    evaluatedValue = object.properties[astNode.property.name]
                } else if (object.type === "array") {
                    evaluatedValue = object.elements[astNode.property.name]
                } else {
                    evaluatedValue = { type: "primitive", value: undefined }
                }
            }
        } else if (objectStep?.evaluatedValue.type === "primitive") {
            if (astNode.computed) {
                const propertyStep = executionPhase(astNode.property, scopeIndex)
                if (propertyStep?.errorThrown) return propertyStep

                removeMemVal(propertyStep?.evaluatedValue)

                if (objectStep.evaluatedValue.value === undefined) {
                    const error = createErrorObject('TypeError', `Cannot read properties of undefined (reading ${propertyStep?.evaluatedValue?.value})`)
                    return addErrorThrownStep(astNode, scopeIndex, error)
                } else {
                    evaluatedValue = { type: 'primitive', value: objectStep?.evaluatedValue.value[propertyStep?.evaluatedValue?.value] }
                }
            } else if (objectStep.evaluatedValue.value === undefined) {
                const error = createErrorObject('TypeError', `Cannot read properties of undefined (reading ${astNode?.property?.name})`)
                return addErrorThrownStep(astNode, scopeIndex, error)
            }
        }
        removeMemVal(objectStep?.evaluatedValue)

        if (evaluatedValue === undefined) {
            evaluatedValue = { type: "primitive", value: undefined }
        }

        addMemVal(evaluatedValue)
        return addEvaluatedStep(astNode, scopeIndex, evaluatedValue)
    }

    nodeHandlers["ArrowFunctionExpression"] = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        addEvaluatingStep(astNode, scopeIndex)

        const functionObject: HeapObject = {
            type: "function",
            node: astNode,
        }

        const ref = allocateHeapObject(functionObject)
        addMemVal({ type: "reference", ref })
        return addEvaluatedStep(astNode, scopeIndex, { type: "reference", ref })
    }

    nodeHandlers["IfStatement"] = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        addExecutingStep(astNode, scopeIndex)
        let lastStep: ExecStep | undefined

        const testStep = executionPhase(astNode.test, scopeIndex)
        if (testStep?.errorThrown) return testStep
        removeMemVal(testStep?.evaluatedValue)

        if (Boolean(testStep?.evaluatedValue?.value)) {
            if (isBlock(astNode.consequent)) {
                lastStep = traverseAST(astNode.consequent, scopeIndex, false)
            } else {
                lastStep = executionPhase(astNode.consequent, scopeIndex)

            }
        } else {
            if (astNode.alternate) {
                lastStep = traverseAST(astNode.alternate, scopeIndex, false)
            }
        }
        if (lastStep?.errorThrown) {
            return lastStep
        }
        return addExecutedStep(astNode, scopeIndex, lastStep?.evaluatedValue)
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
                if (bodyStep?.errorThrown) {
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

    nodeHandlers["EmptyStatement"] = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        addExecutingStep(astNode, scopeIndex)
        return addExecutedStep(astNode, scopeIndex)
    }


    const executionPhase = (node: ESNode | null, currentScopeIndex: number): ExecStep | undefined => {
        if (!node) return
        console.log("Executing node:", node.type, "in scope:", currentScopeIndex, "withinTry:")

        const handler = nodeHandlers[node.type as keyof typeof nodeHandlers]
        if (handler) {
            return handler(node, currentScopeIndex)
        } else {
            console.warn(`Execution Pass: Unhandled node type - ${node.type}`)
            return undefined
        }
    }

    const destructionPhase = (astNode: ESNode, scopeIndex: number, lastStep: ExecStep | undefined) => {
        if (lastStep?.errorThrown) printError(lastStep.errorThrown)
        addPopScopeStep(astNode, scopeIndex, lastStep?.evaluatedValue, lastStep?.errorThrown)
        console.log("Destruction Phase:", scopeIndex)
    }

    const isBlock = (node: ESNode): boolean => {
        return (
            node.type === "Program" ||
            node?.type === "FunctionDeclaration" ||
            node?.type === "TryStatement" ||
            node?.type === "CatchClause" ||
            node?.type === "ArrowFunctionExpression" ||
            node?.type === "BlockStatement"
        )
    }

    const isStrict = (node: ESNode): boolean => {
        return node?.body[0]?.expression?.type === "Literal" && node?.body[0]?.expression?.value === "use strict"
    }

    // --- Simulation Execution --- 
    function traverseAST(astNode: ESNode, scopeIndex: number, strict: boolean): ExecStep | undefined {
        // Check for non-block nodes early to avoid unnecessary scope creation
        if (!isBlock(astNode)) {
            return executionPhase(astNode, scopeIndex)
        }

        // For block nodes, handle scope creation and execution
        lastScopeIndex++
        scopeIndex = lastScopeIndex

        // Phase 1: Creation - hoisting and declarations
        creationPhase(astNode)

        // Phase 2: Execution
        // Get the actual block to execute
        const block = getBlock(astNode)
        const lastStep = executionPhase(block, scopeIndex)

        // Phase 3: Destruction - except for global scope
        if (scopeIndex !== 0) {
            destructionPhase(astNode, scopeIndex, lastStep)
            lastScopeIndex--
        }

        return steps[steps.length - 1]
    }

    try {
        traverseAST(astNode, 0, false, false)
    } catch (e) {
        console.log(e)
    }

    console.log("Simulation finished. Steps:", steps.length)
    return steps
}

