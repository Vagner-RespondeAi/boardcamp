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

app.get("/games", async (req, res) => {
    const nameQuery = req.query.name ?? "";

    try {
        const games = await connection.query('SELECT * FROM games WHERE name ILIKE $1', [nameQuery + "%"])
        res.send(games.rows)
    } catch (error) {
        console.log(error)
        res.send("deu erro")
    }
})

app.post("/games", async (req, res) => {
    const { name, image, stockTotal, categoryId, pricePerDay } = req.body
    const nameIsEmpty = name.length === 0
    const stockAndPricePositives = (stockTotal > 0 && pricePerDay > 0)
    const categories = await connection.query('SELECT * FROM categories')
    const categoryIdExists = categories.rows.find(category => category.id === categoryId)

    const games = await connection.query('SELECT * FROM games')
    const gameNameExists = games.rows.find(game => game.name === name)

    if(nameIsEmpty || stockAndPricePositives || !categoryIdExists){
        res.send("deu ruim")

        return
    } else if(gameNameExists){
        res.sendStatus(409)
        return
    }

    try {
        await connection.query('INSERT INTO games (name, image, stockTotal, categoryId, pricePerDay) VALUES ($1, $2, $3, $4, $5)', [name, image, stockTotal, categoryId, pricePerDay])
        res.sendStatus(201)
    } catch (error) {
        console.log(error)
        res.send("deu ruim")
    }
})

app.listen(4000, () => {
    console.log("Server listening at port 4000")
})