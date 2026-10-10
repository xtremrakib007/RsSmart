package com.retail.pos.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.retail.pos.auth.PosAuthApi
import com.retail.pos.auth.PosLoginRequest
import com.retail.pos.session.PosSessionProvider
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authApi: PosAuthApi,
    private val sessionProvider: PosSessionProvider
) : ViewModel() {
    private val _state = MutableStateFlow(LoginState())
    val state: StateFlow<LoginState> = _state.asStateFlow()
    val isAuthenticated: StateFlow<Boolean> = sessionProvider.isAuthenticated
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), false)

    fun login(email: String, password: String, tenantId: String) {
        if (email.isBlank() || password.isBlank() || tenantId.isBlank()) {
            _state.value = LoginState(error = "Enter your email, password, and Tenant ID.")
            return
        }
        viewModelScope.launch {
            _state.value = LoginState(isLoading = true)
            try {
                val response = authApi.login(PosLoginRequest(email.trim(), password, tenantId.trim()))
                val envelope = response.body()
                val data = envelope?.data
                if (response.isSuccessful && envelope?.success == true && data != null) {
                    sessionProvider.setIdentity(data.user.tenantId, data.user.id, data.accessToken)
                    _state.value = LoginState(success = true)
                } else {
                    val message = when (response.code()) {
                        401 -> "Invalid email, password, or Tenant ID."
                        403 -> "This account does not have access. Contact your company administrator."
                        else -> "Sign-in failed (HTTP ${response.code()}). Check the backend configuration."
                    }
                    _state.value = LoginState(error = message)
                }
            } catch (_: Exception) {
                _state.value = LoginState(error = "Cannot connect to the RsSmart backend. Check the server URL and internet connection.")
            }
        }
    }
}

data class LoginState(
    val isLoading: Boolean = false,
    val success: Boolean = false,
    val error: String? = null
)
