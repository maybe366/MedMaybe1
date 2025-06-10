// src/controllers/specializationController.js
const pool = require('../config/db')

const getAllSpecializations = async (req, res) => {
	try {
		const { rows } = await pool.query(
			'SELECT * FROM specializations ORDER BY name'
		)
		res.status(200).json(rows)
	} catch (error) {
		console.error(error)
		res.status(500).json({ message: 'Ошибка на стороне сервера' })
	}
}

module.exports = { getAllSpecializations }
