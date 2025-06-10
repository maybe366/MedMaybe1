// src/routes/profileRoutes.js
const { Router } = require('express')
const { getMyProfile } = require('../controllers/profileController')
const { protect } = require('../middleware/authMiddleware')

const router = Router()

// GET /api/profile/me
// Роут защищен, доступен всем авторизованным пользователям
router.get('/me', protect, getMyProfile)

module.exports = router
