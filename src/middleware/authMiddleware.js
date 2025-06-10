// src/middleware/authMiddleware.js

const jwt = require('jsonwebtoken')
require('dotenv').config()

const protect = (req, res, next) => {
	let token

	// 1. Проверяем наличие заголовка Authorization и его формат 'Bearer <token>'
	if (
		req.headers.authorization &&
		req.headers.authorization.startsWith('Bearer')
	) {
		try {
			// 2. Получаем токен из заголовка
			token = req.headers.authorization.split(' ')[1]

			// 3. Проверяем (верифицируем) токен
			const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY)

			// 4. Прикрепляем данные пользователя к объекту запроса (req)
			// Мы не будем прикреплять пароль, только безопасные данные из токена
			req.user = {
				id: decoded.id,
				email: decoded.email,
				role: decoded.role,
			}

			// 5. Передаем управление следующему middleware или контроллеру
			next()
		} catch (error) {
			console.error(error)
			return res
				.status(401)
				.json({ message: 'Не авторизован, токен недействителен' })
		}
	}

	if (!token) {
		return res.status(401).json({ message: 'Не авторизован, нет токена' })
	}
}

const isAdmin = (req, res, next) => {
	// Эта функция должна всегда вызываться ПОСЛЕ 'protect',
	// так как она рассчитывает на наличие req.user.
	if (req.user && req.user.role === 'admin') {
		next() // Роль подходит, разрешаем доступ
	} else {
		res
			.status(403)
			.json({ message: 'Доступ запрещен. Требуются права администратора.' })
	}
}
// ДОБАВЛЯЕМ НОВОЕ MIDDLEWARE
const isDoctor = (req, res, next) => {
    if (req.user && req.user.role === 'doctor') {
        next();
    } else {
        res.status(403).json({ message: 'Доступ разрешен только врачам.' });
    }
};


// ОБНОВЛЯЕМ ЭКСПОРТ
module.exports = { 
    protect,
    isAdmin,
    isDoctor // <-- ДОБАВИТЬ
};

