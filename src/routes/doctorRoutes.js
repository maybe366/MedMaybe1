// src/routes/doctorRoutes.js
const { Router } = require('express')
// Обновляем импорт из контроллера
const {
	getAllDoctors,
	getAvailableSlots,
} = require('../controllers/doctorController')

const router = Router()

// GET /api/doctors
router.get('/', getAllDoctors)

// GET /api/doctors/:id/slots
router.get('/:id/slots', getAvailableSlots) // <-- ДОБАВИТЬ

module.exports = router
