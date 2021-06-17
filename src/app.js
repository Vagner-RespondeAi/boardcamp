import express from 'express'
import connection from './database/database.js'
import joi from 'joi'

const app = express()
app.use(express.json())

const gameSchema = joi.object({
    name: joi.string().required(),
    image: joi.string(),
    stockTotal: joi.number().integer().min(1),
    pricePerDay: joi.number().integer().min(1),
    categoryId: joi.number()
})

const customerSchema = joi.object({
    name: joi.string().required(),
    phone: joi.string().pattern(/^[0-9]{10,11}?/),
    cpf: joi.string().pattern(/^[0-9]{11}?/),
    birthday: joi.date()
})

// CRUD CATEGORIES
app.get("/categories", async (req, res) => {
    try {
        const categories = await connection.query('SELECT * FROM categories')
        res.send(categories.rows)
    } catch (error) {
        res.sendStatus(400)
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
        res.sendStatus(201)
    }
})

// CRUD GAMES
app.get("/games", async (req, res) => {
    const nameQuery = req.query.name ?? "";
    try {
        const games = await connection.query(`
            SELECT games.*, categories.name AS "categoryName" 
            FROM games JOIN categories ON games."categoryId" = categories.id
            WHERE games.name ILIKE $1
            `, [nameQuery + "%"]
        )
        res.send(games.rows)
    } catch (error) {
        res.sendStatus(400)
    }
})

app.post("/games", async (req, res) => {
    try {
        const { name, image, stockTotal, categoryId, pricePerDay } = req.body
        const categories = await connection.query('SELECT * FROM categories')
        const categoryIdExists = categories.rows.find(category => category.id === categoryId)
        const games = await connection.query('SELECT * FROM games')
        const gameNameExists = games.rows.find(game => game.name === name)
        const { error, value} = gameSchema.validate(req.body)

        if(error || !categoryIdExists){
            res.sendStatus(400)
            return
        } else if(gameNameExists){
            res.sendStatus(409)
            return
        }

        await connection.query('INSERT INTO games (name, image, "stockTotal", "categoryId", "pricePerDay") VALUES ($1, $2, $3, $4, $5)', [name, image, stockTotal, categoryId, pricePerDay])
        res.sendStatus(201)
    } catch (error) {
        res.sendStatus(400)
    }
})

//CRUD CUSTOMERS
app.get("/customers", async (req, res) => {
    const cpfQuery =  req.query.cpf ?? ""
    try {
        const customers = await connection.query(`
        SELECT * 
        FROM customers
        WHERE cpf ILIKE $1
        `, [cpfQuery + "%"])

        res.send(customers.rows)
    } catch (error) {
        res.sendStatus(400)
    }
})

app.get("/customers/:id", async (req, res) => {
    try {
        const customers = await connection.query(`
        SELECT * 
        FROM customers 
        WHERE id ILIKE $1
        `, [req.params.id])
        res.send(customers.rows)
    } catch (error) {
        res.sendStatus(404)
    }
})


app.post("/customers", async (req, res) => {
    const { name, phone, cpf, birthday } = req.body
    const { schemaError, value} = customerSchema.validate(req.body)
    try {
        const clients = await connection.query('SELECT * FROM customers')
        const cpfExists = clients.rows.find(client => client.cpf === cpf)
        if(schemaError){
            res.sendStatus(400)
            return
        } else if(cpfExists){
            res.sendStatus(409)
            return
        }

        await connection.query('INSERT INTO customers (name, phone, cpf, birthday) VALUES ($1, $2, $3, $4)', [name, phone, cpf, birthday])
        res.sendStatus(201)
    } catch (error) {
        console.log(error)
        res.sendStatus(400)
    }
})

app.put("/customers/:id", async (req, res) => {
    const { name, phone, cpf, birthday} = req.body
    const { schemaError, value} = customerSchema.validate(req.body)
    try {
        const clients = await connection.query('SELECT * FROM customers')
        const cpfExists = clients.rows.find(client => {
            if(client.id !== req.params.id){
                client.cpf === cpf
            }
        })
        if(schemaError){
            console.log("erro")
            res.sendStatus(400)
            return
        } else if(cpfExists){
            res.sendStatus(409)
            return
        }

        await connection.query(`
        UPDATE customers 
        SET name = $1, phone = $2, cpf = $3, birthday = $4 
        WHERE customers.id = $5
        `, [name, phone, cpf, birthday, req.params.id])
        res.sendStatus(200)
    } catch (error) {
        console.log(error)
        res.sendStatus(400)
    }
})

app.listen(4000, () => {
    console.log("Server listening at port 4000")
})