function greet(name, family = "Doe") {
    const first = "Hello, " + name + " " + family
    return first
}

function newError() {
    throw "Error: "
}

function run(greet) {
    let output
    try {
        newError()
    } catch (error) {
        output = greet
    }
    return output
}
run(greet('Mak', undefined, 28))