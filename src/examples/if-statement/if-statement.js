if (1); 6
if (5) x = 1
if (7) if (8) 9
if (0) {
    if (0) { }
}
if (0) 0; else;
if (0) {

} else {

}
if (0) { } else if (0); else 1;
if (0) { } else if (0); else if (0); else 1;
if (0) { } else if (0); else if (1);

// if with block but no else
if (true) {
    let a = 5;
}

// if with else inline
if (false) a = 1; else b = 2;


// nested if inside else
if (x == 1) {
    y = 2;
} else {
    if (x == 2) {
        y = 3;
    }
}

// if with ternary (not same, but related use-case)
let result = true ? 1 : 2;

// weird empty if
if (0);


// if inside arrow function
const fn = () => {
    if (true) return 5;
};
fn();

// labeled if
// label1: if (x === 0) break label1;

// if with void and typeof
// if (typeof something === "undefined") {
//     init();
// }
// if (void 0) { }

// if using new Boolean()
// if (new Boolean(false)) { maybeTrue(); }

// if as argument
// setTimeout(() => {
//     if (1) sayHi();
// }, 100);


// comma expression inside if
if ((a = 1, b = 2, a + b > 2)) { true }
