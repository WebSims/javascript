import { ESNode, VariableDeclarator, Identifier, Literal, ArrayExpression, ObjectExpression, Property, ArrowFunctionExpression, ExpressionStatement } from "hermes-parser"
import { ExecStep, JSValue, Scope, Heap, MemoryChange, HeapObject, HeapRef, Declaration, TDZ, ScopeType, PUSH_SCOPE_KIND } from "../types/simulation"
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
    const heap: Heap = {} // Use const
    let memVal: JSValue[] = []
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
    const addPushScopeStep = (astNode: ESNode, block: ESNode): ExecStep => {
        const getPushScopeType = (astNode: ESNode): ScopeType => {
            switch (astNode.type) {
                case "Program":
                    return "global"
                case "FunctionDeclaration":
                    return "function"
                default:
                    return "block"
            }
        }
        const type = getPushScopeType(astNode)
        const { scope, scopeIndex } = newScope(type)

        const kind = PUSH_SCOPE_KIND[astNode.type as keyof typeof PUSH_SCOPE_KIND]

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
        return addStep({
            node: astNode,
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
    const addPopScopeStep = (astNode: ESNode, scopeIndex: number): ExecStep => {
        const closingScope = scopes[scopeIndex]
        const heapItemsToPotentiallyDelete = Object.values(closingScope.variables)
            .filter((item): item is Extract<JSValue, { type: 'reference' }> => item.type === 'reference')

        heapItemsToPotentiallyDelete.forEach(itemToDelete => {
            const refToDelete = itemToDelete.ref
            let isReferencedElsewhere = false

            // Check all *other* scopes
            for (let i = 0; i < scopes.length; i++) {
                if (i === scopeIndex) continue // Skip the scope being closed

                const otherScope = scopes[i]
                const variablesInOtherScope = Object.values(otherScope.variables)

                for (const variableInOtherScope of variablesInOtherScope) {
                    if (variableInOtherScope.type === 'reference' && variableInOtherScope.ref === refToDelete) {
                        isReferencedElsewhere = true
                        break // Found a reference, no need to check further in this scope
                    }
                }

                if (isReferencedElsewhere) {
                    break // Found a reference, no need to check other scopes
                }
            }

            // Only delete if not referenced elsewhere
            if (!isReferencedElsewhere) {
                // console.log(`Deleting heap item ref: ${refToDelete} as it's no longer referenced.`);
                delete heap[refToDelete]
            }
            // else {
            // Optional: console.log(`Keeping heap item ref: ${refToDelete} as it's referenced in another scope.`);
            // }
        })
        scopes.splice(scopeIndex, 1)

        return addStep({
            node: astNode,
            phase: "destruction",
            scopeIndex: scopeIndex,
            memoryChange: { type: "pop_scope", scopeIndex },
            evaluatedValue: undefined,
            executing: false,
            executed: true,
            evaluating: false,
            evaluated: false,
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

    const addMemVal = (value: JSValue) => {
        memVal.push(value)
    }

    const removeMemVal = (value: JSValue) => {
        memVal.splice(memVal.indexOf(value), 1)
    }

    const clearMemVal = (astNode?: ESNode) => {
        if (astNode) {
            memVal = memVal.filter(item => item.parentNode !== astNode)
        } else {
            memVal = []
        }
    }


    // --- Creation Pass --- 


    const creationPhase = (astNode: ESNode, scopeIndex: number): void => {
        const block: ESNode = astNode.type === "FunctionDeclaration" ? astNode.body :
            astNode.type === "TryStatement" ? astNode.block :
                astNode.type === "CatchClause" ? astNode.body :
                    astNode
        scopeIndex = addPushScopeStep(astNode, block).scopeIndex

        const declarations: Declaration[] = []

        // Handle Parameters
        const handleFunctionParam = (param: ESNode, scopeIndex: number): void => {

        }

        if (astNode.params) {
            for (const param of astNode.params) {
                if (param.type === "Identifier") {
                    const paramName = param.name
                    const paramValueIndex = memVal.findIndex(item => item.parentNode === astNode)
                    const paramValue: JSValue = memVal[paramValueIndex]
                    memVal.splice(paramValueIndex, 1)
                    const declaration = newDeclaration(paramName, "param", scopeIndex, paramValue)
                    if (declaration.parentNode) declarations.push(declaration)
                } else if (param.type === "AssignmentPattern") {
                    const paramName = param.left.name
                    const defaultParamValue = param.right.value
                    const paramValueIndex = memVal.findIndex(item => item.parentNode === astNode)
                    const paramValue: JSValue = memVal[paramValueIndex]
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
            }
        }

        addHoistingStep(block, scopeIndex, declarations)
        console.log("Creation Phase:", scopeIndex)
    }

    // --- Execution Pass --- 
    const execBlockStatement = (astNode: ESNode, scopeIndex: number, withinTryBlock: boolean): ExecStep | undefined => {
        const statements = astNode.body as ESNode[]
        let lastStep: ExecStep | undefined

        if (!Array.isArray(statements) || statements.length === 0) {
            return lastStep
        }

        for (const statement of statements) {
            // Skip function declarations as they are already handled in the creation phase
            if (statement.type === "FunctionDeclaration") {
                continue
            }

            // Mark statement as executing
            addExecutingStep(statement, scopeIndex)
            lastStep = executionPhase(statement, scopeIndex, withinTryBlock)

            if (lastStep?.errorThrown && !withinTryBlock) {
                console.error(lastStep.errorThrown.value)
                return lastStep
            }

            if (lastStep?.node?.type !== statement.type) {
                addExecutedStep(statement, scopeIndex)
            }

            // Stop execution if an error was thrown (even if withinTryBlock)
            if (lastStep?.errorThrown) {
                console.error(lastStep.errorThrown.value)
                return lastStep
            }

            if (statement.type === "ExpressionStatement") {
                continue
            }

            if (lastStep?.evaluatedValue) {
                return lastStep
            }
        }
    }

    const execExpressionStatement = (astNode: ESNode, scopeIndex: number, withinTryBlock: boolean): ExecStep | undefined => {
        const expressionNode = (astNode as ExpressionStatement).expression
        const lastStep = executionPhase(expressionNode, scopeIndex, withinTryBlock)
        if (lastStep?.errorThrown) {
            return lastStep
        }
        if (lastStep?.evaluatedValue) removeMemVal(lastStep.evaluatedValue)
        return lastStep
    }

    const execLiteral = (astNode: ESNode, scopeIndex: number, withinTryBlock: boolean): ExecStep | undefined => {
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

    const execVariableDeclaration = (astNode: ESNode, scopeIndex: number, withinTryBlock: boolean): ExecStep | undefined => {
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
                        const lastStep = executionPhase(declarator.init, scopeIndex, withinTryBlock)
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

    const execCallExpression = (astNode: ESNode, scopeIndex: number, withinTryBlock: boolean): ExecStep | undefined => {
        addEvaluatingStep(astNode, scopeIndex)

        let lastStep = executionPhase(astNode.callee, scopeIndex, withinTryBlock)
        if (lastStep?.evaluatedValue === TDZ) {
            const error = { type: "error", value: 'ReferenceError: Cannot access ' + lastStep?.node.name + ' before initialization' } as const
            return addErrorThrownStep(astNode, scopeIndex, error)
        }

        const object = heap[lastStep.evaluatedValue?.ref]
        if (!object) {
            const error = { type: "error", value: 'ReferenceError: ' + lastStep?.node.name + ' is not defined' } as const
            return addErrorThrownStep(astNode, scopeIndex, error)
        }

        if (object?.type === "function") {
            for (const arg of astNode.arguments) {
                const argStep = executionPhase(arg, scopeIndex, withinTryBlock)
                if (argStep?.evaluatedValue) {
                    // Hack: rewrite the evaluatedValue to use as parameter for the function call
                    removeMemVal(argStep.evaluatedValue)
                    addMemVal({ ...argStep.evaluatedValue, parentNode: object.node })
                }
            }
            addEvaluatingStep(astNode, scopeIndex)
            removeMemVal(lastStep?.evaluatedValue)

            lastStep = traverseAST(object.node as ESNode, scopeIndex, false, withinTryBlock)

            if (lastStep?.errorThrown) {
                return lastStep
            } else {
                if (!lastStep?.evaluatedValue) {
                    addMemVal({ type: "primitive", value: undefined })
                    return addEvaluatedStep(astNode, scopeIndex, { type: "primitive", value: undefined })
                }
                return addEvaluatedStep(astNode, scopeIndex, lastStep?.evaluatedValue)
            }
        } else {
            const error = { type: "error", value: 'TypeError: ' + lastStep?.node.name + ' is not a function' } as const
            return addErrorThrownStep(astNode, scopeIndex, error)
        }
    }

    const execIdentifier = (astNode: ESNode, scopeIndex: number, withinTryBlock: boolean): ExecStep | undefined => {
        addEvaluatingStep(astNode, scopeIndex)

        const varName = (astNode as Identifier).name;
        if (varName === 'undefined') {
            addMemVal({ type: "primitive", value: undefined })
            return addEvaluatedStep(astNode, scopeIndex, { type: "primitive", value: undefined })
        }

        const variable = lookupVariable(varName, scopeIndex)
        if (variable !== -1) {
            if (variable.value.type === "reference") {
                addMemVal(variable.value)
                return addEvaluatedStep(astNode, scopeIndex, variable.value)
            } else if (variable.value.type === "primitive") {
                addMemVal(variable.value)
                return addEvaluatedStep(astNode, scopeIndex, variable.value)
            }
        } else {
            const error = { type: "error", value: 'ReferenceError: ' + varName + ' is not defined' } as const
            return addErrorThrownStep(astNode, scopeIndex, error)
        }
    }

    const execBinaryExpression = (astNode: ESNode, scopeIndex: number, withinTryBlock: boolean): ExecStep | undefined => {
        addEvaluatingStep(astNode, scopeIndex)

        let leftStep: ExecStep | undefined
        let rightStep: ExecStep | undefined

        if (astNode.operator === "&&") {
            leftStep = executionPhase(astNode.left, scopeIndex, withinTryBlock)
            if (leftStep?.evaluatedValue?.value === true) rightStep = executionPhase(astNode.right, scopeIndex, withinTryBlock)
            else rightStep = { type: "primitive", value: false }
        } else if (astNode.operator === "||") {

            leftStep = executionPhase(astNode.left, scopeIndex, withinTryBlock)
            if (leftStep?.evaluatedValue?.value === true) rightStep = { type: "primitive", value: true }
            else rightStep = executionPhase(astNode.right, scopeIndex, withinTryBlock)
        } else {
            leftStep = executionPhase(astNode.left, scopeIndex, withinTryBlock);
            rightStep = executionPhase(astNode.right, scopeIndex, withinTryBlock);
        }

        if (astNode.operator) {
            const leftRaw = JSON.stringify(leftStep?.evaluatedValue?.value)
            const rightRaw = JSON.stringify(rightStep?.evaluatedValue?.value)
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
        return
    }

    const execReturnStatement = (astNode: ESNode, scopeIndex: number, withinTryBlock: boolean): ExecStep | undefined => {
        if (astNode.argument) {
            const lastStep = executionPhase(astNode.argument, scopeIndex, withinTryBlock)
            return lastStep
        } else {
            addMemVal({ type: 'primitive', value: undefined })
            return addExecutedStep(astNode, scopeIndex, { type: 'primitive', value: undefined })
        }
    }

    const execThrowStatement = (astNode: ESNode, scopeIndex: number, withinTryBlock: boolean): ExecStep | undefined => {
        const lastStep = executionPhase(astNode.argument, scopeIndex, withinTryBlock)
        return addExecutedStep(astNode, scopeIndex, undefined, lastStep?.evaluatedValue)
    }

    // --- TryStatement Execution ---
    const execTryStatement = (astNode: ESNode, scopeIndex: number, withinTryBlock: boolean): ExecStep | undefined => {
        const tryLastStep = traverseAST(astNode, scopeIndex, false, true) // Pass true here
        if (tryLastStep?.errorThrown) {
            // Hack: rewrite the errorThrown to use as parameter for the catch block
            removeMemVal(tryLastStep?.errorThrown)
            addMemVal({ ...tryLastStep?.errorThrown, parentNode: astNode.handler })

            const catchLastStep = traverseAST(astNode.handler, scopeIndex, false, withinTryBlock)
            if (astNode.finalizer && !catchLastStep?.errorThrown) {
                if (astNode.finalizer.body.length > 0) removeMemVal(catchLastStep?.evaluatedValue)
                const finalizerStep = traverseAST(astNode.finalizer, scopeIndex, false, withinTryBlock)
                return finalizerStep || catchLastStep
            }

            return catchLastStep
        }

        if (astNode.finalizer) {
            if (astNode.finalizer.body.length > 0) removeMemVal(tryLastStep?.evaluatedValue)
            const finalizerStep = traverseAST(astNode.finalizer, scopeIndex, false, withinTryBlock)
            return finalizerStep || tryLastStep
        }
        return tryLastStep
    }

    const execAssignmentExpression = (astNode: ESNode, scopeIndex: number, withinTryBlock: boolean): ExecStep | undefined => {
        addEvaluatingStep(astNode, scopeIndex)

        if (astNode.left?.type !== 'Identifier') {
            console.error("Assignment target must be an Identifier", astNode.left)
            // TODO: Handle MemberExpression assignments (obj.prop = ...)
            const error = { type: "error", value: 'ReferenceError: Invalid left-hand side in assignment' } as const
            return addErrorThrownStep(astNode, scopeIndex, error)
        }

        const leftStep = executionPhase(astNode.left, scopeIndex, withinTryBlock)
        const rightStep = executionPhase(astNode.right, scopeIndex, withinTryBlock)
        if (rightStep?.errorThrown) {
            return rightStep
        }

        if (leftStep?.evaluatedValue && rightStep?.evaluatedValue) {
            let value = rightStep.evaluatedValue.value
            if (astNode.operator !== "=") {
                const leftRaw = JSON.stringify(leftStep.evaluatedValue.value)
                const rightRaw = JSON.stringify(rightStep.evaluatedValue.value)
                value = eval(`${leftRaw}${astNode.operator.replace("=", "")}${rightRaw}`)
            }
            const evaluatedValue = { type: "primitive", value } as const
            const targetScopeIndex = writeVariable(leftStep.node.name, evaluatedValue, scopeIndex)

            removeMemVal(leftStep.evaluatedValue)
            removeMemVal(rightStep.evaluatedValue)
            addMemVal(evaluatedValue)
            return addStep({
                node: astNode,
                scopeIndex,
                memoryChange: {
                    type: "write_variable",
                    scopeIndex: targetScopeIndex,
                    variableName: leftStep.node.name,
                    value,
                },
                executing: false,
                executed: false,
                evaluating: false,
                evaluated: true,
                evaluatedValue,
            })
        }
    }

    const executionPhase = (node: ESNode | null, currentScopeIndex: number, withinTryBlock: boolean): ExecStep | undefined => {
        if (!node) return
        console.log("Executing node:", node.type, "in scope:", currentScopeIndex, "withinTry:", withinTryBlock)

        switch (node.type) {
            case "Program": return execBlockStatement(node, currentScopeIndex, withinTryBlock)
            case "BlockStatement": return execBlockStatement(node, currentScopeIndex, withinTryBlock)
            case "ExpressionStatement": return execExpressionStatement(node, currentScopeIndex, withinTryBlock)
            case "Literal": return execLiteral(node, currentScopeIndex, withinTryBlock)
            case "VariableDeclaration": return execVariableDeclaration(node, currentScopeIndex, withinTryBlock)
            case "CallExpression": return execCallExpression(node, currentScopeIndex, withinTryBlock)
            case "Identifier": return execIdentifier(node, currentScopeIndex, withinTryBlock)
            case "BinaryExpression":
            case "LogicalExpression": return execBinaryExpression(node, currentScopeIndex, withinTryBlock)
            case "ReturnStatement": return execReturnStatement(node, currentScopeIndex, withinTryBlock)
            case "ThrowStatement": return execThrowStatement(node, currentScopeIndex, withinTryBlock)
            case "TryStatement": return execTryStatement(node, currentScopeIndex, withinTryBlock)
            case "AssignmentExpression": return execAssignmentExpression(node, currentScopeIndex, withinTryBlock)

            case "MemberExpression":
                {
                    const memberNode = node as any; // Keep cast
                    const objectValue = executionPhase(memberNode.object, currentScopeIndex, withinTryBlock); // Pass withinTryBlock
                    // Allow null and boolean as potential primitive property keys
                    let propertyKey: string | number | boolean | null | undefined | symbol | bigint = undefined;
                    let propertyKeyValue: JSValue | undefined = undefined;
                    let errorMsg: string | undefined = undefined;
                    let resultValue: JSValue = { type: "primitive", value: undefined };

                    // 1. Determine the property key
                    if (memberNode.computed) {
                        const propertyStep = executionPhase(memberNode.property, currentScopeIndex, withinTryBlock); // Pass withinTryBlock
                        propertyKeyValue = propertyStep?.evaluatedValue; // Get the evaluated value
                        if (propertyKeyValue?.type === 'primitive') { // Check type on the evaluated value
                            propertyKey = propertyKeyValue.value; // Assign the primitive value directly
                        } else {
                            errorMsg = "TypeError: Computed property key must be primitive";
                            console.error(errorMsg);
                            propertyKey = undefined; // Error state
                        }
                    } else {
                        // Non-computed: property should be an Identifier (or PrivateIdentifier)
                        if (memberNode.property?.type === 'Identifier') {
                            propertyKey = (memberNode.property as Identifier).name;
                        } else if (memberNode.property?.type === 'PrivateIdentifier') {
                            // Basic simulation might not handle private fields correctly
                            errorMsg = "SyntaxError: Private fields not fully supported in simulation";
                            console.warn(errorMsg);
                            propertyKey = `#${(memberNode.property as any).name}` // Represent symbolically
                        }
                        else {
                            errorMsg = "TypeError: Invalid property identifier";
                            console.error(errorMsg);
                        }
                    }

                    // 2. Perform Property Lookup (only if no error determining key)
                    if (!errorMsg && propertyKey !== undefined) {
                        if (objectValue.type === 'reference') {
                            const heapObject = heap[objectValue.ref];
                            if (heapObject) {
                                if (heapObject.type === 'object') {
                                    // Check own properties first
                                    if (Object.prototype.hasOwnProperty.call(heapObject.properties, String(propertyKey))) {
                                        resultValue = heapObject.properties[String(propertyKey)];
                                    } else {
                                        // TODO: Implement prototype chain lookup
                                        console.warn("Prototype chain lookup not implemented");
                                        resultValue = { type: "primitive", value: undefined };
                                    }
                                } else if (heapObject.type === 'array') {
                                    const index = Number(propertyKey); // Attempt conversion
                                    if (Number.isInteger(index) && index >= 0 && index < heapObject.elements.length) {
                                        resultValue = heapObject.elements[index];
                                    } else if (propertyKey === 'length') {
                                        // Handle array.length property
                                        resultValue = { type: "primitive", value: heapObject.elements.length };
                                    } else {
                                        // TODO: Handle array prototype methods/properties
                                        console.warn(`Array property/method '${String(propertyKey)}' access not fully implemented`);
                                        resultValue = { type: "primitive", value: undefined };
                                    }
                                } else if (heapObject.type === 'function') {
                                    // TODO: Handle function properties (length, name, prototype, etc.)
                                    console.warn(`Function property '${String(propertyKey)}' access not implemented`);
                                    resultValue = { type: "primitive", value: undefined };
                                }
                                // else: Other heap types?
                            } else {
                                // Reference points to non-existent heap object (shouldn't usually happen)
                                errorMsg = `Internal Error: Reference ${objectValue.ref} not found in heap`;
                                console.error(errorMsg);
                                resultValue = { type: "primitive", value: undefined };
                            }
                        } else if (objectValue.type === 'primitive' && objectValue.value !== null && objectValue.value !== undefined) {
                            // Property access on primitives (boxing)
                            // TODO: Implement primitive wrapper object behavior (e.g., "hello".length)
                            console.warn(`Property access on primitive type '${typeof objectValue.value}' not fully implemented`);
                            resultValue = { type: "primitive", value: undefined };
                        }
                        else {
                            // Accessing property on null or undefined
                            errorMsg = `TypeError: Cannot read properties of ${objectValue.value === null ? 'null' : 'undefined'} (reading '${String(propertyKey)}')`;
                            console.error(errorMsg);
                            resultValue = { type: "primitive", value: undefined }; // Error state
                            // If error occurs during property access and not within try, throw real error
                            if (!withinTryBlock) {
                                throw new Error(errorMsg)
                            }
                        }
                    }
                    // If error occurred determining key, result remains undefined
                    else if (!errorMsg) { // Handle case where propertyKey is undefined but no errorMsg yet
                        errorMsg = "Internal Error: Could not determine property key";
                        console.error(errorMsg);
                    }

                    addStep({
                        node: node,
                        pass: "normal",
                        scopeIndex: currentScopeIndex,
                        memoryChange: { type: "none" }, // Assuming no getters for now
                        evaluatedValue: errorMsg ? undefined : resultValue,
                        error: errorMsg
                    })
                    return resultValue; // Return found value or undefined
                }
            // break; // Not needed after return

            case "ArrayExpression":
                {
                    const arrayNode = node as ArrayExpression;
                    const elements: JSValue[] = [];
                    let errorMsg: string | undefined = undefined;

                    if (Array.isArray(arrayNode.elements)) {
                        for (const elementNode of arrayNode.elements) {
                            if (elementNode === null) {
                                // Handle sparse arrays (empty slot)
                                elements.push({ type: "primitive", value: undefined });
                            } else if ((elementNode as ESNode).type === 'SpreadElement') {
                                errorMsg = "Spread elements in arrays not implemented";
                                console.warn(errorMsg);
                                // If error occurs and not within try, throw real error
                                if (!withinTryBlock) throw new Error(errorMsg)
                                break;
                            } else {
                                const elementStep = executionPhase(elementNode, currentScopeIndex, withinTryBlock) // Pass withinTryBlock
                                // Check if executionPhase returned a step and has an evaluated value
                                if (elementStep?.evaluatedValue) {
                                    elements.push(elementStep.evaluatedValue)
                                } else if (elementStep?.errorThrown) {
                                    // If the element evaluation threw an error *within a try block*
                                    // we might record it or handle differently, for now, treat as undefined
                                    // If it threw outside a try, the simulation would have halted earlier
                                    console.warn("Element evaluation resulted in an error step, pushing undefined for now.")
                                    elements.push({ type: "primitive", value: undefined })
                                } else {
                                    // Handle cases where executionPhase returns undefined without error (should be rare)
                                    console.warn("Element evaluation did not return a value or error step, pushing undefined.")
                                    elements.push({ type: "primitive", value: undefined })
                                }
                            }
                        }
                    }

                    let resultValue: JSValue = { type: "primitive", value: undefined };
                    if (!errorMsg) {
                        const arrayObject: HeapObject = { type: "array", elements };
                        const ref = allocateHeapObject(arrayObject);
                        resultValue = { type: "reference", ref };

                        addStep({
                            node: node,
                            pass: "normal",
                            scopeIndex: currentScopeIndex,
                            memoryChange: {
                                type: "create_heap_object",
                                ref: ref,
                                value: arrayObject,
                            },
                            evaluatedValue: resultValue,
                        });
                    } else {
                        addStep({
                            node: node,
                            pass: "normal",
                            scopeIndex: currentScopeIndex,
                            memoryChange: { type: "none" },
                            evaluatedValue: undefined,
                            error: errorMsg
                        })
                    }
                    return resultValue;
                }

            case "ObjectExpression":
                {
                    const objectNode = node as ObjectExpression;
                    const properties: Record<string, JSValue> = {};
                    let errorMsg: string | undefined = undefined;

                    if (Array.isArray(objectNode.properties)) {
                        for (const propNodeUntyped of objectNode.properties) {
                            const propNode = propNodeUntyped as ESNode;
                            if (propNode.type === 'Property') {
                                const property = propNode as Property;
                                let key: string | undefined = undefined;

                                if (!property.computed) {
                                    if (property.key.type === 'Identifier') {
                                        key = (property.key as Identifier).name;
                                    } else if (property.key.type === 'Literal') {
                                        key = String((property.key as Literal).value);
                                    } else {
                                        errorMsg = `Unsupported property key type: ${property.key.type}`;
                                        break;
                                    }
                                } else {
                                    errorMsg = "Computed property keys not implemented";
                                    break;
                                }

                                if (property.kind === 'init') {
                                    let value: JSValue;
                                    if (property.shorthand) {
                                        if (key) {
                                            const lookup = lookupVariable(key, currentScopeIndex);
                                            if (lookup !== -1) {
                                                value = lookup.value;
                                            } else {
                                                errorMsg = `ReferenceError: ${key} is not defined (shorthand property)`;
                                                break;
                                            }
                                        } else { continue; }
                                    } else {
                                        value = executionPhase(property.value, currentScopeIndex, withinTryBlock);
                                    }
                                    if (key !== undefined) {
                                        properties[key] = value;
                                    }
                                } else {
                                    errorMsg = `Property kind ${property.kind} not implemented`;
                                    break;
                                }
                            } else if (propNode.type === 'SpreadElement') {
                                errorMsg = "Spread elements in objects not implemented";
                                break;
                            } else {
                                errorMsg = `Unknown property type in ObjectExpression: ${propNode.type}`;
                                break;
                            }
                        }
                    }

                    let resultValue: JSValue = { type: "primitive", value: undefined };
                    if (!errorMsg) {
                        const objectHeapObject: HeapObject = { type: "object", properties };
                        const ref = allocateHeapObject(objectHeapObject);
                        resultValue = { type: "reference", ref };

                        addStep({
                            node: node,
                            pass: "normal",
                            scopeIndex: currentScopeIndex,
                            memoryChange: {
                                type: "create_heap_object",
                                ref: ref,
                                value: objectHeapObject,
                            },
                            evaluatedValue: resultValue,
                        });
                    } else {
                        addStep({
                            node: node,
                            pass: "normal",
                            scopeIndex: currentScopeIndex,
                            memoryChange: { type: "none" },
                            evaluatedValue: undefined,
                            error: errorMsg
                        })
                    }
                    return resultValue;
                }

            case "ArrowFunctionExpression":
                {
                    const arrowFuncNode = node as ArrowFunctionExpression;

                    // 1. Allocate Function Object on Heap
                    const functionObject: HeapObject = {
                        type: "function",
                        definitionNode: arrowFuncNode, // Store the node itself
                        // CRUCIAL: Arrow functions capture scope lexically
                        closureScopeIndex: currentScopeIndex,
                        // name: undefined // Arrow functions are anonymous unless inferred
                    };
                    const ref = allocateHeapObject(functionObject);
                    const resultValue: JSValue = { type: "reference", ref };

                    // 2. Create Step for the expression evaluation
                    addStep({
                        node: node,
                        pass: "normal",
                        scopeIndex: currentScopeIndex,
                        memoryChange: {
                            type: "create_heap_object",
                            ref: ref,
                            value: functionObject,
                        },
                        evaluatedValue: resultValue, // The reference to the new function
                    });

                    return resultValue;
                }
            // No break needed after return

            case "ConditionalExpression":
                {
                    const condNode = node as any; // Cast to access test, consequent, alternate
                    let resultValue: JSValue = { type: "primitive", value: undefined };
                    let errorMsg: string | undefined = undefined;

                    // 1. Evaluate the test condition
                    const testStep = executionPhase(condNode.test, currentScopeIndex, withinTryBlock); // Pass withinTryBlock
                    const testValue = testStep?.evaluatedValue; // Get evaluated value
                    let isTestTruthy = false // Initialize isTestTruthy here

                    // Handle case where test evaluation itself throws (if withinTryBlock)
                    if (testStep?.errorThrown) {
                        // If the error occurred within a try block, it should be handled there.
                        // If not, the simulation would have halted.
                        // Here, we treat the condition as falsey due to error.
                        console.warn("Conditional test evaluation resulted in an error.")
                        // We could potentially return the error step directly: return testStep;
                        // For simplicity now, treat as falsey.
                        isTestTruthy = false;
                        // If we want to propagate the error step:
                        // return testStep;
                    } else if (testValue) {
                        if (testValue.type === 'primitive') {
                            // Standard JS truthiness check
                            isTestTruthy = Boolean(testValue.value);
                        } else if (testValue.type === 'reference') {
                            // Objects/Arrays/Functions are always truthy
                            isTestTruthy = true;
                        }
                    }
                    // If testValue is undefined (e.g. primitive undefined, or step had no value), it remains falsey

                    // 3. Evaluate the appropriate branch
                    let resultStep: ExecStep | undefined;
                    try { // Keep this inner try-catch for errors *within* the branch evaluation
                        if (isTestTruthy) {
                            resultStep = executionPhase(condNode.consequent, currentScopeIndex, withinTryBlock); // Pass withinTryBlock
                        } else {
                            resultStep = executionPhase(condNode.alternate, currentScopeIndex, withinTryBlock); // Pass withinTryBlock
                        }
                        resultValue = resultStep?.evaluatedValue ?? { type: "primitive", value: undefined }
                        // Handle error propagation from the branch execution
                        if (resultStep?.errorThrown) {
                            // If the chosen branch threw an error (and withinTryBlock was true),
                            // set the error message and potentially return the error step
                            errorMsg = `Error during conditional branch execution: ${JSON.stringify(resultStep.errorThrown)}`
                            // If we want the conditional expression itself to yield the error step:
                            // return resultStep;
                            // Otherwise, record errorMsg and let the addStep below handle it.
                            resultValue = { type: "primitive", value: undefined } // Result is undefined due to error
                        }
                    } catch (e) {
                        // This catch block handles errors thrown *outside* a try block
                        // by the executionPhase calls above, or other synchronous errors.
                        errorMsg = `Error during conditional expression execution: ${e instanceof Error ? e.message : String(e)}`;
                        console.error(errorMsg);
                        resultValue = { type: "primitive", value: undefined }; // Indicate error
                    }

                    // 4. Add step for the overall conditional expression result
                    addStep({
                        node: node,
                        pass: "normal",
                        scopeIndex: currentScopeIndex,
                        memoryChange: { type: "none" },
                        // The evaluated value is the result of the chosen branch
                        evaluatedValue: errorMsg ? undefined : resultValue,
                        error: errorMsg
                    })
                    return resultValue;
                }
            // No break needed after return

            default:
                console.warn(`Execution Pass: Unhandled node type - ${node.type}`)
                break;
        }
    }

    const destructionPhase = (astNode: ESNode, scopeIndex: number) => {
        addPopScopeStep(astNode, scopeIndex)
        console.log("Destruction Phase:", scopeIndex)
    }

    const isBlock = (node: ESNode): boolean => {
        return node.type === "Program" || node?.type === "FunctionDeclaration" || node?.type === "TryStatement" || node?.type === "CatchClause" || node?.type === "BlockStatement"
    }

    const isStrict = (node: ESNode): boolean => {
        return node?.body[0]?.expression?.type === "Literal" && node?.body[0]?.expression?.value === "use strict"
    }
    // --- Simulation Execution --- 
    function traverseAST(astNode: ESNode, scopeIndex: number, strict: boolean, withinTryBlock: boolean): ExecStep | undefined {
        // Check for non-block nodes early to avoid unnecessary scope creation
        if (!isBlock(astNode)) {
            return executionPhase(astNode, scopeIndex, withinTryBlock)
        }

        // For block nodes, handle scope creation and execution
        lastScopeIndex++
        scopeIndex = lastScopeIndex

        // Get the actual block to execute
        const nodeType = astNode.type
        const block = nodeType === "FunctionDeclaration" ? astNode.body :
            nodeType === "TryStatement" ? astNode.block :
                nodeType === "CatchClause" ? astNode.body :
                    astNode

        // Phase 1: Creation - hoisting and declarations
        creationPhase(astNode, scopeIndex)

        // Phase 2: Execution
        const lastStep = executionPhase(block, scopeIndex, withinTryBlock)
        // Phase 3: Destruction - except for global scope
        if (lastStep?.errorThrown && !withinTryBlock) {
            throw new Error(lastStep.errorThrown.value)
        }

        if (scopeIndex !== 0) {
            destructionPhase(block, scopeIndex)
            lastScopeIndex--
        }

        return lastStep
    }

    traverseAST(astNode, 0, false, false)

    console.log("Simulation finished. Steps:", steps.length)
    return steps
}

