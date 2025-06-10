// public/js/profile.js

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И КОНСТАНТЫ ---
const API_URL = 'http://localhost:5000/api'
const token = localStorage.getItem('token')
const profileDetailsDiv = document.getElementById('profile-details')
const appointmentsHistoryDiv = document.getElementById('appointments-history')
const logoutBtn = document.getElementById('logout-btn')

// --- ОСНОВНЫЕ ФУНКЦИИ ---

/**
 * Функция выхода из системы: удаляет токен и перенаправляет на страницу входа.
 */
const logout = () => {
	localStorage.removeItem('token')
	window.location.href = 'login.html'
}

/**
 * Форматирует статус записи для красивого отображения.
 * @param {string} status - Статус из БД ('scheduled', 'completed', 'cancelled').
 * @returns {string} - HTML-строка со стилизованным статусом.
 */
const formatStatus = status => {
	if (status === 'scheduled')
		return '<span class="status-scheduled">Запланирована</span>'
	if (status === 'completed')
		return '<span class="status-completed">Завершена</span>'
	if (status === 'cancelled')
		return '<span class="status-cancelled">Отменена</span>'
	return status
}

/**
 * Обработчик для отмены записи.
 * @param {string} appointmentId - ID записи, которую нужно отменить.
 */
const handleCancelAppointment = async appointmentId => {
	if (!confirm('Вы уверены, что хотите отменить эту запись?')) return

	try {
		const response = await fetch(`${API_URL}/appointments/${appointmentId}`, {
			method: 'DELETE',
			headers: { Authorization: `Bearer ${token}` },
		})

		const result = await response.json()
		if (!response.ok) throw new Error(result.message)

		Toastify({
			text: 'Запись успешно отменена!',
			backgroundColor: 'green',
		}).showToast()
		loadProfile() // Перезагружаем данные профиля, чтобы увидеть изменения
	} catch (error) {
		Toastify({
			text: `Ошибка: ${error.message}`,
			backgroundColor: 'red',
		}).showToast()
	}
}

/**
 * Главная функция для загрузки и отображения данных профиля.
 */
const loadProfile = async () => {
	profileDetailsDiv.innerHTML = '<div class="spinner"></div>'
	appointmentsHistoryDiv.innerHTML = '<div class="spinner"></div>'

	try {
		const response = await fetch(`${API_URL}/profile/me`, {
			headers: { Authorization: `Bearer ${token}` },
		})
		if (!response.ok)
			throw new Error(
				'Не удалось загрузить данные профиля. Попробуйте войти снова.'
			)

		const { profile, appointments } = await response.json()

		// 1. Обновляем аватар в шапке
		const userAvatar = document.getElementById('user-avatar')
		if (userAvatar && profile.email) {
			userAvatar.textContent = profile.email.charAt(0).toUpperCase()
		}

		// 2. Рендерим блок с личными данными
		let profileHtml = ''
		if (profile.specialization) {
			// Это профиль врача
			profileHtml = `
                <p><strong>ФИО:</strong> ${profile.first_name} ${profile.last_name}</p>
                <p><strong>Email:</strong> ${profile.email}</p>
                <p><strong>Специализация:</strong> ${profile.specialization}</p>
            `
		} else {
			// Это профиль пациента
			profileHtml = `
                <p><strong>ФИО:</strong> ${profile.first_name} ${
				profile.last_name
			}</p>
                <p><strong>Email:</strong> ${profile.email}</p>
                <p><strong>Телефон:</strong> ${
									profile.phone_number || 'Не указан'
								}</p>
            `
		}
		profileDetailsDiv.innerHTML = profileHtml

		// 3. Рендерим таблицу с историей записей
		if (appointments.length === 0) {
			appointmentsHistoryDiv.innerHTML = '<p>История записей пуста.</p>'
			return
		}

		let appointmentsHtml = `
            <table class="schedule-table">
                <thead>
                    <tr>
                        <th>Дата и время</th>
                        <th>${profile.specialization ? 'Пациент' : 'Врач'}</th>
                        <th>Статус</th>
                        <th>Действие</th>
                    </tr>
                </thead>
                <tbody>
                    ${appointments
											.map(app => {
												const person = profile.specialization
													? `${app.patient_first_name} ${app.patient_last_name}`
													: `${app.doctor_first_name} ${app.doctor_last_name} (${app.specialization})`

												let actionButton = ''
												// Кнопку "Отменить" показываем только для будущих запланированных записей и только для пациента
												if (
													app.status === 'scheduled' &&
													new Date(app.start_time) > new Date() &&
													!profile.specialization
												) {
													actionButton = `<button class="btn-cancel" data-appointment-id="${app.appointment_id}">Отменить</button>`
												}

												return `
                            <tr>
                                <td>${new Date(app.start_time).toLocaleString(
																	'ru-RU',
																	{
																		day: 'numeric',
																		month: 'long',
																		year: 'numeric',
																		hour: '2-digit',
																		minute: '2-digit',
																	}
																)}</td>
                                <td>${person}</td>
                                <td>${formatStatus(app.status)}</td>
                                <td>${actionButton}</td>
                            </tr>
                        `
											})
											.join('')}
                </tbody>
            </table>
        `
		appointmentsHistoryDiv.innerHTML = appointmentsHtml
	} catch (error) {
		Toastify({
			text: error.message,
			duration: 5000,
			backgroundColor: 'linear-gradient(to right, #ff5f6d, #ffc371)',
		}).showToast()
		profileDetailsDiv.innerHTML = `<p class="error">${error.message}</p>`
		appointmentsHistoryDiv.innerHTML = ''
	}
}

// --- ЗАПУСК СКРИПТА ПРИ ЗАГРУЗКЕ СТРАНИЦЫ ---

// Проверяем, есть ли токен. Если нет - пользователь не авторизован.
if (!token) {
	logout()
} else {
	// Если токен есть, вешаем обработчики
	logoutBtn.addEventListener('click', logout)

	// Используем делегирование событий для кнопок отмены
	appointmentsHistoryDiv.addEventListener('click', e => {
		if (e.target.classList.contains('btn-cancel')) {
			const appointmentId = e.target.dataset.appointmentId
			handleCancelAppointment(appointmentId)
		}
	})

	// Загружаем данные профиля
	loadProfile()
}
