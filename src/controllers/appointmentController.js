// src/controllers/appointmentController.js
const pool = require('../config/db')

// --- СОЗДАТЬ НОВУЮ ЗАПИСЬ НА ПРИЕМ ---
const createAppointment = async (req, res) => {
	// ID пациента мы берем из req.user, который добавило middleware 'protect'
	const patientUserId = req.user.id

	// ID слота мы получаем из тела запроса
	const { timeSlotId } = req.body

	if (!timeSlotId) {
		return res
			.status(400)
			.json({ message: 'Не указан временной слот для записи' })
	}

	const client = await pool.connect()
	try {
		// Начинаем транзакцию, чтобы обе операции (создание записи и обновление слота)
		// были выполнены успешно, либо не выполнены вовсе.
		await client.query('BEGIN')

		// 1. Находим профиль пациента по его user_id
		const patientResult = await client.query(
			'SELECT id FROM patients WHERE user_id = $1',
			[patientUserId]
		)
		if (patientResult.rows.length === 0) {
			return res.status(404).json({ message: 'Профиль пациента не найден' })
		}
		const patientId = patientResult.rows[0].id

		// 2. Проверяем, свободен ли еще слот (дополнительная защита от "гонки" запросов)
		const slotResult = await client.query(
			'SELECT is_booked FROM time_slots WHERE id = $1',
			[timeSlotId]
		)
		if (slotResult.rows.length === 0) {
			return res
				.status(404)
				.json({ message: 'Выбранный временной слот не найден' })
		}
		if (slotResult.rows[0].is_booked) {
			return res
				.status(409)
				.json({ message: 'К сожалению, на это время уже кто-то записался' }) // 409 Conflict
		}

		// 3. Создаем запись в таблице appointments
		const appointmentQuery = `
            INSERT INTO appointments (patient_id, time_slot_id, status) 
            VALUES ($1, $2, 'scheduled') 
            RETURNING id, created_at;
        `
		const newAppointment = await client.query(appointmentQuery, [
			patientId,
			timeSlotId,
		])

		// 4. Обновляем статус слота на "занят"
		await client.query('UPDATE time_slots SET is_booked = TRUE WHERE id = $1', [
			timeSlotId,
		])

		// Если все прошло успешно, фиксируем изменения
		await client.query('COMMIT')

		res.status(201).json({
			message: 'Вы успешно записаны на прием!',
			appointment: newAppointment.rows[0],
		})
	} catch (error) {
		// Если на каком-то этапе произошла ошибка, откатываем все изменения
		await client.query('ROLLBACK')
		console.error(error)
		res
			.status(500)
			.json({ message: 'Ошибка на стороне сервера при создании записи' })
	} finally {
		// Всегда освобождаем клиент, чтобы вернуть его в пул соединений
		client.release()
	}
}

module.exports = {
	createAppointment,
}

// --- ПОЛУЧИТЬ СПИСОК ЗАПИСЕЙ (ДЛЯ ПАЦИЕНТА ИЛИ ВРАЧА) ---
const getMyAppointments = async (req, res) => {
    // Получаем данные пользователя из токена
    const { id: userId, role } = req.user;

    try {
        let query;
        let queryParams = [userId];

        if (role === 'patient') {
            // Если запрашивает ПАЦИЕНТ, показываем его будущие записи
            // Нам нужно связать несколько таблиц, чтобы получить полную информацию:
            // appointments -> patients (чтобы найти пациента по user_id)
            // appointments -> time_slots (чтобы узнать время)
            // time_slots -> doctors (чтобы узнать имя врача)
            // doctors -> specializations (чтобы узнать специализацию врача)
            query = `
                SELECT 
                    a.id as appointment_id,
                    a.status,
                    ts.start_time,
                    ts.end_time,
                    d.first_name as doctor_first_name,
                    d.last_name as doctor_last_name,
                    s.name as specialization
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                JOIN time_slots ts ON a.time_slot_id = ts.id
                JOIN doctors d ON ts.doctor_id = d.id
                JOIN specializations s ON d.specialization_id = s.id
                WHERE p.user_id = $1 AND ts.start_time >= NOW() AND a.status = 'scheduled'
                ORDER BY ts.start_time;
            `;
        } else if (role === 'doctor') {
            // Если запрашивает ВРАЧ, показываем, кто к нему записан на сегодня
            // Логика связей похожа, но мы ищем по ID врача
            query = `
                SELECT 
                    a.id as appointment_id,
                    ts.start_time,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    p.phone_number as patient_phone
                FROM appointments a
                JOIN time_slots ts ON a.time_slot_id = ts.id
                JOIN doctors d ON ts.doctor_id = d.id
                JOIN patients p ON a.patient_id = p.id
                WHERE d.user_id = $1 
                  AND ts.start_time::date = CURRENT_DATE 
                  AND a.status = 'scheduled'
                ORDER BY ts.start_time;
            `;
            // ts.start_time::date = CURRENT_DATE -- это специфичный для PostgreSQL синтаксис 
            // для сравнения только даты, без учета времени.
        } else {
            // Если роль не пациент и не врач (например, админ), доступ запрещен
            return res.status(403).json({ message: "Доступ запрещен для вашей роли" });
        }

        const { rows } = await pool.query(query, queryParams);
        res.status(200).json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Ошибка на стороне сервера" });
    }
};

const cancelAppointment = async (req, res) => {
	const { id: appointmentId } = req.params // ID записи, которую отменяем
	const { id: userId } = req.user // ID пользователя из токена

	const client = await pool.connect()
	try {
		await client.query('BEGIN') // Начинаем транзакцию

		// 1. Находим запись и проверяем, принадлежит ли она текущему пациенту и можно ли ее отменить
		const appointmentResult = await client.query(
			`SELECT a.time_slot_id, a.status FROM appointments a
             JOIN patients p ON a.patient_id = p.id
             WHERE a.id = $1 AND p.user_id = $2`,
			[appointmentId, userId]
		)

		if (appointmentResult.rows.length === 0) {
			return res
				.status(403)
				.json({ message: 'Это не ваша запись или она не существует.' })
		}

		const appointment = appointmentResult.rows[0]
		if (appointment.status !== 'scheduled') {
			return res
				.status(400)
				.json({
					message: `Нельзя отменить запись со статусом "${appointment.status}".`,
				})
		}

		// 2. Меняем статус записи на 'cancelled'
		await client.query(
			`UPDATE appointments SET status = 'cancelled' WHERE id = $1`,
			[appointmentId]
		)

		// 3. Освобождаем временной слот, делая его снова доступным
		await client.query(
			`UPDATE time_slots SET is_booked = FALSE WHERE id = $1`,
			[appointment.time_slot_id]
		)

		await client.query('COMMIT') // Фиксируем изменения
		res.status(200).json({ message: 'Запись успешно отменена.' })
	} catch (error) {
		await client.query('ROLLBACK') // Откатываем в случае ошибки
		console.error(error)
		res.status(500).json({ message: 'Ошибка на стороне сервера' })
	} finally {
		client.release()
	}
}

// Обновляем экспорт
module.exports = {
	createAppointment,
	getMyAppointments, // <-- ДОБАВИТЬ
	cancelAppointment,
}