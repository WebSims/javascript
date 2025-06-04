import { JSValue, UNDEFINED, CoercionInfo, CoercionType, COERCION_TYPE, HeapObject, HEAP_OBJECT_TYPE, PrimitiveValue } from "../types/simulation"

/**
 * JavaScript Type Coercion Utilities
 * Implements ECMAScript Abstract Operations for type conversion
 */

/**
 * Simplified coercion using built-in JavaScript methods
 */

export const toBoolean = (jsValue: JSValue): PrimitiveValue => {
    if (jsValue.type === "primitive" && typeof jsValue.value === "boolean")
        return jsValue.value

    let booleanResult: boolean
    if (jsValue.type === "primitive") {
        booleanResult = Boolean(jsValue.value)
    } else {
        booleanResult = true // Objects are always truthy
    }

    // const coercion = {
    //     type: COERCION_TYPE.TO_BOOLEAN,
    //     from: value,
    //     to: result,
    //     operation: "to_boolean"
    // }

    return booleanResult

}

export const toNumber = (jsValue: JSValue, heap: Record<number, HeapObject>): PrimitiveValue => {
    if (jsValue.type === "primitive" && typeof jsValue.value === "number")
        return jsValue.value

    let numberResult: number
    if (jsValue.type === "primitive") {
        numberResult = Number(jsValue.value)
    } else {
        const primitiveValue = toPrimitive(jsValue, heap)
        numberResult = Number(primitiveValue)
    }

    // const coercion = {
    //     type: COERCION_TYPE.TO_NUMBER,
    //     from: jsValue,
    //     to: numberResult,
    //     operation: "to_number"
    // }
    return numberResult
}

export const toString = (jsValue: JSValue, heap: Record<number, HeapObject>): PrimitiveValue => {
    if (jsValue.type === "primitive" && typeof jsValue.value === "string")
        return jsValue.value

    let stringResult: string
    if (jsValue.type === "primitive") {
        stringResult = String(jsValue.value)
    } else {
        const primitiveValue = toPrimitive(jsValue, heap)
        stringResult = String(primitiveValue)
    }

    // const coercion = {
    //     type: COERCION_TYPE.TO_STRING,
    //     from: jsValue,
    //     to: stringResult,
    //     operation: "to_string"
    // }
    return stringResult
}

/**
 * Abstract operation: ToPrimitive
 * Converts an object to a primitive value
 */
export const toPrimitive = (
    jsValue: JSValue,
    heap: Record<number, HeapObject>,
): PrimitiveValue => {
    if (jsValue.type === "primitive") {
        return jsValue.value
    }

    const heapObj = heap[jsValue.ref]
    let primitiveResult: PrimitiveValue

    if (heapObj.type === HEAP_OBJECT_TYPE.ARRAY) {
        // Arrays convert to their string representation
        const elements = heapObj.elements.map(el => {
            if (el.type === "primitive") {
                return String(el.value)
            } else {
                return toPrimitive(el, heap)
            }
        })
        primitiveResult = elements.join(",")
    } else if (heapObj.type === HEAP_OBJECT_TYPE.FUNCTION) {
        if (heapObj.node.type === "FunctionDeclaration") {
            primitiveResult = `function ${heapObj.node.id.name}() {}`
        } else if (heapObj.node.type === "ArrowFunctionExpression") {
            primitiveResult = `() => {}`
        } else {
            primitiveResult = "[object Function]"
        }
    } else {
        primitiveResult = "[object Object]"
    }

    // const coercion = {
    //     type: COERCION_TYPE.TO_PRIMITIVE,
    //     from: jsValue,
    //     to: primitiveResult,
    //     operation: "to_primitive"
    // }
    return primitiveResult
}

