// src/controllers/doctorController.js

const pool = require('../config/db')

// Получить всех врачей с их специализациями
const getAllDoctors = async (req, res) => {
	try {
		// ОБНОВЛЯЕМ ЗАПРОС, ДОБАВЛЯЯ НОВЫЕ ПОЛЯ
		const query = `
            SELECT 
                d.id, 
                d.first_name, 
                d.last_name,
                d.photo_url,           -- <-- ДОБАВИТЬ
                d.experience_years,    -- <-- ДОБАВИТЬ
                d.office_number,       -- <-- ДОБАВИТЬ
                s.name AS specialization
            FROM doctors d
            JOIN specializations s ON d.specialization_id = s.id;
        `
		const { rows } = await pool.query(query)
		res.status(200).json(rows)
	} catch (error) {
		/*...*/
	}
}

module.exports = {
	getAllDoctors,
}

// --- ПОЛУЧИТЬ СВОБОДНЫЕ СЛОТЫ ДЛЯ ВРАЧА ---
const getAvailableSlots = async (req, res) => {
    try {
        // Получаем ID врача из параметров URL (например, /api/doctors/1/slots)
        const { id } = req.params;

        // Ищем все временные слоты для этого врача, которые:
        // 1. Еще не забронированы (is_booked = FALSE)
        // 2. Относятся к будущему времени (start_time > NOW())
        const query = `
            SELECT id, start_time, end_time 
            FROM time_slots 
            WHERE doctor_id = $1 AND is_booked = FALSE AND start_time > NOW()
            ORDER BY start_time;
        `;

        const { rows } = await pool.query(query, [id]);

        if (rows.length === 0) {
            return res.status(200).json({ message: "У данного врача нет свободных слотов для записи" });
        }

        res.status(200).json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Ошибка на стороне сервера" });
    }
};

// Обновите экспорт
module.exports = {
    getAllDoctors,
    getAvailableSlots, // <-- ДОБАВИТЬ
};