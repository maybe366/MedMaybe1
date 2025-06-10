// src/controllers/adminController.js

const pool = require('../config/db')
const bcrypt = require('bcryptjs')

// --- УПРАВЛЕНИЕ ВРАЧАМИ ---

// 1. Создание нового врача
const createDoctor = async (req, res) => {
	// Данные из текстовых полей формы
	const { firstName, lastName, email, password, specializationId } = req.body

	// Преобразуем опциональные поля в числа или null
	const experienceYears = req.body.experienceYears
		? parseInt(req.body.experienceYears)
		: null
	const officeNumber = req.body.officeNumber || null

	// Путь к файлу
	let photoUrl = null
	if (req.file) {
		photoUrl = `/uploads/${req.file.filename}`
	}

	// Валидация
	if (!firstName || !lastName || !email || !password || !specializationId) {
		return res
			.status(400)
			.json({ message: 'Пожалуйста, заполните все обязательные поля.' })
	}

	const client = await pool.connect()
	try {
		const existingUser = await client.query(
			'SELECT * FROM users WHERE email = $1',
			[email]
		)
		if (existingUser.rows.length > 0) {
			return res
				.status(409)
				.json({ message: 'Пользователь с таким email уже существует.' })
		}

		await client.query('BEGIN')

		const salt = await bcrypt.genSalt(10)
		const passwordHash = await bcrypt.hash(password, salt)

		const newUserQuery = `
            INSERT INTO users (email, password_hash, role) 
            VALUES ($1, $2, 'doctor') RETURNING id;
        `
		const newUserResult = await client.query(newUserQuery, [
			email,
			passwordHash,
		])
		const newUserId = newUserResult.rows[0].id

		const newDoctorQuery = `
            INSERT INTO doctors (user_id, first_name, last_name, specialization_id, photo_url, experience_years, office_number) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;
        `
		const newDoctorResult = await client.query(newDoctorQuery, [
			newUserId,
			firstName,
			lastName,
			specializationId,
			photoUrl,
			experienceYears,
			officeNumber,
		])

		await client.query('COMMIT')

		res.status(201).json({
			message: 'Врач успешно создан',
			doctor: newDoctorResult.rows[0],
		})
	} catch (error) {
		await client.query('ROLLBACK')
		console.error('КРИТИЧЕСКАЯ ОШИБКА ПРИ СОЗДАНИИ ВРАЧА:', error) // <-- Важный лог
		res
			.status(500)
			.json({ message: 'Внутренняя ошибка сервера при создании врача.' })
	} finally {
		client.release()
	}
}

// 2. Удаление врача
const deleteDoctor = async (req, res) => {
	try {
		// ID врача (из таблицы doctors), которого нужно удалить
		const { id } = req.params

		// В нашей БД настроено каскадное удаление (ON DELETE CASCADE)
		// для связи users -> doctors. Но мы должны сначала найти user_id,
		// чтобы удалить пользователя из таблицы users.
		const doctorResult = await pool.query(
			'SELECT user_id FROM doctors WHERE id = $1',
			[id]
		)
		if (doctorResult.rows.length === 0) {
			return res.status(404).json({ message: 'Врач не найден' })
		}
		const userIdToDelete = doctorResult.rows[0].user_id

		// Удаление из таблицы users автоматически удалит запись из doctors
		await pool.query('DELETE FROM users WHERE id = $1', [userIdToDelete])

		res.status(200).json({ message: 'Учетная запись врача успешно удалена' })
	} catch (error) {
		console.error(error)
		res.status(500).json({ message: 'Ошибка на стороне сервера' })
	}
}

// --- УПРАВЛЕНИЕ ПАЦИЕНТАМИ ---

// 3. Получение списка всех пациентов
const getAllPatients = async (req, res) => {
	try {
		const query = `
            SELECT p.id, p.first_name, p.last_name, p.phone_number, u.email
            FROM patients p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.last_name;
        `
		const { rows } = await pool.query(query)
		res.status(200).json(rows)
	} catch (error) {
		console.error(error)
		res.status(500).json({ message: 'Ошибка на стороне сервера' })
	}
}

// 4. Удаление пациента
const deletePatient = async (req, res) => {
	try {
		const { id } = req.params // ID пациента из таблицы patients

		const patientResult = await pool.query(
			'SELECT user_id FROM patients WHERE id = $1',
			[id]
		)
		if (patientResult.rows.length === 0) {
			return res.status(404).json({ message: 'Пациент не найден' })
		}
		const userIdToDelete = patientResult.rows[0].user_id

		await pool.query('DELETE FROM users WHERE id = $1', [userIdToDelete])

		res.status(200).json({ message: 'Учетная запись пациента успешно удалена' })
	} catch (error) {
		console.error(error)
		res.status(500).json({ message: 'Ошибка на стороне сервера' })
	}
}

module.exports = {
	createDoctor,
	deleteDoctor,
	getAllPatients,
	deletePatient,
}
