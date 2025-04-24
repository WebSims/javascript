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

    // --- Memory Manipulation Helpers (Simplified placeholders) ---
    const newScope = (type: ScopeType): number => {
        const newScopeIndex = scopes.length
        scopes.push({ type, variables: {} })
        return newScopeIndex
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

    // ... more helpers for get/set property, value resolution, etc. ...
    const pushScopeKind = (astNode: ESNode): PushScopeKind => {
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

    const pushScopeType = (astNode: ESNode): ScopeType => {
        switch (astNode.type) {
            case "Program":
                return "global"
            case "FunctionDeclaration":
                return "function"
            default:
                return "block"
        }
    }

    const pushScope = (astNode: ESNode): number => {
        const scopeIndex = scopes.length
        const type = pushScopeType(astNode)
        const scope = { type, variables: {} }
        scopes.push(scope)

        const kind = pushScopeKind(astNode)
        addStep({
            phase: "creation",
            scopeIndex,
            memoryChange: { type: "push_scope", kind, scope },
            node: astNode,
            executing: true,
            executed: false,
            evaluating: false,
            evaluated: false,
        })

        return scopeIndex
    }

    const addMemVal = (value: JSValue) => {
        memVal.push(value)
    }

    const removeMemVal = (value: JSValue) => {
        memVal.splice(memVal.indexOf(value), 1)
    }

    // --- Creation Pass --- 
    const creationPhase = (astNode: ESNode, scopeIndex: number, strict: boolean): void => {
        scopeIndex = pushScope(astNode)

        const declarations: Declaration[] = []

        const body = astNode.type === "Program" ? astNode.body : astNode.body.body

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

        addStep({
            node: astNode,
            phase: "creation",
            scopeIndex,
            memoryChange: { type: "declaration", declarations, scopeIndex },
            executing: true,
            executed: false,
            evaluating: false,
            evaluated: false,
        })

        console.log("Creation Phase:", scopeIndex)
        return scopeIndex
    }

    // --- Execution Pass --- 
    const execProgram = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        const programBody = (astNode as Program).body as ESNode[] | undefined
        let lastStep: ExecStep | undefined
        if (Array.isArray(programBody)) {
            for (const statement of programBody) {
                if (!isBlock(statement)) {
                    addStep({
                        node: statement,
                        phase: "execution",
                        executing: true,
                        executed: false,
                        evaluating: false,
                        evaluated: false,
                        scopeIndex,
                        memoryChange: { type: "none" },
                    })

                    lastStep = executionPhase(statement as ESNode, scopeIndex)
                    if (lastStep) {
                        if (lastStep.evaluatedValue?.type === "error") {
                            return lastStep
                        }

                        addStep({
                            node: statement,
                            phase: "execution",
                            executing: false,
                            executed: true,
                            evaluating: false,
                            evaluated: false,
                            scopeIndex,
                            memoryChange: { type: "none" },
                        })
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
            if (!isBlock(statement)) {
                addStep({
                    node: statement,
                    phase: "execution",
                    scopeIndex,
                    memoryChange: { type: "none" },
                    executing: true,
                    executed: false,
                    evaluating: false,
                    evaluated: false,
                })

                lastStep = executionPhase(statement, scopeIndex)

                if (lastStep) {
                    if (lastStep.evaluatedValue?.type === "error") {
                        return lastStep
                    }

                    addStep({
                        node: statement,
                        phase: "execution",
                        scopeIndex,
                        memoryChange: { type: "none" },
                        executing: false,
                        executed: true,
                        evaluating: false,
                        evaluated: false,
                    })
                }
            }
        }
        return lastStep
    }

    const execExpressionStatement = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        const expressionNode = (astNode as ExpressionStatement).expression
        const lastStep = executionPhase(expressionNode, scopeIndex)
        if (lastStep.evaluatedValue) removeMemVal(lastStep.evaluatedValue)
        return lastStep
    }

    const execLiteral = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        let evaluatedValue: JSValue;
        const literalValue = astNode.value

        addStep({
            node: astNode,
            phase: "execution",
            scopeIndex,
            memoryChange: { type: "none" },
            executing: false,
            executed: false,
            evaluating: true,
            evaluated: false,
        })

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
                    addStep({
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
        return
    }

    const execCallExpression = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        addStep({
            node: astNode,
            phase: "execution",
            scopeIndex,
            memoryChange: { type: "none" },
            executing: false,
            executed: false,
            evaluating: true,
            evaluated: false,
        })

        let lastStep = executionPhase(astNode.callee, scopeIndex)
        const object = heap[lastStep.evaluatedValue?.ref]
        if (object?.type === "function") {
            addStep({
                node: astNode,
                phase: "execution",
                scopeIndex,
                memoryChange: { type: "none" },
                executing: false,
                executed: false,
                evaluating: true,
                evaluated: false,
                evaluatedValue: lastStep.evaluatedValue,
            })

            lastStep = traverseAST(object.node as ESNode, scopeIndex, false)

            return addStep({
                node: astNode,
                phase: "execution",
                scopeIndex,
                memoryChange: { type: "none" },
                executing: false,
                executed: false,
                evaluating: false,
                evaluated: true,
                evaluatedValue: lastStep.evaluatedValue,
            })
        } else {
            const error = { type: "error", value: 'TypeError: ' + varName + ' is not a function' } as const
            return addStep({
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
        }
    }

    const execIdentifier = (astNode: ESNode, scopeIndex: number): ExecStep | undefined => {
        addStep({
            node: astNode,
            phase: "execution",
            scopeIndex,
            memoryChange: { type: "none" },
            executing: false,
            executed: false,
            evaluating: true,
            evaluated: false,
        })

        const varName = (astNode as Identifier).name;
        const variable = lookupVariable(varName, scopeIndex)
        if (variable !== -1) {
            if (variable.value.type === "reference") {
                addMemVal(variable.value)
                return addStep({
                    node: astNode,
                    phase: "execution",
                    scopeIndex,
                    memoryChange: { type: "none" },
                    executing: false,
                    executed: false,
                    evaluating: false,
                    evaluated: true,
                    evaluatedValue: variable.value
                })
            } else if (variable.value.type === "primitive") {
                addMemVal(variable.value)
                return addStep({
                    node: astNode,
                    phase: "execution",
                    scopeIndex,
                    memoryChange: { type: "none" },
                    executing: false,
                    executed: false,
                    evaluating: false,
                    evaluated: true,
                    evaluatedValue: variable.value
                })
            }
        } else {
            const error = { type: "error", value: 'ReferenceError: ' + varName + ' is not defined' } as const

            return addStep({
                node: node,
                phase: "execution",
                scopeIndex,
                memoryChange: { type: "none" },
                errorThrown: error
            })
        }
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

            case "AssignmentExpression":
                console.warn("Execution Pass TODO: AssignmentExpression")
                break;

            case "BinaryExpression":
            case "LogicalExpression":
                {
                    const binNode = node
                    addStep({
                        node: node,
                        phase: "execution",
                        scopeIndex: currentScopeIndex,
                        memoryChange: { type: "none" },
                        executing: false,
                        executed: false,
                        evaluating: true,
                        evaluated: false
                    })

                    let leftStep: ExecStep | undefined
                    let rightStep: ExecStep | undefined

                    if (binNode.operator === "&&") {
                        leftStep = executionPhase(binNode.left, currentScopeIndex)
                        if (leftStep.evaluatedValue?.value === true) rightStep = executionPhase(binNode.right, currentScopeIndex)
                        else rightStep = { type: "primitive", value: false }
                    } else if (binNode.operator === "||") {
                        leftStep = executionPhase(binNode.left, currentScopeIndex)
                        if (leftStep.evaluatedValue?.value === true) rightStep = { type: "primitive", value: true }
                        else rightStep = executionPhase(binNode.right, currentScopeIndex)
                    } else {
                        leftStep = executionPhase(binNode.left, currentScopeIndex);
                        rightStep = executionPhase(binNode.right, currentScopeIndex);
                    }

                    if (binNode.operator) {
                        const value = eval(`${leftStep.evaluatedValue?.value}${binNode.operator}${rightStep.evaluatedValue?.value}`)
                        const evaluatedValue = {
                            type: "primitive",
                            value
                        }

                        removeMemVal(leftStep.evaluatedValue)
                        removeMemVal(rightStep.evaluatedValue)
                        addMemVal(evaluatedValue)
                        return addStep({
                            node: node,
                            phase: "execution",
                            scopeIndex: currentScopeIndex,
                            memoryChange: { type: "none" },
                            executing: false,
                            executed: false,
                            evaluating: false,
                            evaluated: true,
                            evaluatedValue,
                        })

                    }
                }
                break;

            case "ReturnStatement":
                {
                    const returnNode = node as ReturnStatement;
                    return executionPhase(returnNode.argument, currentScopeIndex)
                }

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
        const heapItems = Object.values(scopes[scopeIndex].variables)
            .filter((item): item is Extract<JSValue, { type: 'reference' }> => item.type === 'reference') // Use type predicate
        heapItems.forEach(item => {
            delete heap[item.ref] // Safe access now
        })
        scopes.splice(scopeIndex, 1)

        addStep({
            node: astNode,
            phase: "destruction",
            scopeIndex: scopeIndex,
            memoryChange: { type: "pop_scope", scopeIndex },
            evaluatedValue: undefined,
            executing: false,
            executed: false,
            evaluating: false,
            evaluated: false,
        })
        console.log("Destruction Phase:", scopeIndex)
    }

    const isBlock = (node: ESNode): boolean => {
        return node.type === "Program" || node?.body?.type === "BlockStatement"
    }

    const isStrict = (node: ESNode): boolean => {
        return node?.body[0]?.expression?.type === "Literal" && node?.body[0]?.expression?.value === "use strict"
    }
    // --- Simulation Execution --- 
    function traverseAST(astNode: ESNode, scopeIndex: number, strict: boolean) {
        try {
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
                strict = isStrict(astNode)

                creationPhase(astNode, scopeIndex, strict)
                const lastStep = executionPhase(astNode.type === "Program" ? astNode : astNode.body, scopeIndex) // Start execution from the Program node in global scope
                if (lastStep?.evaluatedValue?.type === "error") {
                    return lastStep
                }

                if (scopeIndex !== 0) {
                    destructionPhase(astNode, scopeIndex)
                    lastScopeIndex--
                }
                return lastStep
            } else {
                return executionPhase(astNode, scopeIndex)
            }
        } catch (error) {
            console.error("Error during simulation:", error)
            // Potentially add a final error step to the steps array
            // addStep({
            //     node: astNode, // Or find a better node association
            //     pass: "normal",
            //     scopeIndex: scopes.length - 1, // Last known scope
            //     memoryChange: { type: "none" },
            //     error: error instanceof Error ? error.message : String(error)
            // })
        }
    }

    traverseAST(astNode, 0, false)

    console.log("Simulation finished. Steps:", steps.length)
    return steps
}

