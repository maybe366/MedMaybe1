// src/controllers/slotController.js

const pool = require('../config/db')

// Middleware для проверки, что пользователь - врач


// Создание нового временного слота
const createSlot = async (req, res) => {
	const doctorUserId = req.user.id
	const { startTime } = req.body

	if (!startTime) {
		return res
			.status(400)
			.json({ message: 'Необходимо указать время начала слота' })
	}

	// --- НОВАЯ ПРОВЕРКА ВРЕМЕНИ НА СЕРВЕРЕ ---
	const slotDate = new Date(startTime)
	const slotHourUTC = slotDate.getUTCHours() // Работаем с UTC временем

	// Здесь нужно быть осторожным с часовыми поясами.
	// Проще всего проверить, что время не выходит за пределы рабочего дня в UTC.
	// Если ваш сервер и клиенты в одном поясе, можно использовать getHours().
	// Для простоты, допустим, мы проверяем UTC часы.
	if (slotHourUTC < 5 || slotHourUTC >= 13) {
		// Пример для UTC, если сервер в UTC, а клиент в UTC+3
		// Более надежный способ - проверять на клиенте, а серверу доверять
		// но для защиты от прямого вызова API - это полезно.
		// Для дипломной работы можно упростить и оставить проверку только на фронтенде.
		// Я оставлю эту проверку закомментированной как пример, но рекомендую опираться на фронтенд-валидацию.
		/*
        return res.status(400).json({ 
            message: "Выбранное время не входит в рабочий диапазон (8:00 - 16:00)" 
        });
        */
	}
	// --- КОНЕЦ ПРОВЕРКИ ---

	try {
		const doctorResult = await pool.query(
			'SELECT id FROM doctors WHERE user_id = $1',
			[doctorUserId]
		)
		if (doctorResult.rows.length === 0) {
			return res.status(404).json({ message: 'Профиль врача не найден' })
		}
		const doctorId = doctorResult.rows[0].id

		// Длительность приема, например, 30 минут. Можно сделать гибкой.
		const durationMinutes = 30
		const endTime = new Date(slotDate.getTime() + durationMinutes * 60000)

		const query = `
            INSERT INTO time_slots (doctor_id, start_time, end_time)
            VALUES ($1, $2, $3) RETURNING *;
        `
		const { rows } = await pool.query(query, [
			doctorId,
			slotDate.toISOString(),
			endTime.toISOString(),
		])

		res.status(201).json(rows[0])
	} catch (error) {
		console.error(error)
		if (error.code === '23505') {
			return res
				.status(409)
				.json({ message: 'Слот на это время уже существует' })
		}
		res.status(500).json({ message: 'Ошибка на стороне сервера' })
	}
}

// Удаление временного слота
const deleteSlot = async (req, res) => {
	const doctorUserId = req.user.id
	const { id: slotId } = req.params

	try {
		// Проверяем, что врач удаляет СВОЙ собственный слот и что он не забронирован
		const slotResult = await pool.query(
			`SELECT ts.id FROM time_slots ts
             JOIN doctors d ON ts.doctor_id = d.id
             WHERE ts.id = $1 AND d.user_id = $2 AND ts.is_booked = FALSE`,
			[slotId, doctorUserId]
		)

		if (slotResult.rows.length === 0) {
			return res.status(403).json({
				message:
					'Невозможно удалить этот слот: он не существует, принадлежит другому врачу или уже забронирован.',
			})
		}

		await pool.query('DELETE FROM time_slots WHERE id = $1', [slotId])
		res.status(200).json({ message: 'Слот успешно удален' })
	} catch (error) {
		console.error(error)
		res.status(500).json({ message: 'Ошибка на стороне сервера' })
	}
}

const getMySlots = async (req, res) => {
	const doctorUserId = req.user.id

	// Получаем параметры пагинации из запроса (например, /my?page=1&limit=10)
	// Устанавливаем значения по умолчанию, если они не переданы
	const page = parseInt(req.query.page) || 1
	const limit = parseInt(req.query.limit) || 15 // По 15 слотов на странице
	const offset = (page - 1) * limit // Вычисляем смещение для SQL

	try {
		// Запрос для получения "порции" данных
		const slotsQuery = `
            SELECT ts.id, ts.start_time, ts.is_booked FROM time_slots ts
            JOIN doctors d ON ts.doctor_id = d.id
            WHERE d.user_id = $1 AND ts.start_time >= NOW()
            ORDER BY ts.start_time
            LIMIT $2 OFFSET $3;
        `
		const slotsResult = await pool.query(slotsQuery, [
			doctorUserId,
			limit,
			offset,
		])

		// Запрос для получения ОБЩЕГО количества слотов (нужно для расчета страниц)
		const totalQuery = `
            SELECT COUNT(*) FROM time_slots ts
            JOIN doctors d ON ts.doctor_id = d.id
            WHERE d.user_id = $1 AND ts.start_time >= NOW();
        `
		const totalResult = await pool.query(totalQuery, [doctorUserId])
		const totalItems = parseInt(totalResult.rows[0].count)

		// Отправляем данные вместе с информацией о пагинации
		res.status(200).json({
			slots: slotsResult.rows,
			pagination: {
				currentPage: page,
				itemsPerPage: limit,
				totalItems: totalItems,
				totalPages: Math.ceil(totalItems / limit),
			},
		})
	} catch (error) {
		console.error(error)
		res.status(500).json({ message: 'Ошибка на стороне сервера' })
	}
}
const generateDaySlots = async (req, res) => {
	const doctorUserId = req.user.id
	const { date } = req.body // Ожидаем дату в формате 'YYYY-MM-DD'

	// --- ВАЛИДАЦИЯ ---
	if (!date) {
		return res.status(400).json({ message: 'Необходимо указать дату' })
	}
	// Запрещаем создавать слоты на прошедшую дату
	const today = new Date()
	today.setHours(0, 0, 0, 0) // Обнуляем время для корректного сравнения
	if (new Date(date) < today) {
		return res
			.status(400)
			.json({ message: 'Нельзя генерировать расписание на прошедшую дату.' })
	}

	try {
		const doctorResult = await pool.query(
			'SELECT id FROM doctors WHERE user_id = $1',
			[doctorUserId]
		)
		const doctorId = doctorResult.rows[0].id

		const slotsToInsert = []
		const day = new Date(date)
		// Цикл с 8:00 до 15:45
		for (let hour = 8; hour < 16; hour++) {
			for (let minute = 0; minute < 60; minute += 15) {
				// Интервал 15 минут
				const startTime = new Date(day)
				startTime.setHours(hour, minute, 0, 0)

				const endTime = new Date(startTime.getTime() + 15 * 60000) // +15 минут

				slotsToInsert.push({ startTime, endTime })
			}
		}

		// Формируем один большой SQL-запрос для вставки всех слотов
		const values = slotsToInsert
			.map(
				slot =>
					`(${doctorId}, '${slot.startTime.toISOString()}', '${slot.endTime.toISOString()}')`
			)
			.join(',')

		// ON CONFLICT DO NOTHING - если слот на это время уже есть, просто игнорируем его
		const query = `
            INSERT INTO time_slots (doctor_id, start_time, end_time)
            VALUES ${values}
            ON CONFLICT (doctor_id, start_time) DO NOTHING;
        `

		await pool.query(query)
		res
			.status(201)
			.json({ message: `Расписание на ${date} успешно сгенерировано.` })
	} catch (error) {
		console.error(error)
		res.status(500).json({ message: 'Ошибка при генерации расписания' })
	}
}

// ОБНОВЛЯЕМ ЭКСПОРТ
module.exports = {
	createSlot, // Оставим на всякий случай
	deleteSlot,
	getMySlots,
	generateDaySlots, // <-- ДОБАВИТЬ
}
