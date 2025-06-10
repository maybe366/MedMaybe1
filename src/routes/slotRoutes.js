// src/routes/slotRoutes.js
const { Router } = require('express')

// Импортируем функции из контроллера слотов
const {
	createSlot,
	deleteSlot,
	getMySlots,
	generateDaySlots,
} = require('../controllers/slotController')

// Импортируем middleware из центрального файла
const { protect, isDoctor } = require('../middleware/authMiddleware')

const router = Router()

// --- МАРШРУТЫ, ДОСТУПНЫЕ ТОЛЬКО ВРАЧАМ ---

// GET /api/slots/my - получить все свои слоты
// Сначала сработает protect, потом isDoctor, и только потом getMySlots
router.get('/my', protect, isDoctor, getMySlots)

// POST /api/slots/generate-day - сгенерировать расписание на день
router.post('/generate-day', protect, isDoctor, generateDaySlots)

// DELETE /api/slots/:id - удалить один слот
router.delete('/:id', protect, isDoctor, deleteSlot)

// Оставим этот маршрут на всякий случай, если он понадобится
// POST /api/slots - создать один слот
router.post('/', protect, isDoctor, createSlot)

module.exports = router
