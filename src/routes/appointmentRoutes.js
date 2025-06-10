// src/routes/appointmentRoutes.js
const { Router } = require('express')
// Обновляем импорт
const { createAppointment, getMyAppointments, cancelAppointment } = require('../controllers/appointmentController'); // Обновляем импорт
const { protect } = require('../middleware/authMiddleware')

const router = Router()

// Маршрут для получения "моих" записей (контекст зависит от роли)
// GET /api/appointments/my
router.get('/my', protect, getMyAppointments) // <-- ДОБАВИТЬ

// Маршрут для создания записи
// POST /api/appointments
router.post('/', protect, createAppointment)
router.delete('/:id', protect, cancelAppointment) // <-- ДОБАВИТЬ

module.exports = router
