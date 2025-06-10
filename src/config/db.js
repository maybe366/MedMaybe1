const { Pool } = require('pg')
require('dotenv').config() // Загружаем переменные из .env

// Создаем пул соединений с базой данных
const pool = new Pool({
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	host: process.env.DB_HOST,
	port: process.env.DB_PORT,
	database: process.env.DB_DATABASE,
})

// Простая проверка соединения
pool.query('SELECT NOW()', (err, res) => {
	if (err) {
		console.error('Ошибка подключения к базе данных', err.stack)
	} else {
		console.log('Успешное подключение к базе данных:', res.rows[0].now)
	}
})

module.exports = pool
