// src/controllers/authController.js

const pool = require('../config/db')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
require('dotenv').config()

// Функция для генерации JWT токена
const generateJwtToken = (id, email, role) => {
	const payload = {
		id,
		email,
		role,
	}
	// Подписываем токен секретным ключом из .env
	// '7d' означает, что токен будет действителен 7 дней
	return jwt.sign(payload, process.env.JWT_SECRET_KEY, { expiresIn: '7d' })
}

// --- РЕГИСТРАЦИЯ ПАЦИЕНТА ---
const register = async (req, res) => {
	try {
		// 1. Получаем данные из тела запроса
		const { firstName, lastName, email, password } = req.body

		// 2. Простая валидация: проверяем, что все поля переданы
		if (!firstName || !lastName || !email || !password) {
			return res.status(400).json({ message: 'Пожалуйста, заполните все поля' })
		}

		// 3. Проверяем, не занят ли email
		const existingUser = await pool.query(
			'SELECT * FROM users WHERE email = $1',
			[email]
		)
		if (existingUser.rows.length > 0) {
			return res
				.status(400)
				.json({ message: 'Пользователь с таким email уже существует' })
		}

		// 4. Хешируем пароль
		const salt = await bcrypt.genSalt(10) // "Соль" для хеширования
		const passwordHash = await bcrypt.hash(password, salt)

		// 5. Создаем транзакцию для безопасной вставки в 2 таблицы
		const client = await pool.connect()
		try {
			await client.query('BEGIN') // Начало транзакции

			// Вставляем данные в таблицу users
			const newUserQuery = `
                INSERT INTO users (email, password_hash, role) 
                VALUES ($1, $2, 'patient') 
                RETURNING id;
            `
			const newUserResult = await client.query(newUserQuery, [
				email,
				passwordHash,
			])
			const newUserId = newUserResult.rows[0].id

			// Вставляем данные в таблицу patients
			const newPatientQuery = `
                INSERT INTO patients (user_id, first_name, last_name) 
                VALUES ($1, $2, $3);
            `
			await client.query(newPatientQuery, [newUserId, firstName, lastName])

			await client.query('COMMIT') // Фиксируем транзакцию

			// 6. Генерируем JWT токен для нового пользователя
			const token = generateJwtToken(newUserId, email, 'patient')

			// 7. Отправляем успешный ответ с токеном
			res.status(201).json({
				message: 'Регистрация прошла успешно',
				token,
			})
		} catch (error) {
			await client.query('ROLLBACK') // Откатываем изменения в случае ошибки
			throw error // Передаем ошибку дальше
		} finally {
			client.release() // Возвращаем соединение в пул
		}
	} catch (error) {
		console.error(error)
		res.status(500).json({ message: 'Ошибка на стороне сервера' })
	}
}

module.exports = {
	register,
}
// --- АВТОРИЗАЦИЯ ПОЛЬЗОВАТЕЛЯ ---
const login = async (req, res) => {
    try {
        // 1. Получаем email и пароль из тела запроса
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Введите email и пароль" });
        }

        // 2. Ищем пользователя в БД
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: "Неверный логин или пароль" }); // Используем общую ошибку для безопасности
        }
        const user = userResult.rows[0];

        // 3. Сравниваем переданный пароль с хешем в БД
        const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordCorrect) {
            return res.status(401).json({ message: "Неверный логин или пароль" });
        }

        // 4. Генерируем JWT токен
        const token = generateJwtToken(user.id, user.email, user.role);

        // 5. Отправляем токен клиенту
        res.status(200).json({
            message: "Авторизация прошла успешно",
            token,
            user: { // Можно вернуть и базовую инфу о пользователе
                id: user.id,
                email: user.email,
                role: user.role,
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Ошибка на стороне сервера" });
    }
};
// --- ПОЛУЧИТЬ ДАННЫЕ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ ---
const getMe = async (req, res) => {
    // req.user был добавлен нашим middleware 'protect'
    const { id, email, role } = req.user; 
    res.status(200).json({
        id,
        email,
        role
    });
};
// Обновляем экспорт
module.exports = {
	register,
	login,
	getMe, // <-- ДОБАВИТЬ
}