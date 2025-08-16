function createCounter() {
    let count = 0;

    return {
        increment() {
            count++;
            return count;
        },
        reset() {
            count = 0;
        }
    };
}

const Counter = createCounter();

Counter.increment(); // 1
Counter.increment(); // 2