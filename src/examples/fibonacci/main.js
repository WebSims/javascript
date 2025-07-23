function f(n) {
    return n <= 1 ? n : f(n - 1) + f(n - 2)
}
let fib5 = f(5); // 0 + 1 + 1 + 2 + 3 = 5