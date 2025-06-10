// public/js/home.js
const token = localStorage.getItem('token')
const guestNav = document.getElementById('guest-nav')
const userNav = document.getElementById('user-nav')

if (token) {
	// Пользователь авторизован
	guestNav.style.display = 'none'
	userNav.style.display = 'flex' // 'flex' чтобы элементы выстроились в ряд

	// Получаем первую букву email для аватара
	// Так как у нас нет email на этой странице, мы можем либо сделать доп. запрос на /auth/me,
	// либо декодировать токен (что небезопасно на клиенте).
	// Самый простой вариант - просто показать иконку пользователя.
	const userAvatar = document.getElementById('user-avatar-main')
	userAvatar.innerHTML = '<i class="fas fa-user"></i>'

	// Добавляем функционал кнопке выхода
	const logoutBtn = document.getElementById('logout-btn-main')
	logoutBtn.addEventListener('click', () => {
		localStorage.removeItem('token')
		window.location.reload() // Перезагружаем страницу, чтобы шапка обновилась
	})
}
document.addEventListener('DOMContentLoaded', () => {
	const API_URL = 'https://medmaybe1-7.onrender.com/api'
	const doctorsListDiv = document.getElementById('public-doctors-list')

	const fetchDoctors = async () => {
		try {
			const response = await fetch(`${API_URL}/doctors`)
			if (!response.ok) throw new Error('Ошибка загрузки данных')
			const doctors = await response.json()
			renderDoctors(doctors)
		} catch (error) {
			doctorsListDiv.innerHTML = `<p class="error">${error.message}</p>`
		}
	}

	const renderDoctors = doctors => {
		if (doctors.length === 0) {
			doctorsListDiv.innerHTML = '<p>Специалисты не найдены.</p>'
			return
		}
		doctorsListDiv.innerHTML = doctors
			.map(
				doctor => `
            <div class="doctor-profile-card">
                <img src="${
									doctor.photo_url || 'https://via.placeholder.com/150'
								}" alt="Фото ${doctor.first_name}" class="doctor-photo">
                <div class="doctor-info">
                    <h3>${doctor.first_name} ${doctor.last_name}</h3>
                    <p class="specialization">${doctor.specialization}</p>
                    <div class="doctor-details">
                        <p><i class="fas fa-briefcase-medical"></i> <strong>Стаж:</strong> ${
													doctor.experience_years || '?'
												} лет</p>
                        <p><i class="fas fa-door-open"></i> <strong>Кабинет:</strong> №${
													doctor.office_number || '?'
												}</p>
                    </div>
                </div>
            </div>
        `
			)
			.join('')
	}

	fetchDoctors()
})
