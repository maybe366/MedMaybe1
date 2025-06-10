// src/controllers/profileController.js
const pool = require('../config/db')

const getMyProfile = async (req, res) => {
	const { id: userId, role } = req.user

	try {
		let profileData = {}
		let appointments = []

		if (role === 'patient') {
			// Получаем данные пациента
			let profileQuery = `
                SELECT p.first_name, p.last_name, p.phone_number, u.email 
                FROM patients p
                JOIN users u ON p.user_id = u.id
                WHERE p.user_id = $1;
            `
			const profileResult = await pool.query(profileQuery, [userId])
			profileData = profileResult.rows[0]

			// Получаем историю записей пациента
			let appointmentsQuery = `
                SELECT 
                    a.id as appointment_id,
                    a.status,
                    ts.start_time,
                    d.first_name as doctor_first_name,
                    d.last_name as doctor_last_name,
                    s.name as specialization
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                JOIN time_slots ts ON a.time_slot_id = ts.id
                JOIN doctors d ON ts.doctor_id = d.id
                JOIN specializations s ON d.specialization_id = s.id
                WHERE p.user_id = $1
                ORDER BY ts.start_time DESC;
            `
			const appointmentsResult = await pool.query(appointmentsQuery, [userId])
			appointments = appointmentsResult.rows
		} else if (role === 'doctor') {
			// Получаем данные врача
			let profileQuery = `
                SELECT d.first_name, d.last_name, s.name as specialization, u.email
                FROM doctors d
                JOIN users u ON d.user_id = u.id
                JOIN specializations s ON d.specialization_id = s.id
                WHERE d.user_id = $1;
            `
			const profileResult = await pool.query(profileQuery, [userId])
			profileData = profileResult.rows[0]

			// Получаем историю приемов врача
			let appointmentsQuery = `
                SELECT 
                    a.status,
                    ts.start_time,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name
                FROM appointments a
                JOIN time_slots ts ON a.time_slot_id = ts.id
                JOIN doctors d ON ts.doctor_id = d.id
                JOIN patients p ON a.patient_id = p.id
                WHERE d.user_id = $1
                ORDER BY ts.start_time DESC;
            `
			const appointmentsResult = await pool.query(appointmentsQuery, [userId])
			appointments = appointmentsResult.rows
		}

		res.status(200).json({ profile: profileData, appointments: appointments })
	} catch (error) {
		console.error(error)
		res.status(500).json({ message: 'Ошибка на стороне сервера' })
	}
}

module.exports = { getMyProfile }
