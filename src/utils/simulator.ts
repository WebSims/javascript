import { ESNode, Program, VariableDeclarator, Identifier, Literal, VariableDeclaration, ArrayExpression, ObjectExpression, Property, ArrowFunctionExpression, ExpressionStatement } from "hermes-parser"
import { ExecStep, JSValue, Scope, Heap, MemoryChange, HeapObject, HeapRef, Declaration, TDZ, ScopeType, PushScopeKind } from "../types/simulation"
import { cloneDeep, result } from "lodash" // Import cloneDeep from lodash
import { BinaryExpression, CallExpression, FunctionDeclaration, Node, ReturnStatement } from "typescript"

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
    const memVal: JSValue[] = []
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
                    return "function"
                default:
                    return "block"
            }
        }
        const type = getPushScopeType(astNode)
        const { scope, scopeIndex } = newScope(type)

        const getPushScopeKind = (astNode: ESNode): PushScopeKind => {
            switch (astNode.type) {
                case "Program":
                    return "program"
                case "FunctionDeclaration":
                    return "function"
                case "TryStatement":
                    return "try"
                default:
                    return "block"
            }
        }
        const kind = getPushScopeKind(astNode)

        return addStep({
            phase: "creation",
            scopeIndex,
            memoryChange: { type: "push_scope", kind, scope },
            node: astNode,
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
    const addExecutionStep = (astNode: ESNode, scopeIndex: number): ExecStep => {
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
    const addExecutedStep = (astNode: ESNode, scopeIndex: number, evaluatedValue?: JSValue): ExecStep => {
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
    const addPopScopeStep = (astNode: ESNode, scopeIndex: number): ExecStep => {
        const heapItems = Object.values(scopes[scopeIndex].variables)
            .filter((item): item is Extract<JSValue, { type: 'reference' }> => item.type === 'reference')
        heapItems.forEach(item => {
            delete heap[item.ref]
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

    // --- Creation Pass --- 
    const creationPhase = (astNode: ESNode, scopeIndex: number): void => {
        scopeIndex = addPushScopeStep(astNode).scopeIndex

        const declarations: Declaration[] = []
        const body = astNode.type === "CatchClause" ? astNode.body.body : astNode.body

        for (const node of body) {
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

        addHoistingStep(astNode, scopeIndex, declarations)
        console.log("Creation Phase:", scopeIndex)
    }

    // --- Execution Pass --- 
    const execProgram = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        const programBody = (astNode as Program).body as ESNode[] | undefined
        let lastStep: ExecStep | undefined
        if (Array.isArray(programBody)) {
            for (const statement of programBody) {
                if (statement.type !== "FunctionDeclaration") {
                    addExecutionStep(statement, scopeIndex)
                    lastStep = executionPhase(statement as ESNode, scopeIndex)
                    if (lastStep?.node?.type !== statement.type && lastStep?.node?.type !== "ThrowStatement") {
                        addExecutedStep(statement, scopeIndex)
                    }
                    if (statement.type === "ReturnStatement") {
                        return lastStep
                    }
                    if (statement.type === "ThrowStatement") {
                        return lastStep
                    }
                }
            }
        }
        return lastStep
    }

    const execBlockStatement = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        const statements = astNode.body as ESNode[]
        let lastStep: ExecStep | undefined
        for (const statement of statements) {
            if (statement.type !== "FunctionDeclaration") {
                addExecutionStep(statement, scopeIndex)
                lastStep = executionPhase(statement, scopeIndex)

                if (lastStep?.node?.type !== statement.type && lastStep?.node?.type !== "ThrowStatement") {
                    return addExecutedStep(statement, scopeIndex)
                }
                if (statement.type === "ReturnStatement") {
                    return lastStep
                }
                if (statement.type === "ThrowStatement") {
                    return lastStep
                }
            }
        }
        return lastStep
    }

    const execExpressionStatement = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        const expressionNode = (astNode as ExpressionStatement).expression
        const lastStep = executionPhase(expressionNode, scopeIndex)
        if (lastStep?.evaluatedValue) removeMemVal(lastStep.evaluatedValue)
        return lastStep
    }

    const execLiteral = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
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

    const execVariableDeclaration = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        if (astNode.kind === "const" && astNode.declarations.length === 0) {
            console.warn("Unhandled const declaration pattern in execution:", astNode.kind)
        }

        if (Array.isArray(astNode.declarations)) {
            for (const declarator of (astNode.declarations as VariableDeclarator[])) {
                if (declarator.id?.type === 'Identifier' && declarator.init) {
                    const idNode = declarator.id as Identifier;
                    const varName = idNode.name;

                    const lastStep = executionPhase(declarator.init, scopeIndex)
                    const targetScopeIndex = writeVariable(varName, lastStep.evaluatedValue, scopeIndex)

                    removeMemVal(lastStep.evaluatedValue)
                    return addStep({
                        node: astNode,
                        scopeIndex,
                        memoryChange: {
                            type: "write_variable",
                            scopeIndex: targetScopeIndex,
                            variableName: varName,
                            value: lastStep.evaluatedValue,
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

    const execCallExpression = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        addEvaluatingStep(astNode, scopeIndex)

        let lastStep = executionPhase(astNode.callee, scopeIndex)
        const object = heap[lastStep.evaluatedValue?.ref]
        if (object?.type === "function") {
            addEvaluatingStep(astNode, scopeIndex)
            removeMemVal(lastStep?.evaluatedValue)

            lastStep = traverseAST(object.node as ESNode, scopeIndex, false)

            if (lastStep?.node?.type === "ThrowStatement") {
                return lastStep
            } else {
                return addEvaluatedStep(astNode, scopeIndex, lastStep?.evaluatedValue)
            }
        } else {
            const error = { type: "error", value: 'TypeError: ' + lastStep?.node.name + ' is not a function' } as const
            addStep({
                node: astNode,
                phase: "execution",
                scopeIndex,
                memoryChange: { type: "none" },
                errorThrown: error,
                executing: false,
                executed: false,
                evaluating: false,
                evaluated: false,
            })
            throw Error(error.value)
        }
    }

    const execIdentifier = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        addEvaluatingStep(astNode, scopeIndex)

        const varName = (astNode as Identifier).name;
        if (varName === 'undefiend') {
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
            addStep({
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
            throw Error(error.value)
        }
    }

    const execBinaryExpression = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        addEvaluatingStep(astNode, scopeIndex)

        let leftStep: ExecStep | undefined
        let rightStep: ExecStep | undefined

        if (astNode.operator === "&&") {
            leftStep = executionPhase(astNode.left, scopeIndex)
            if (leftStep?.evaluatedValue?.value === true) rightStep = executionPhase(astNode.right, scopeIndex)
            else rightStep = { type: "primitive", value: false }
        } else if (astNode.operator === "||") {
            leftStep = executionPhase(astNode.left, scopeIndex)
            if (leftStep?.evaluatedValue?.value === true) rightStep = { type: "primitive", value: true }
            else rightStep = executionPhase(astNode.right, scopeIndex)
        } else {
            leftStep = executionPhase(astNode.left, scopeIndex);
            rightStep = executionPhase(astNode.right, scopeIndex);
        }

        if (astNode.operator) {
            const value = eval(`${leftStep?.evaluatedValue?.value}${astNode.operator}${rightStep?.evaluatedValue?.value}`)
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

    const execReturnStatement = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        if (astNode.argument) {
            return executionPhase(astNode.argument, scopeIndex)
        } else {
            addMemVal({ type: 'primitive', value: undefined })
            return addExecutedStep(astNode, scopeIndex, { type: 'primitive', value: undefined })
        }
    }

    const execThrowStatement = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        const lastStep = executionPhase(astNode.argument, scopeIndex)
        // return lastStep
        return addStep({
            node: astNode,
            phase: 'execution',
            scopeIndex,
            memoryChange: { type: 'none' },
            errorThrown: lastStep?.evaluatedValue,
            executing: false,
            executed: true,
            evaluating: false,
            evaluated: false,
        })
    }

    // --- TryStatement Execution ---
    const execTryStatement = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        traverseAST(astNode, scopeIndex, false)
        return executionPhase(astNode.handler, scopeIndex)
    }

    const execCatchClause = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        return traverseAST(astNode, scopeIndex, false)
    }

    const executionPhase = (node: ESNode | null, currentScopeIndex: number): ExecStep | undefined => {
        if (!node) return { type: "primitive", value: undefined }
        console.log("Executing node:", node.type, "in scope:", currentScopeIndex)

        switch (node.type) {
            case "Program": return execProgram(node, currentScopeIndex)
            case "ExpressionStatement": return execExpressionStatement(node, currentScopeIndex)
            case "BlockStatement": return execBlockStatement(node, currentScopeIndex)
            case "Literal": return execLiteral(node, currentScopeIndex)
            case "VariableDeclaration": return execVariableDeclaration(node, currentScopeIndex)
            case "CallExpression": return execCallExpression(node, currentScopeIndex)
            case "Identifier": return execIdentifier(node, currentScopeIndex)
            case "BinaryExpression":
            case "LogicalExpression": return execBinaryExpression(node, currentScopeIndex)
            case "ReturnStatement": return execReturnStatement(node, currentScopeIndex)
            case "ThrowStatement": return execThrowStatement(node, currentScopeIndex)
            case "TryStatement": return execTryStatement(node, currentScopeIndex)
            case "CatchClause": return execCatchClause(node, currentScopeIndex)

            case "MemberExpression":
                {
                    const memberNode = node as any; // Keep cast
                    const objectValue = executionPhase(memberNode.object, currentScopeIndex); // Use const
                    // Allow null and boolean as potential primitive property keys
                    let propertyKey: string | number | boolean | null | undefined | symbol | bigint = undefined;
                    let propertyKeyValue: JSValue | undefined = undefined;
                    let errorMsg: string | undefined = undefined;
                    let resultValue: JSValue = { type: "primitive", value: undefined };

                    // 1. Determine the property key
                    if (memberNode.computed) {
                        propertyKeyValue = executionPhase(memberNode.property, currentScopeIndex);
                        if (propertyKeyValue.type === 'primitive') {
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
                                break;
                            } else {
                                elements.push(executionPhase(elementNode, currentScopeIndex));
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
                                        value = executionPhase(property.value, currentScopeIndex);
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
                    const testValue = executionPhase(condNode.test, currentScopeIndex);

                    // 2. Determine truthiness (simplified)
                    let isTestTruthy = false;
                    if (testValue.type === 'primitive') {
                        // Standard JS truthiness check
                        isTestTruthy = Boolean(testValue.value);
                    } else if (testValue.type === 'reference') {
                        // Objects/Arrays/Functions are always truthy
                        isTestTruthy = true;
                    }
                    // If testValue is undefined (e.g., due to an error), it remains falsey

                    // 3. Evaluate the appropriate branch
                    try {
                        if (isTestTruthy) {
                            resultValue = executionPhase(condNode.consequent, currentScopeIndex);
                        } else {
                            resultValue = executionPhase(condNode.alternate, currentScopeIndex);
                        }
                    } catch (e) {
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
        return node.type === "Program" || node?.type === "FunctionDeclaration" || node?.type === "TryStatement" || node?.type === "CatchClause"
    }

    const isStrict = (node: ESNode): boolean => {
        return node?.body[0]?.expression?.type === "Literal" && node?.body[0]?.expression?.value === "use strict"
    }
    // --- Simulation Execution --- 
    function traverseAST(astNode: ESNode, scopeIndex: number, strict: boolean): ExecStep | undefined {
        // Phase 1: Creation
        // FunctionDeclaration - Function declarations are completely hoisted with their bodies
        // VariableDeclaration - With var keyword (not let or const)
        // ClassDeclaration - Class declarations are hoisted but remain uninitialized until the class expression is evaluated

        // Phase 2: Execution
        // executionPhase(astNode.type === "Program" ? astNode : astNode.body, scopeIndex) // Start execution from the Program node in global scope

        // Phase 3: Destruction
        if (isBlock(astNode)) {
            lastScopeIndex++
            scopeIndex = lastScopeIndex
            strict = false

            creationPhase(
                astNode.type === "FunctionDeclaration" ? astNode.body :
                    astNode.type === "TryStatement" ? astNode.block :
                        astNode.type === "CatchClause" ? astNode.body :
                            astNode,
                scopeIndex,
                strict
            )
            const block = astNode.type === "FunctionDeclaration" ? astNode.body :
                astNode.type === "TryStatement" ? astNode.block :
                    astNode.type === "CatchClause" ? astNode.body :
                        astNode
            const lastStep = executionPhase(
                block,
                scopeIndex
            )

            const isNodeInBody = (astNode: ESNode, body: ESNode[]) => {
                return body.some(node => node.type === astNode.type && node.range[0] === astNode.range[0] && node.range[1] === astNode.range[1])
            }

            if (!isNodeInBody(lastStep?.node, block.body) && lastStep?.node.type === "ThrowStatement" && astNode.type !== "TryStatement") {
                throw lastStep.errorThrown
            }

            if (scopeIndex !== 0) {
                destructionPhase(
                    astNode.type === "FunctionDeclaration" ? astNode.body :
                        astNode.type === "TryStatement" ? astNode.block :
                            astNode.type === "CatchClause" ? astNode.body :
                                astNode,
                    scopeIndex)
                lastScopeIndex--
            }
            return lastStep
        } else {
            return executionPhase(astNode, scopeIndex)
        }
    }

    try {
        traverseAST(astNode, 0, false)
    } catch (error) {
        console.error("Error during simulation:", error)
    }

    console.log("Simulation finished. Steps:", steps.length)
    return steps
}

