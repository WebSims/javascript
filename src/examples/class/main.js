class Person {
    // Field declarations
    name;
    age;
    #privateField = "secret";

    // Static fields
    static count = 0;
    static #privateStaticField = "static secret";

    // Constructor
    constructor(name, age) {
        this.name = name;
        this.age = age;
        Person.count++;
    }

    // Normal method
    greet() {
        return "Hello, my name is " + this.name;
    }

    // Method with parameters
    celebrateBirthday(message) {
        this.age++;
        return message + " You are now " + this.age;
    }

    // Getter
    get info() {
        return this.name + " is " + this.age + " years old";
    }

    // Setter
    set info(value) {
        const parts = value.split(" ");
        this.name = parts[0];
        this.age = parseInt(parts[1]);
    }

    // Arrow function as class field
    getUpperName = () => {
        return this.name.toUpperCase();
    }

    // Static method
    static createAnonymous() {
        return new Person("Anonymous", 0);
    }

    // Computed property name
    ["say" + "Hello"]() {
        return "Hello from computed method";
    }
}

class Student extends Person {
    grade;

    constructor(name, age, grade) {
        super(name, age);
        this.grade = grade;
    }

    static schoolName = "High School";

    // Override method
    greet() {
        return super.greet() + " and I'm a student in grade " + this.grade;
    }

    getGrade() {
        return this.grade;
    }
}