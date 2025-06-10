// app.js

const express = require('express')
const cors = require('cors'); // <-- ИМПОРТИРОВАТЬ
require('dotenv').config()


const doctorRoutes = require('./src/routes/doctorRoutes')
const authRoutes = require('./src/routes/authRoutes') // <-- ДОБАВИТЬ
const appointmentRoutes = require('./src/routes/appointmentRoutes'); // <-- ДОБАВИТЬ
const adminRoutes = require('./src/routes/adminRoutes'); // <-- ДОБАВИТЬ
const specializationRoutes = require('./src/routes/specializationRoutes'); // <-- ДОБАВИТЬ
const slotRoutes = require('./src/routes/slotRoutes'); // <-- ДОБАВИТЬ
const profileRoutes = require('./src/routes/profileRoutes'); // <-- ДОБАВИТЬ
const path = require('path')

const app = express()
const PORT = process.env.PORT || 5000

app.use(
	cors({
		origin: 'https://medmaybe.netlify.app', // Разрешаем запросы ТОЛЬКО с твоего сайта
	})
)
app.use(express.json())


app.get('/', (req, res) => {
	res.send('Сервер для записи к врачу работает!')
})

// Подключаем роуты
app.use('/api/doctors', doctorRoutes)
app.use('/api/auth', authRoutes) // <-- ДОБАВИТЬ
app.use('/api/appointments', appointmentRoutes); // <-- ДОБАВИТЬ
app.use('/api/admin', adminRoutes); // <-- ДОБАВИТЬ
app.use('/api/specializations', specializationRoutes); // <-- ДОБАВИТЬ
app.use('/api/slots', slotRoutes); // <-- ДОБАВИТЬ
app.use('/api/profile', profileRoutes); // <-- ДОБАВИТЬ
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

app.listen(PORT, () => {
	console.log(`Сервер запущен на порту ${PORT}`)
})