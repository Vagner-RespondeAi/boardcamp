import pg from 'pg'
import express from 'express'

const app = express()
app.use(express.json())

const { Pool } = pg

const connection = new Pool({
    user: 'bootcamp_role',
    password: 'senha_super_hiper_ultra_secreta_do_role_do_bootcamp',
    host: 'localhost',
    port: 5432,
    database: 'boardcamp'
})

app.get("/categories", async (req, res) => {
    try {
        const categories = await connection.query('SELECT * FROM categories')
        res.send(categories.rows)
    } catch (error) {
        console.log(error)
        res.send("deu ruim")
    }
})

app.post("/categories", async (req, res) => {
    const { name } = req.body
    const categories = await connection.query('SELECT * FROM categories')
    const nameExists = categories.rows.find(category => category.name === name)
    if(name.length === 0){
        res.sendStatus(400)
        return
    } else if(nameExists){
        res.sendStatus(409)
        return
    }
    try {
        await connection.query('INSERT INTO categories (name) VALUES ($1)', [name])
        res.send("OK")
    } catch (error) {
        console.log(error)
        res.sendStatus(201)
    }
})

app.listen(4000, () => {
    console.log("Server listening at port 4000")
})