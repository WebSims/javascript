const adam = { name: "Adam" }

const eve = { name: "Eve" }

const children = [
    { name: "Cain", father: adam, mother: eve },
    { name: "Seth", father: adam, mother: eve }
]

adam.children = children

eve.children = children
