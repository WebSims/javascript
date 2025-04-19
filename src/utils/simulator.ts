import { ESNode, Program, VariableDeclarator, Identifier, Literal, VariableDeclaration, ArrayExpression, ObjectExpression, Property, ArrowFunctionExpression } from "hermes-parser"
import { ExecStep, JSValue, Scope, Heap, MemoryChange, HeapObject, HeapRef } from "../types/simulation"
import { cloneDeep } from "lodash" // Import cloneDeep from lodash

/**
 * Simulates the execution of JavaScript code represented by an AST.
 * Performs a two-pass process: hoisting followed by execution.
 *
 * @param programNode The root Program node of the AST.
 * @returns An array of execution steps representing the simulation.
 */
export const simulateExecution = (programNode: ESNode | null): ExecStep[] => {
    // Ensure we have a valid Program node
    if (!programNode || programNode.type !== "Program") {
        console.error("Invalid AST provided to simulateExecution; expected Program node.")
        return []
    }
    // Now we know programNode is a Program
    const ast = programNode as Program

    const steps: ExecStep[] = []
    const scopes: Scope[] = [{ type: "global", variables: {} }] // Start with global scope
    const heap: Heap = {} // Use const
    let nextRef: HeapRef = 0
    let stepCounter: number = 0

    // --- Helper Functions ---

    const getNextRef = (): HeapRef => nextRef++

    const createMemorySnapshot = (): ExecStep["memorySnapshot"] => {
        // Crucial: Use a reliable deep copy mechanism here!
        // Use lodash cloneDeep
        return cloneDeep({ scopes, heap })
    }

    const addStep = (stepData: Omit<ExecStep, "index" | "memorySnapshot">): void => {
        const snapshot = createMemorySnapshot()
        steps.push({
            ...stepData,
            index: stepCounter++,
            memorySnapshot: snapshot,
        })
    }

    // --- Memory Manipulation Helpers (Simplified placeholders) ---

    const allocateHeapObject = (obj: HeapObject): HeapRef => {
        const ref = getNextRef()
        heap[ref] = obj
        // TODO: Consider a step for heap allocation?
        return ref
    }

    const lookupVariable = (name: string, startingScopeIndex: number): { value: JSValue | undefined, scopeIndex: number } => {
        for (let i = startingScopeIndex; i >= 0; i--) {
            if (Object.prototype.hasOwnProperty.call(scopes[i].variables, name)) {
                return { value: scopes[i].variables[name], scopeIndex: i }
            }
        }
        return { value: undefined, scopeIndex: -1 } // Not found
    }

    const declareVariable = (name: string, kind: Extract<MemoryChange, { type: 'declare_variable' }>['kind'], scopeIndex: number, initialValue: JSValue): void => {
        if (scopeIndex < 0 || scopeIndex >= scopes.length) {
            console.error(`Invalid scopeIndex ${scopeIndex} for declaring ${name}`)
            return
        }
        scopes[scopeIndex].variables[name] = initialValue
        // Step generation happens in the passes
    }

    const writeVariable = (name: string, value: JSValue, scopeIndex: number): boolean => {
        const lookup = lookupVariable(name, scopeIndex)
        if (lookup.scopeIndex !== -1) {
            scopes[lookup.scopeIndex].variables[name] = value
            return true
        }
        // Handle potential ReferenceError or global assignment (if intended)
        console.warn(`Attempted to write to undeclared variable ${name}`)
        // For simplicity, let's assign to global if not found (like non-strict mode)
        scopes[0].variables[name] = value // Or throw error
        return false // Indicate it wasn't found in declared scopes
    }

    const declareFunction = (name: string, scopeIndex: number, functionRef: HeapRef): void => {
        if (scopeIndex < 0 || scopeIndex >= scopes.length) {
            console.error(`Invalid scopeIndex ${scopeIndex} for declaring ${name}`)
            return
        }
        scopes[scopeIndex].variables[name] = { type: "reference", ref: functionRef }
    }

    // ... more helpers for get/set property, value resolution, etc. ...

    // --- Hoisting Pass --- 
    const hoistingPass = (nodes: ESNode[], currentScopeIndex: number): void => {
        console.log("Starting Hoisting Pass for scope:", currentScopeIndex)
        for (const node of nodes) {
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

                                // 2. Declare Variable in Current Scope
                                declareFunction(functionName, currentScopeIndex, ref)

                                // 3. Create Hoisting Step
                                addStep({
                                    node: node,
                                    pass: "hoisted",
                                    scopeIndex: currentScopeIndex,
                                    memoryChange: {
                                        type: "declare_function",
                                        variableName: functionName,
                                        functionRef: ref,
                                        scopeIndex: currentScopeIndex,
                                    },
                                })
                            } else {
                                console.warn("FunctionDeclaration id is not an Identifier?", idNode)
                            }
                        } else {
                            console.warn("Hoisting unnamed FunctionDeclaration?", node)
                        }
                    }
                    break;

                case "VariableDeclaration":
                    if (node.kind === "var" && Array.isArray(node.declarations)) {
                        for (const declarator of (node.declarations as VariableDeclarator[])) {
                            if (declarator.id?.type === "Identifier") {
                                const idNode = declarator.id as Identifier
                                const varName = idNode.name
                                const initialValue: JSValue = { type: "primitive", value: undefined }
                                declareVariable(varName, "var", currentScopeIndex, initialValue)
                                addStep({
                                    node: declarator,
                                    pass: "hoisted",
                                    scopeIndex: currentScopeIndex,
                                    memoryChange: {
                                        type: "declare_variable",
                                        scopeIndex: currentScopeIndex,
                                        variableName: varName,
                                        kind: "var"
                                    }
                                })
                            } else {
                                console.warn("Unhandled var declaration pattern in hoisting:", declarator.id?.type)
                            }
                        }
                    }
                    break;

                // TODO: Handle hoisting within nested blocks if needed (though var/function are function-scoped)
                // case "BlockStatement":
                //     hoistingPass(node.body, currentScopeIndex) // Recurse carefully
                //     break
            }
        }
        console.log("Finished Hoisting Pass for scope:", currentScopeIndex)
    }

    // --- Execution Pass --- 
    const executionPass = (node: ESNode | null, currentScopeIndex: number): JSValue => {
        if (!node) return { type: "primitive", value: undefined }

        console.log("Executing node:", node.type, "in scope:", currentScopeIndex)

        switch (node.type) {
            case "Program":
                {
                    const programBody = (node as Program).body as ESNode[] | undefined // Explicit cast
                    let lastValue: JSValue = { type: "primitive", value: undefined };
                    if (Array.isArray(programBody)) {
                        for (const statement of programBody) {
                            lastValue = executionPass(statement as ESNode, currentScopeIndex) // Keep cast
                        }
                    }
                    return lastValue
                }

            case "ExpressionStatement":
                {
                    // Cast node to any to access the 'expression' property
                    const expressionNode = (node as any).expression
                    const exprValue = executionPass(expressionNode, currentScopeIndex)
                    addStep({
                        node: node,
                        pass: "normal",
                        scopeIndex: currentScopeIndex,
                        memoryChange: { type: "none" },
                        evaluatedValue: exprValue
                    })
                    return exprValue
                }

            case "Identifier":
                {
                    // Node is Identifier here
                    const identifierNode = node as Identifier // Cast for clarity
                    const name = identifierNode.name
                    const lookup = lookupVariable(name, currentScopeIndex)
                    if (lookup.value !== undefined) {
                        addStep({
                            node: identifierNode,
                            pass: "normal",
                            scopeIndex: currentScopeIndex,
                            memoryChange: { type: "none" },
                            evaluatedValue: lookup.value
                        })
                        return lookup.value
                    } else {
                        // ReferenceError
                        const errorMsg = `ReferenceError: ${name} is not defined`
                        console.error(errorMsg)
                        addStep({
                            node: identifierNode,
                            pass: "normal",
                            scopeIndex: currentScopeIndex,
                            memoryChange: { type: "none" },
                            error: errorMsg
                        })
                        // How to handle errors? Throw? Return special error value?
                        // For now, return undefined and log
                        return { type: "primitive", value: undefined }
                    }
                }
                break;

            case "Literal":
                {
                    const literalNode = node as Literal
                    let value: JSValue;
                    const literalValue = literalNode.value

                    if (literalValue === null) {
                        value = { type: "primitive", value: null };
                    } else if (typeof literalValue === 'string' || typeof literalValue === 'number' || typeof literalValue === 'boolean') {
                        value = { type: "primitive", value: literalValue };
                        // Last resort: cast to any to bypass instanceof type check issue
                    } else if (typeof literalValue === 'object' && literalValue !== null && (literalValue as any) instanceof RegExp) {
                        console.warn("RegExp Literal evaluation not fully implemented")
                        value = { type: "primitive", value: literalNode.raw };
                    } else {
                        console.warn("Unhandled Literal type:", typeof literalValue)
                        value = { type: "primitive", value: undefined };
                    }

                    addStep({
                        node: literalNode,
                        pass: "normal",
                        scopeIndex: currentScopeIndex,
                        memoryChange: { type: "none" },
                        evaluatedValue: value
                    })
                    return value
                }
                break;

            // --- Placeholder for more node types ---
            case "VariableDeclaration":
                {
                    // node is VariableDeclaration here
                    const varDeclNode = node as VariableDeclaration; // Use imported type

                    if (varDeclNode.kind === 'let' || varDeclNode.kind === 'const') {
                        // Handle let/const declarations and initializations
                        if (Array.isArray(varDeclNode.declarations)) {
                            for (const declarator of (varDeclNode.declarations as VariableDeclarator[])) {
                                if (declarator.id?.type === 'Identifier') {
                                    const idNode = declarator.id as Identifier;
                                    const varName = idNode.name;

                                    // --- Declaration Step ---
                                    // Declaring in the current scope index.
                                    // NOTE: True block scope requires more sophisticated scope management
                                    //       (e.g., pushing/popping scopes for BlockStatements).
                                    // For now, let/const are declared in the current function/global scope.
                                    // Representing TDZ simply by declaring with undefined initially.
                                    const declaredValue: JSValue = { type: "primitive", value: undefined };
                                    declareVariable(varName, varDeclNode.kind, currentScopeIndex, declaredValue);

                                    addStep({
                                        node: declarator,
                                        pass: "normal",
                                        scopeIndex: currentScopeIndex,
                                        memoryChange: {
                                            type: "declare_variable",
                                            scopeIndex: currentScopeIndex,
                                            variableName: varName,
                                            kind: varDeclNode.kind,
                                        },
                                    });

                                    // --- Initialization Step ---
                                    let initValue: JSValue;
                                    let errorMsg: string | undefined = undefined;

                                    if (declarator.init) {
                                        // Evaluate the initializer expression
                                        initValue = executionPass(declarator.init, currentScopeIndex);
                                    } else {
                                        if (varDeclNode.kind === 'const') {
                                            // Error: Missing initializer in const declaration
                                            errorMsg = `SyntaxError: Missing initializer in const declaration for '${varName}'`;
                                            console.error(errorMsg);
                                            // Assign undefined for simulation continuation, but mark error
                                            initValue = { type: "primitive", value: undefined };
                                        } else {
                                            // 'let' without initializer defaults to undefined
                                            initValue = { type: "primitive", value: undefined };
                                        }
                                    }

                                    // Write the initialized value directly to the current scope's variables
                                    scopes[currentScopeIndex].variables[varName] = initValue;

                                    addStep({
                                        node: declarator.init ?? declarator, // Step involves initializer if present
                                        pass: "normal",
                                        scopeIndex: currentScopeIndex,
                                        memoryChange: {
                                            type: "write_variable",
                                            scopeIndex: currentScopeIndex, // Written in the same scope it was declared
                                            variableName: varName,
                                            value: initValue,
                                        },
                                        evaluatedValue: errorMsg ? undefined : initValue, // Value assigned, unless error
                                        error: errorMsg,
                                    });

                                } else {
                                    // TODO: Handle destructuring patterns if needed
                                    console.warn(`Execution Pass: Unhandled declaration pattern in ${varDeclNode.kind}:`, declarator.id?.type);
                                }
                            }
                        }
                    } else {
                        // Handle 'var' initialization (declaration happened in hoisting pass)
                        if (Array.isArray(varDeclNode.declarations)) {
                            for (const declarator of (varDeclNode.declarations as VariableDeclarator[])) {
                                // Only process 'var' declarators that have an initializer
                                if (declarator.id?.type === 'Identifier' && declarator.init) {
                                    const idNode = declarator.id as Identifier;
                                    const varName = idNode.name;

                                    // Evaluate the initializer
                                    const initValue = executionPass(declarator.init, currentScopeIndex);

                                    // Find where 'var' was hoisted (could be current or outer scope)
                                    // and write the value there.
                                    const lookup = lookupVariable(varName, currentScopeIndex);
                                    const targetScopeIndex = lookup.scopeIndex !== -1 ? lookup.scopeIndex : 0; // Default to global if somehow not found
                                    scopes[targetScopeIndex].variables[varName] = initValue;
                                    // Note: writeVariable helper could also be used here if preferred

                                    addStep({
                                        node: declarator.init, // Step associated with the initializer execution
                                        pass: "normal",
                                        scopeIndex: currentScopeIndex, // Execution happens in current scope...
                                        memoryChange: {
                                            type: "write_variable",
                                            scopeIndex: targetScopeIndex, // ...but write happens in the var's scope
                                            variableName: varName,
                                            value: initValue,
                                        },
                                        evaluatedValue: initValue // The result of the initializer
                                    });
                                }
                                // No step needed for var declarators without initializers during execution pass
                            }
                        }
                    }
                }
                break; // End of VariableDeclaration case

            case "FunctionDeclaration":
                // Generally skip in execution pass (already hoisted)
                break;

            case "AssignmentExpression":
                console.warn("Execution Pass TODO: AssignmentExpression")
                break;

            case "BinaryExpression":
                {
                    const binNode = node as any; // Cast to access left, right, operator
                    const leftValue = executionPass(binNode.left, currentScopeIndex);
                    const rightValue = executionPass(binNode.right, currentScopeIndex);

                    let resultValue: JSValue = { type: "primitive", value: undefined };
                    let errorMsg: string | undefined = undefined;

                    // Helper to extract primitive value
                    const getPrimitiveValue = (jsVal: JSValue): number | string | boolean | null | undefined | bigint | symbol => {
                        if (jsVal.type === 'primitive') {
                            return jsVal.value;
                        }
                        console.warn("Binary operation on non-primitive reference not fully handled", jsVal);
                        return NaN;
                    };

                    const leftPrim = getPrimitiveValue(leftValue);
                    const rightPrim = getPrimitiveValue(rightValue);

                    try {
                        switch (binNode.operator) {
                            case '+':
                                if (typeof leftPrim === 'string' || typeof rightPrim === 'string') {
                                    resultValue = { type: "primitive", value: String(leftPrim ?? '') + String(rightPrim ?? '') };
                                } else {
                                    resultValue = { type: "primitive", value: Number(leftPrim) + Number(rightPrim) };
                                }
                                break;
                            case '-': resultValue = { type: "primitive", value: Number(leftPrim) - Number(rightPrim) }; break;
                            case '*': resultValue = { type: "primitive", value: Number(leftPrim) * Number(rightPrim) }; break;
                            case '/': resultValue = { type: "primitive", value: Number(leftPrim) / Number(rightPrim) }; break;
                            case '%': resultValue = { type: "primitive", value: Number(leftPrim) % Number(rightPrim) }; break;
                            case '===': resultValue = { type: "primitive", value: leftPrim === rightPrim }; break;
                            case '!==': resultValue = { type: "primitive", value: leftPrim !== rightPrim }; break;
                            case '<': resultValue = { type: "primitive", value: Number(leftPrim) < Number(rightPrim) }; break;
                            case '<=': resultValue = { type: "primitive", value: Number(leftPrim) <= Number(rightPrim) }; break;
                            case '>': resultValue = { type: "primitive", value: Number(leftPrim) > Number(rightPrim) }; break;
                            case '>=': resultValue = { type: "primitive", value: Number(leftPrim) >= Number(rightPrim) }; break;
                            default:
                                errorMsg = `Operator ${binNode.operator} not implemented`;
                                console.warn(errorMsg);
                                resultValue = { type: "primitive", value: undefined };
                        }
                    } catch (e) {
                        errorMsg = e instanceof Error ? e.message : String(e);
                        console.error(`Error during binary operation ${binNode.operator}:`, errorMsg);
                        resultValue = { type: "primitive", value: undefined };
                    }

                    addStep({
                        node: node,
                        pass: "normal",
                        scopeIndex: currentScopeIndex,
                        memoryChange: { type: "none" },
                        evaluatedValue: errorMsg ? undefined : resultValue,
                        error: errorMsg
                    })
                    return resultValue;
                }

            case "CallExpression":
                {
                    const callNode = node as any; // Cast to access callee, arguments
                    const calleeValue = executionPass(callNode.callee, currentScopeIndex); // Use const
                    let errorMsg: string | undefined = undefined;
                    let returnedValue: JSValue = { type: "primitive", value: undefined }; // Default return

                    // Evaluate arguments
                    const evaluatedArgs: JSValue[] = [];
                    if (Array.isArray(callNode.arguments)) {
                        for (const argNode of callNode.arguments) {
                            evaluatedArgs.push(executionPass(argNode, currentScopeIndex));
                            // TODO: Handle spread arguments?
                        }
                    }

                    // Check if callee is a function reference
                    if (calleeValue.type !== 'reference') {
                        errorMsg = "TypeError: callee is not a function";
                    } else {
                        const funcRef = calleeValue.ref;
                        const heapObject = heap[funcRef];

                        if (!heapObject || heapObject.type !== 'function') {
                            errorMsg = "TypeError: callee is not a function object in heap";
                        } else {
                            const funcObject = heapObject; // Now know it's a HeapObject of type function
                            const funcDefinitionNode = funcObject.definitionNode as any; // Cast to access params, body

                            // --- Built-in Function Handling (Example: console.log) ---
                            // Simplistic check based on name (assuming global console)
                            let isBuiltIn = false;
                            if (callNode.callee.type === 'MemberExpression' && (callNode.callee as any).object?.name === 'console' && (callNode.callee as any).property?.name === 'log') {
                                isBuiltIn = true;
                                const output = evaluatedArgs.map(arg => {
                                    // Basic stringification for logging
                                    if (arg.type === 'primitive') return String(arg.value);
                                    if (arg.type === 'reference') {
                                        const obj = heap[arg.ref];
                                        if (obj?.type === 'object') return '[object Object]';
                                        if (obj?.type === 'array') return '[object Array]'; // TODO: Better array stringify
                                        if (obj?.type === 'function') return '[object Function]';
                                        return `[reference ${arg.ref}]`;
                                    }
                                    return 'unknown';
                                }).join(' ');

                                console.log("SIM_CONSOLE_LOG:", output); // Log to actual console for debugging

                                addStep({
                                    node: node,
                                    pass: "normal",
                                    scopeIndex: currentScopeIndex,
                                    memoryChange: { type: "none" }, // console.log has side effect (output) but no memory change here
                                    output: output, // Capture output
                                    evaluatedValue: { type: "primitive", value: undefined } // console.log returns undefined
                                });
                                returnedValue = { type: "primitive", value: undefined };
                            }

                            // --- User-Defined Function Execution --- 
                            if (!isBuiltIn) {
                                // 1. Create new scope with type and parent link
                                const newScope: Scope = {
                                    type: "function",
                                    variables: {},
                                    parentScope: funcObject.closureScopeIndex // Link to scope where function was defined
                                };
                                const newScopeIndex = scopes.length;

                                // 2. TODO: Determine 'this' binding 

                                // 3. Bind parameters to arguments
                                const params = funcDefinitionNode.params ?? [];
                                for (let i = 0; i < params.length; i++) {
                                    const param = params[i];
                                    if (param.type === 'Identifier') { // Handle simple identifier params
                                        const paramName = param.name;
                                        newScope.variables[paramName] = evaluatedArgs[i] ?? { type: "primitive", value: undefined };
                                    } else {
                                        // TODO: Handle destructuring, default params, rest params
                                        console.warn("Unhandled parameter type:", param.type);
                                    }
                                }
                                // TODO: Handle `arguments` object?

                                // 4. Push scope & Add call step
                                scopes.push(newScope);
                                addStep({
                                    node: node,
                                    pass: "normal",
                                    scopeIndex: currentScopeIndex, // Step occurs *before* scope changes
                                    memoryChange: {
                                        type: "function_call",
                                        functionRef: funcRef,
                                        pushedScope: newScope // Record the scope being pushed
                                    },
                                    evaluatedValue: undefined // Call itself doesn't evaluate to anything yet
                                });

                                // 5. Execute function body
                                let functionResult: JSValue = { type: "primitive", value: undefined };
                                try {
                                    // IMPORTANT: Need a way for executionPass to signal a 'return'
                                    // This might involve changing its return type or using exceptions
                                    // For now, execute body and assume implicit undefined return
                                    const bodyNode = funcDefinitionNode.body;
                                    if (bodyNode) {
                                        // If body is BlockStatement, execute its contents
                                        if (bodyNode.type === 'BlockStatement' && Array.isArray(bodyNode.body)) {
                                            for (const statement of bodyNode.body) {
                                                // TODO: Check for return statement result here!
                                                executionPass(statement, newScopeIndex);
                                            }
                                        }
                                        // If body is an expression (arrow function shorthand)
                                        else {
                                            // TODO: Handle implicit return for arrow functions
                                            functionResult = executionPass(bodyNode, newScopeIndex);
                                        }
                                    }
                                    // If return occurred, 'functionResult' should hold the returned value

                                } catch (e) {
                                    errorMsg = `Runtime Error in function ${funcObject.name || '(anonymous)'}: ${e instanceof Error ? e.message : String(e)}`;
                                    console.error(errorMsg);
                                    // Error occurred, function implicitly returns undefined
                                    functionResult = { type: "primitive", value: undefined };
                                }

                                // 6. Pop scope & Add return step
                                const poppedScope = scopes.pop(); // Should be newScope
                                if (!poppedScope) { /* This should not happen */ throw new Error("Scope stack underflow"); }
                                returnedValue = functionResult;
                                addStep({
                                    node: node, // Or associate with return statement? 
                                    pass: "normal",
                                    scopeIndex: newScopeIndex, // Step occurs *within* the function's scope before popping
                                    memoryChange: {
                                        type: "function_return",
                                        returnedValue: returnedValue,
                                        poppedScope: poppedScope,
                                    },
                                    evaluatedValue: returnedValue, // The final value call evaluates to
                                    error: errorMsg // Capture any error during execution
                                });
                            } // End if !isBuiltIn
                        } // End if funcObject exists and is function
                    } // End if calleeValue is reference

                    // If error occurred before function execution started
                    if (errorMsg && steps[steps.length - 1]?.node !== node) { // Avoid adding duplicate error step if added during built-in/return
                        addStep({
                            node: node,
                            pass: "normal",
                            scopeIndex: currentScopeIndex,
                            memoryChange: { type: "none" },
                            evaluatedValue: undefined,
                            error: errorMsg,
                        });
                        returnedValue = { type: "primitive", value: undefined };
                    }

                    return returnedValue;
                }
            // break; // Not needed after return

            case "MemberExpression":
                {
                    const memberNode = node as any; // Keep cast
                    const objectValue = executionPass(memberNode.object, currentScopeIndex); // Use const
                    // Allow null and boolean as potential primitive property keys
                    let propertyKey: string | number | boolean | null | undefined | symbol | bigint = undefined;
                    let propertyKeyValue: JSValue | undefined = undefined;
                    let errorMsg: string | undefined = undefined;
                    let resultValue: JSValue = { type: "primitive", value: undefined };

                    // 1. Determine the property key
                    if (memberNode.computed) {
                        propertyKeyValue = executionPass(memberNode.property, currentScopeIndex);
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
                                elements.push(executionPass(elementNode, currentScopeIndex));
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
                                            if (lookup.value !== undefined) {
                                                value = lookup.value;
                                            } else {
                                                errorMsg = `ReferenceError: ${key} is not defined (shorthand property)`;
                                                break;
                                            }
                                        } else { continue; }
                                    } else {
                                        value = executionPass(property.value, currentScopeIndex);
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
                    const testValue = executionPass(condNode.test, currentScopeIndex);

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
                            resultValue = executionPass(condNode.consequent, currentScopeIndex);
                        } else {
                            resultValue = executionPass(condNode.alternate, currentScopeIndex);
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

        // Default return value if no specific value evaluated
        return { type: "primitive", value: undefined }
    }

    // --- Simulation Execution --- 

    try {
        // Pass 1: Hoisting
        // Ensure ast.body is treated as an array of ESNodes
        hoistingPass(Array.isArray(ast.body) ? ast.body : [], 0)

        // Pass 2: Execution
        executionPass(ast, 0) // Start execution from the Program node in global scope

    } catch (error) {
        console.error("Error during simulation:", error)
        // Potentially add a final error step to the steps array
        addStep({
            node: ast, // Or find a better node association
            pass: "normal",
            scopeIndex: scopes.length - 1, // Last known scope
            memoryChange: { type: "none" },
            error: error instanceof Error ? error.message : String(error)
        })
    }

    console.log("Simulation finished. Steps:", steps.length)
    return steps
}
