package com.company.salesapp.presentation.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.company.salesapp.data.repository.AuthRepository
import com.company.salesapp.data.repository.PushTokenRepository
import com.google.firebase.messaging.FirebaseMessaging
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val pushTokenRepository: PushTokenRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(LoginState())
    val state: StateFlow<LoginState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            authRepository.isLoggedIn.collect { isLoggedIn ->
                _state.update { it.copy(isLoggedIn = isLoggedIn) }
            }
        }
    }

    fun login(email: String, password: String, tenantId: String) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            val result = authRepository.login(email, password, tenantId)
            result.onSuccess {
                _state.update { it.copy(isLoading = false, isLoggedIn = true) }
                registerPushToken()
            }.onFailure { error ->
                _state.update { it.copy(isLoading = false, error = error.message) }
            }
        }
    }

    private fun registerPushToken() {
        viewModelScope.launch {
            try {
                val token = FirebaseMessaging.getInstance().token.await()
                pushTokenRepository.register(token)
            } catch (e: Exception) {
                // Non-fatal: FcmService.onNewToken will pick this up on the
                // next natural token refresh if this attempt fails.
            }
        }
    }
}

data class LoginState(
    val isLoading: Boolean = false,
    val isLoggedIn: Boolean = false,
    val error: String? = null
)
