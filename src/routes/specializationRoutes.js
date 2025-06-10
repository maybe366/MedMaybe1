// src/routes/specializationRoutes.js
const { Router } = require('express')
const {
	getAllSpecializations,
} = require('../controllers/specializationController')

const router = Router()

// GET /api/specializations
router.get('/', getAllSpecializations)

module.exports = router
