// public/js/dashboard.js

// --- КОНСТАНТЫ И ПЕРЕМЕННЫЕ ---
const API_URL = 'https://medmaybe1-7.onrender.com/api'
const token = localStorage.getItem('token')
const userEmailSpan = document.getElementById('user-email')
const logoutBtn = document.getElementById('logout-btn')
const contentArea = document.getElementById('content-area')
const dashboardTitle = document.getElementById('dashboard-title')
const SPINNER_HTML = '<div class="spinner"></div>'

// --- ОСНОВНЫЕ ФУНКЦИИ ---

// Функция выхода из системы
const logout = () => {
	localStorage.removeItem('token')
	window.location.href = 'login.html'
}

// Главная функция инициализации дашборда
const initializeDashboard = async () => {
	try {
		const response = await fetch(`${API_URL}/auth/me`, {
			method: 'GET',
			headers: { Authorization: `Bearer ${token}` },
		})

		if (!response.ok) {
			throw new Error('Сессия истекла. Пожалуйста, войдите снова.')
		}

		const user = await response.json()
		const userAvatar = document.getElementById('user-avatar')
		if (userAvatar) {
			userAvatar.textContent = user.email.charAt(0).toUpperCase()
		}

		// Рендерим дашборд в зависимости от роли
		switch (user.role) {
			case 'patient':
				renderPatientDashboard()
				break
			case 'doctor':
				renderDoctorDashboard()
				break
			case 'admin':
				renderAdminDashboard()
				break
			default:
				contentArea.innerHTML =
					'<p class="error">Неизвестная роль пользователя.</p>'
		}
	} catch (error) {
		logout()
	}
}

// --- ФУНКЦИИ ДЛЯ ПАЦИЕНТА ---

const renderPatientDashboard = () => {
	dashboardTitle.textContent = 'Панель пациента'
	contentArea.innerHTML = `
        <h2>Найти врача</h2>
        <div id="doctors-list" class="doctors-list"></div>
    `
	fetchAndRenderDoctors()
}

const fetchAndRenderDoctors = async () => {
	const doctorsListDiv = document.getElementById('doctors-list')
	doctorsListDiv.innerHTML = SPINNER_HTML

	try {
		const response = await fetch(`${API_URL}/doctors`)
		if (!response.ok) throw new Error('Не удалось загрузить список врачей')

		const doctors = await response.json()
		if (doctors.length === 0) {
			doctorsListDiv.innerHTML = '<p>Врачи не найдены.</p>'
			return
		}

		doctorsListDiv.innerHTML = doctors
			.map(
				doctor => `
            <div class="doctor-card" data-doctor-id="${doctor.id}">
                <h3>${doctor.first_name} ${doctor.last_name}</h3>
                <p>${doctor.specialization}</p>
            </div>
        `
			)
			.join('')
	} catch (error) {
		doctorsListDiv.innerHTML = `<p class="error">${error.message}</p>`
	}
}

const fetchAndRenderSlots = async doctorId => {
	contentArea.innerHTML = `
        <button id="back-to-doctors" class="btn btn-secondary">← Назад к списку врачей</button>
        <h2>Доступные слоты для записи</h2>
        <div id="slots-list"></div>
    `
	document
		.getElementById('back-to-doctors')
		.addEventListener('click', renderPatientDashboard)

	const slotsListDiv = document.getElementById('slots-list')
	slotsListDiv.innerHTML = SPINNER_HTML

	try {
		const response = await fetch(`${API_URL}/doctors/${doctorId}/slots`)
		if (!response.ok) throw new Error('Не удалось загрузить слоты')

		const slots = await response.json()
		if (slots.length === 0 || slots.message) {
			slotsListDiv.innerHTML = '<p>Свободных слотов нет.</p>'
			return
		}

		slotsListDiv.innerHTML = slots
			.map(slot => {
				const startTime = new Date(slot.start_time).toLocaleString('ru-RU', {
					day: '2-digit',
					month: 'long',
					hour: '2-digit',
					minute: '2-digit',
				})
				return `<button class="slot-btn" data-slot-id="${slot.id}">${startTime}</button>`
			})
			.join('')
	} catch (error) {
		slotsListDiv.innerHTML = `<p class="error">${error.message}</p>`
	}
}

const bookAppointment = async slotId => {
	if (!confirm('Вы уверены, что хотите записаться на это время?')) return

	try {
		const response = await fetch(`${API_URL}/appointments`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({ timeSlotId: slotId }),
		})

		const result = await response.json()
		if (!response.ok) throw new Error(result.message || 'Не удалось записаться')

		Toastify({
			text: 'Вы успешно записаны на прием!',
			backgroundColor: 'green',
		}).showToast()
		renderPatientDashboard()
	} catch (error) {
		Toastify({
			text: `Ошибка записи: ${error.message}`,
			backgroundColor: 'red',
		}).showToast()
	}
}

// --- ФУНКЦИИ ДЛЯ ВРАЧА ---

const renderDoctorDashboard = () => {
	dashboardTitle.textContent = 'Управление расписанием'
	contentArea.innerHTML = `
        <div class="schedule-management">
            <h3>Добавить новый слот приема</h3>
            <form id="add-slot-form" class="form-inline">
                <div class="form-group">
                    <label for="slot-date">Выберите дату и время</label>
                    <input type="datetime-local" id="slot-date" required>
                </div>
                <button type="submit" class="btn">Добавить слот</button>
            </form>
            <hr>
            <h3>Мои будущие слоты</h3>
            <div id="doctor-slots-list"></div>
        </div>
    `

	// Запрещаем выбирать прошедшие даты и время
	const dateTimeInput = document.getElementById('slot-date')
	const now = new Date()
	// Корректируем часовой пояс для input[type=datetime-local]
	now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
	dateTimeInput.setAttribute('min', now.toISOString().slice(0, 16))

	// Вызываем пагинированный вывод слотов, как и раньше
	fetchAndRenderDoctorSlots()

	// Вешаем обработчик на новую форму
	document
		.getElementById('add-slot-form')
		.addEventListener('submit', handleAddSlot)
}

const fetchAndRenderDoctorSlots = async (page = 1) => {
	// Принимаем номер страницы
	const listDiv = document.getElementById('doctor-slots-list')
	listDiv.innerHTML = SPINNER_HTML

	try {
		// Добавляем параметры пагинации в URL
		const response = await fetch(`${API_URL}/slots/my?page=${page}&limit=15`, {
			headers: { Authorization: `Bearer ${token}` },
		})
		if (!response.ok) throw new Error('Не удалось загрузить слоты')

		const data = await response.json()
		const { slots, pagination } = data // Получаем и слоты, и пагинацию

		if (slots.length === 0) {
			listDiv.innerHTML = '<p>У вас нет запланированных слотов.</p>'
			return
		}

		// Рендерим список слотов
		const slotsHtml = `
            <ul class="item-list">
                ${slots
									.map(
										slot => `
                    <li class="${slot.is_booked ? 'booked' : ''}">
                        <span>${new Date(slot.start_time).toLocaleString(
													'ru-RU',
													{
														day: 'numeric',
														month: 'long',
														year: 'numeric',
														hour: '2-digit',
														minute: '2-digit',
													}
												)} - ${
											slot.is_booked ? 'ЗАБРОНИРОВАН' : 'Свободен'
										}</span>
                        ${
													!slot.is_booked
														? `<button class="btn-delete" data-type="slot" data-id="${slot.id}">Удалить</button>`
														: ''
												}
                    </li>
                `
									)
									.join('')}
            </ul>
        `

		// Рендерим кнопки пагинации, если страниц больше одной
		let paginationHtml = ''
		if (pagination.totalPages > 1) {
			paginationHtml = `
                <div class="pagination">
                    <button class="btn-pagination" data-page="${
											pagination.currentPage - 1
										}" ${
				pagination.currentPage === 1 ? 'disabled' : ''
			}>← Назад</button>
                    <span>Страница ${pagination.currentPage} из ${
				pagination.totalPages
			}</span>
                    <button class="btn-pagination" data-page="${
											pagination.currentPage + 1
										}" ${
				pagination.currentPage === pagination.totalPages ? 'disabled' : ''
			}>Вперед →</button>
                </div>
            `
		}

		// Собираем и выводим всё вместе
		listDiv.innerHTML = slotsHtml + paginationHtml
	} catch (error) {
		listDiv.innerHTML = `<p class="error">${error.message}</p>`
	}
}

const handleAddSlot = async e => {
	e.preventDefault()
	const startTimeInput = document.getElementById('slot-date')
	const startTimeValue = startTimeInput.value

	if (!startTimeValue) {
		Toastify({
			text: 'Выберите дату и время',
			backgroundColor: 'orange',
		}).showToast()
		return
	}

	// --- НОВАЯ ПРОВЕРКА ВРЕМЕНИ ---
	const selectedDate = new Date(startTimeValue)
	const selectedHour = selectedDate.getHours()

	// Проверяем, что час находится в диапазоне от 8 до 15 (т.к. 16:00 - это уже конец)
	if (selectedHour < 8 || selectedHour >= 16) {
		Toastify({
			text: 'Пожалуйста, выберите время в рабочем диапазоне (с 8:00 до 16:00)',
			duration: 5000,
			backgroundColor: 'orange',
		}).showToast()
		return // Прерываем выполнение функции
	}
	// --- КОНЕЦ ПРОВЕРКИ ---

	try {
		const response = await fetch(`${API_URL}/slots`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({ startTime: selectedDate.toISOString() }), // Используем уже созданный объект Date
		})

		const result = await response.json()
		if (!response.ok)
			throw new Error(result.message || 'Ошибка добавления слота')

		Toastify({
			text: 'Слот успешно добавлен!',
			backgroundColor: 'green',
		}).showToast()
		startTimeInput.value = ''

		fetchAndRenderDoctorSlots()
	} catch (error) {
		Toastify({
			text: `Ошибка: ${error.message}`,
			backgroundColor: 'red',
		}).showToast()
	}
}

const handleDeleteSlot = async slotId => {
	if (!confirm('Удалить этот временной слот?')) return
	try {
		const response = await fetch(`${API_URL}/slots/${slotId}`, {
			method: 'DELETE',
			headers: { Authorization: `Bearer ${token}` },
		})
		const result = await response.json()
		if (!response.ok) throw new Error(result.message)
		Toastify({ text: 'Слот удален', backgroundColor: 'green' }).showToast()
		fetchAndRenderDoctorSlots()
	} catch (error) {
		Toastify({
			text: `Ошибка: ${error.message}`,
			backgroundColor: 'red',
		}).showToast()
	}
}

// --- ФУНКЦИИ ДЛЯ АДМИНИСТРАТОРА ---

const renderAdminDashboard = () => {
	dashboardTitle.textContent = 'Панель администратора'
	contentArea.innerHTML = `
        <div class="admin-panel">
            <div class="admin-section">
                <h2>Управление врачами</h2>
                <div id="admin-doctors-list"></div>
                <hr>
                <h3>Добавить нового врача</h3>
                <form id="add-doctor-form">
                    <div class="form-group"><label for="doc-firstName">Имя</label><input type="text" id="doc-firstName" required></div>
                    <div class="form-group"><label for="doc-lastName">Фамилия</label><input type="text" id="doc-lastName" required></div>
                    <div class="form-group"><label for="doc-email">Email</label><input type="email" id="doc-email" required></div>
                    <div class="form-group"><label for="doc-password">Пароль</label><input type="password" id="doc-password" required></div>
                    <div class="form-group"><label for="doc-photo">Фото</label><input type="file" id="doc-photo" accept="image/*"></div>
                    <div class="form-group"><label for="doc-experienceYears">Стаж (лет)</label><input type="number" id="doc-experienceYears"></div>
                    <div class="form-group"><label for="doc-officeNumber">Кабинет</label><input type="text" id="doc-officeNumber"></div>
                    <div class="form-group"><label for="doc-specialization">Специализация</label><select id="doc-specialization" required></select></div>
                    <button type="submit" class="btn">Добавить врача</button>
                </form>
            </div>
            <div class="admin-section">
                <h2>Управление пациентами</h2>
                <div id="admin-patients-list"></div>
            </div>
        </div>
    `
	fetchAdminData()
}

const fetchAdminData = async () => {
	await fetchAndRenderAdminDoctors()
	await fetchAndRenderAdminPatients()
	await fetchAndRenderSpecializations()
	document
		.getElementById('add-doctor-form')
		.addEventListener('submit', handleAddDoctor)
}

const fetchAndRenderAdminDoctors = async () => {
	const listDiv = document.getElementById('admin-doctors-list')
	listDiv.innerHTML = SPINNER_HTML
	try {
		const response = await fetch(`${API_URL}/doctors`)
		const doctors = await response.json()
		listDiv.innerHTML = `<ul class="item-list">${doctors
			.map(
				d =>
					`<li><span>${d.first_name} ${d.last_name} (${d.specialization})</span><button class="btn-delete" data-type="doctor" data-id="${d.id}">Удалить</button></li>`
			)
			.join('')}</ul>`
	} catch (error) {
		listDiv.innerHTML = `<p class="error">Ошибка загрузки врачей</p>`
	}
}

const fetchAndRenderAdminPatients = async () => {
	const listDiv = document.getElementById('admin-patients-list')
	listDiv.innerHTML = SPINNER_HTML
	try {
		const response = await fetch(`${API_URL}/admin/patients`, {
			headers: { Authorization: `Bearer ${token}` },
		})
		const patients = await response.json()
		listDiv.innerHTML = `<ul class="item-list">${patients
			.map(
				p =>
					`<li><span>${p.first_name} ${p.last_name} (${p.email})</span><button class="btn-delete" data-type="patient" data-id="${p.id}">Удалить</button></li>`
			)
			.join('')}</ul>`
	} catch (error) {
		listDiv.innerHTML = `<p class="error">Ошибка загрузки пациентов</p>`
	}
}

const fetchAndRenderSpecializations = async () => {
	const select = document.getElementById('doc-specialization')
	try {
		const response = await fetch(`${API_URL}/specializations`)
		const specializations = await response.json()
		select.innerHTML = specializations
			.map(spec => `<option value="${spec.id}">${spec.name}</option>`)
			.join('')
	} catch (error) {
		select.innerHTML = `<option value="">Ошибка загрузки</option>`
	}
}

const handleAddDoctor = async e => {
	e.preventDefault()
	const form = e.target

	// Когда мы отправляем файлы, мы должны использовать FormData
	const formData = new FormData()
	formData.append('firstName', form.querySelector('#doc-firstName').value)
	formData.append('lastName', form.querySelector('#doc-lastName').value)
	formData.append('email', form.querySelector('#doc-email').value)
	formData.append('password', form.querySelector('#doc-password').value)
	formData.append(
		'specializationId',
		form.querySelector('#doc-specialization').value
	)
	formData.append(
		'experienceYears',
		form.querySelector('#doc-experienceYears').value
	)
	formData.append('officeNumber', form.querySelector('#doc-officeNumber').value)

	// Добавляем файл, если он выбран
	const photoInput = form.querySelector('#doc-photo')
	if (photoInput.files[0]) {
		formData.append('photo', photoInput.files[0])
	}

	try {
		const response = await fetch(`${API_URL}/admin/doctors`, {
			method: 'POST',
			headers: {
				// ВАЖНО: Не указываем 'Content-Type'. Браузер сделает это сам для FormData.
				Authorization: `Bearer ${token}`,
			},
			body: formData,
		})
		const result = await response.json()
		if (!response.ok) throw new Error(result.message || 'Ошибка')

		Toastify({
			text: 'Врач успешно добавлен!',
			backgroundColor: 'green',
		}).showToast()
		form.reset()
		fetchAndRenderAdminDoctors()
	} catch (error) {
		Toastify({
			text: `Ошибка: ${error.message}`,
			backgroundColor: 'red',
		}).showToast()
	}
}

const handleDelete = async (type, id) => {
	if (!confirm(`Вы уверены, что хотите удалить этого пользователя?`)) return
	let url =
		type === 'doctor'
			? `${API_URL}/admin/doctors/${id}`
			: `${API_URL}/admin/patients/${id}`
	try {
		const response = await fetch(url, {
			method: 'DELETE',
			headers: { Authorization: `Bearer ${token}` },
		})
		const result = await response.json()
		if (!response.ok) throw new Error(result.message || 'Ошибка')
		Toastify({
			text: 'Пользователь успешно удален.',
			backgroundColor: 'green',
		}).showToast()
		if (type === 'doctor') fetchAndRenderAdminDoctors()
		if (type === 'patient') fetchAndRenderAdminPatients()
	} catch (error) {
		Toastify({
			text: `Ошибка: ${error.message}`,
			backgroundColor: 'red',
		}).showToast()
	}
}

// --- ЕДИНЫЙ ОБРАБОТЧИК СОБЫТИЙ ---
contentArea.addEventListener('click', e => {
	const target = e.target

	const doctorCard = target.closest('.doctor-card')
	if (doctorCard) {
		fetchAndRenderSlots(doctorCard.dataset.doctorId)
		return
	}

	if (target.classList.contains('slot-btn')) {
		bookAppointment(target.dataset.slotId)
		return
	}

	if (target.classList.contains('btn-delete')) {
		const type = target.dataset.type
		const id = target.dataset.id
		if (type === 'slot') {
			handleDeleteSlot(id)
		} else {
			handleDelete(type, id)
		}
		return
	}
    const paginationButton = target.closest('.btn-pagination')
		if (paginationButton && !paginationButton.disabled) {
			const page = parseInt(paginationButton.dataset.page)
			fetchAndRenderDoctorSlots(page)
			return
		}
})

// --- ЗАПУСК ПРИ ЗАГРУЗКЕ СТРАНИЦЫ ---
if (!token) {
	logout()
} else {
	logoutBtn.addEventListener('click', logout)
	initializeDashboard()
}
