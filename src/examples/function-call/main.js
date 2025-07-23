function functionThatSucceeds() {
    let result = "Starting functionThatSucceeds"
    result = "functionThatSucceeds completed successfully"
    return result // Returns successfully
}

function functionThatThrows() {
    let result = "Starting functionThatThrows"
    throw "Error intentionally thrown from functionThatThrows"
    // Unreachable code:
    result = "This won't be assigned"
    return result
}

function middleLayerExecution(targetFunction) {
    let middleResult = "Initial middle value"
    var middleVar = "Var in middle"
    try {
        middleResult = "Inside middle try"
        // Call the actual target function (which might succeed or throw)
        const innerResult = targetFunction()
        middleResult += " | Inner func result: " + innerResult
        // Optionally, throw another error here to test outer catch
        // throw "Error thrown from middle layer try";
    } catch (innerError) {
        middleResult = "Caught error in middle: " + innerError
        middleVar = "Var updated after middle catch"
        // Optionally re-throw to be caught by the outer layer
        // throw innerError;
    } finally {
        middleResult += " | Middle finally executed"
        // Errors in finally can be tricky, avoid if possible unless testing specific scenarios
        // throw "Error from middle finally";
    }
    return middleResult + " | " + middleVar
}


function outerLayerExecution(targetFunction) {
    const outerConst = "Outer const value"
    let outerResult = "Initial outer value"
    var outerVar = "Var in outer"

    try {
        outerResult = "Inside outer try"
        // Call the middle layer function, passing the innermost function
        const middleLayerResult = middleLayerExecution(targetFunction)
        outerResult = outerConst + " | Middle layer returned: " + middleLayerResult
    } catch (outerError) {
        // This catch will trigger if the middle layer re-throws an error,
        // or if an error occurs in the middle layer's finally block.
        outerResult = "Caught error in outer: " + outerError
        outerVar = "Var updated after outer catch"
    } finally {
        outerResult += " | Outer finally executed"
    }
    return outerResult + " | " + outerVar
}


// Scenario 1: Call the function that succeeds through nested try-catch
const resultSuccessNested = outerLayerExecution(functionThatSucceeds)

// Scenario 2: Call the function that throws, caught by middle layer
const resultErrorNestedCaughtMiddle = outerLayerExecution(functionThatThrows)

// To test the outer catch, you would need to uncomment a 'throw'
// in the middle layer's catch or finally block.