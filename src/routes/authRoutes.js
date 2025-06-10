const { Router } = require('express')
const { register, login, getMe } = require('../controllers/authController')
const { protect } = require('../middleware/authMiddleware') // <-- ИМПОРТИРУЕМ ЗАЩИТУ

const router = Router()

router.post('/register', register)
router.post('/login', login)

// Новый защищенный маршрут
// GET /api/auth/me
// Сначала сработает 'protect', и если все хорошо, то вызовется 'getMe'
router.get('/me', protect, getMe) // <-- ДОБАВИТЬ

module.exports = router
