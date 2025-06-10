// js/main.js

const API_URL = 'https://medmaybe1-7.onrender.com/api' // Базовый URL нашего API

// --- Получаем элементы форм и сообщений ---
const registerForm = document.getElementById('register-form')
const loginForm = document.getElementById('login-form')
const messageDiv = document.getElementById('message')

// --- Функция для отображения сообщений ---
const showMessage = (message, isError = false) => {
	if (messageDiv) {
		messageDiv.textContent = message
		messageDiv.className = 'message' // Сброс классов
		if (isError) {
			messageDiv.classList.add('error')
		} else {
			messageDiv.classList.add('success')
		}
	}
}

// --- Обработчик для формы РЕГИСТРАЦИИ ---
if (registerForm) {
	registerForm.addEventListener('submit', async e => {
		e.preventDefault() // Предотвращаем стандартную отправку формы

		const formData = new FormData(registerForm)
		const data = Object.fromEntries(formData.entries())

		try {
			const response = await fetch(`${API_URL}/auth/register`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(data),
			})

			const result = await response.json()

			if (!response.ok) {
				// Если сервер вернул ошибку (статус 4xx или 5xx)
				throw new Error(result.message || 'Ошибка регистрации')
			}

			// Успешная регистрация
			showMessage(
				'Регистрация прошла успешно! Вы будете перенаправлены на страницу входа.'
			)
            Toastify({
							text: 'Регистрация прошла успешно!',
							duration: 3000,
							gravity: 'top',
							position: 'center',
							backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
						}).showToast()

			// Сохраняем токен в localStorage
			localStorage.setItem('token', result.token)

			// Перенаправляем на страницу входа через 2 секунды
			setTimeout(() => {
				window.location.href = 'login.html'
			}, 2000)
            
		} catch (error) {
            Toastify({
                text: error.message,
                duration: 3000,
                gravity: "top",
                position: "center",
                backgroundColor: "linear-gradient(to right, #ff5f6d, #ffc371)",
            }).showToast();
        }
	})
}

// --- Обработчик для формы АВТОРИЗАЦИИ ---
if (loginForm) {
	loginForm.addEventListener('submit', async e => {
		e.preventDefault()

		const formData = new FormData(loginForm)
		const data = Object.fromEntries(formData.entries())

		try {
			const response = await fetch(`${API_URL}/auth/login`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(data),
			})

			const result = await response.json()

			if (!response.ok) {
				throw new Error(result.message || 'Ошибка входа')
			}

			// ... после успешного fetch ...
			showMessage('Вход выполнен успешно! Перенаправление...')

			// Сохраняем токен в localStorage
			localStorage.setItem('token', result.token)

			// Перенаправляем на страницу дашборда через 1 секунду
			setTimeout(() => {
				window.location.href = 'dashboard.html'
			}, 1000)
		} catch (error) {
			showMessage(error.message, true)
		}
	})
}
