// src/routes/adminRoutes.js

const { Router } = require('express')

// Импортируем контроллеры и middleware
const {
	createDoctor,
	deleteDoctor,
	getAllPatients,
	deletePatient,
} = require('../controllers/adminController')

const { protect, isAdmin } = require('../middleware/authMiddleware')
const upload = require('../middleware/uploadMiddleware') // Middleware для загрузки файлов

const router = Router()

// --- Роуты для управления врачами ---

// POST /api/admin/doctors - создание нового врача с фото
// ПОРЯДОК ОЧЕНЬ ВАЖЕН:
// 1. protect - проверяем токен
// 2. isAdmin - проверяем роль админа
// 3. upload.single('photo') - обрабатываем FormData (файл и текстовые поля)
// 4. createDoctor - наша финальная функция-обработчик
router.post('/doctors', protect, isAdmin, upload.single('photo'), createDoctor)

// DELETE /api/admin/doctors/:id - удаление врача
// Здесь загрузка файла не нужна, поэтому middleware 'upload' отсутствует
router.delete('/doctors/:id', protect, isAdmin, deleteDoctor)

// --- Роуты для управления пациентами ---

// GET /api/admin/patients - получение списка всех пациентов
router.get('/patients', protect, isAdmin, getAllPatients)

// DELETE /api/admin/patients/:id - удаление пациента
router.delete('/patients/:id', protect, isAdmin, deletePatient)

module.exports = router
