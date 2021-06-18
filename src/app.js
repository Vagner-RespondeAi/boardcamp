import express from 'express'
import connection from './database/database.js'
import joi from 'joi'
import cors from 'cors'
import dayjs from 'dayjs'

const app = express()
app.use(express.json())
app.use(cors())

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
        `, [nameQuery + "%"])
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

        await connection.query(`
            INSERT INTO games 
            (name, image, "stockTotal", "categoryId", "pricePerDay") 
            VALUES ($1, $2, $3, $4, $5)
        `, [name, image, stockTotal, categoryId, pricePerDay])
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

// CRUD RENTALS

app.get('/rentals', async (req, res) => {
    const customerIdQuery = req.query.customerId ?? ""
    const gameIdQuery = req.query.gameId ?? ""
    const query = `
        SELECT rentals.*, 
        jsonb_build_object('name', customers.name, 'id', customers.id) AS customer,
        jsonb_build_object('id', games.id, 'name', games.name, 'categoryId', games."categoryId", 'categoryName', categories.name) AS game            
        FROM rentals 
        JOIN customers ON rentals."customerId" = customers.id
        JOIN games ON rentals."gameId" = games.id
        JOIN categories ON categories.id = games."categoryId"
    `
    let whereClause = ""
    let queryVars = []

    if(customerIdQuery && gameIdQuery){
        whereClause = `WHERE rentals."customerId" = $1 OR rentals."gameId" = $2`
        queryVars = [customerIdQuery, gameIdQuery]
    } else if(customerIdQuery){
        whereClause = `WHERE rentals."customerId" = $1`
        queryVars = [customerIdQuery]
    } else if(gameIdQuery){
        whereClause = `WHERE rentals."gameId" = $1`
        queryVars = [gameIdQuery]
    }

    try {
        const rentals = await connection.query(query + whereClause, queryVars)
        res.send(rentals.rows)
    } catch (error) {
        res.sendStatus(400)
    }
})

app.post('/rentals', async (req, res) => {
    const { customerId, gameId, daysRented} = req.body
    try {
        const games = await connection.query(`SELECT * FROM games`)
        const gamePriceAndStock = await connection.query(`SELECT games."pricePerDay", games."stockTotal" FROM games WHERE id = $1`, [gameId])
        const gamePricePerDay = gamePriceAndStock.rows[0].pricePerDay
        const gameStock = gamePriceAndStock.rows[0].stockTotal
        const customers = await connection.query(`SELECT * FROM customers`)
        const rentals = await connection.query(`SELECT * FROM rentals`)
        const gameTotalRentals = rentals.rows.filter(rental => rental.gameId === gameId)
        const gameIsAvailable = (gameStock - gameTotalRentals.length > 0)
        const foundGameId = games.rows.find(game => game.id === gameId)
        const foundCustomerId = customers.rows.find(customer => customer.id === customerId)

        if(!foundGameId || !foundCustomerId || daysRented <= 0 || !gameIsAvailable){
            res.sendStatus(400)
            return
        }
        const rentDate = dayjs().format('YYYY-MM-DD')
        const originalPrice = daysRented * gamePricePerDay
        await connection.query(`INSERT INTO rentals ("customerId", "gameId", "daysRented", "rentDate", "originalPrice") VALUES ($1, $2, $3, $4, $5)`, [customerId, gameId, daysRented, rentDate, originalPrice])
        res.sendStatus(201)
    } catch (error) {
        res.sendStatus(400)
    } 
})

app.post('/rentals/:id/return', async (req, res) => {
    try {
        const rentalId = req.params.id
        const returnDate = dayjs().format('YYYY-MM-DD')
        const rental = await connection.query('SELECT * FROM rentals WHERE id = $1', [rentalId])
        const rentDate = dayjs(rental.rows[0].rentDate).format('YYYY-MM-DD')
        const daysRented = rental.rows[0].daysRented
        const pricePerDay = rental.rows[0].originalPrice / daysRented
        const daysDiff = dayjs(returnDate).diff(rentDate, 'hour') / 24
        const isOverdue = daysDiff > daysRented
        let delayFee = 0

        if(rental.rows.length === 0){
            res.sendStatus(404)
            return
        }
        if(rental.rows[0].returnDate !== null){
            res.sendStatus(400)
            return
        }
        if(isOverdue){
            delayFee = (daysDiff - daysRented) * pricePerDay
        }

        res.sendStatus(200)
        await connection.query(`
            UPDATE rentals 
            SET "returnDate" = $1, "delayFee" = $2
            WHERE id = $3
        `, [returnDate, delayFee, rentalId])
    } catch (error) {
        console.log(error)
        res.sendStatus(400)
    }
})

app.listen(4000, () => {
    console.log("Server listening at port 4000")
})