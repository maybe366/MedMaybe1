// src/middleware/uploadMiddleware.js
const multer = require('multer')
const path = require('path')

// Настройка хранилища для файлов
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, 'uploads/') // Папка, куда сохранять файлы
	},
	filename: function (req, file, cb) {
		// Генерируем уникальное имя файла, чтобы избежать конфликтов
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
		cb(
			null,
			file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname)
		)
	},
})

// Фильтр файлов, чтобы принимать только изображения
const fileFilter = (req, file, cb) => {
	if (
		file.mimetype === 'image/jpeg' ||
		file.mimetype === 'image/png' ||
		file.mimetype === 'image/gif'
	) {
		cb(null, true)
	} else {
		cb(new Error('Неподдерживаемый тип файла'), false)
	}
}

const upload = multer({
	storage: storage,
	limits: {
		fileSize: 1024 * 1024 * 5, // Ограничение размера файла 5MB
	},
	fileFilter: fileFilter,
})

module.exports = upload
