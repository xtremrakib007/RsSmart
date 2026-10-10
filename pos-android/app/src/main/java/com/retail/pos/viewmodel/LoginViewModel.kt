package com.retail.pos.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.retail.pos.session.PosSessionProvider
import com.retail.shared.auth.AuthApi
import com.retail.shared.auth.AuthSessionStore
import com.retail.shared.auth.LoginRequest
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.io.IOException
import javax.inject.Inject

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authApi: AuthApi,
    private val authSessionStore: AuthSessionStore,
    private val sessionProvider: PosSessionProvider
) : ViewModel() {
    private val _state = MutableStateFlow<LoginState>(LoginState.Idle)
    val state = _state.asStateFlow()

    fun login(email: String, password: String, tenantId: String) {
        if (email.isBlank() || password.isBlank() || tenantId.isBlank()) {
            _state.value = LoginState.Error("Enter your email, password, and company tenant ID.")
            return
        }
        viewModelScope.launch {
            _state.value = LoginState.Loading
            try {
                val response = authApi.login(
                    LoginRequest(
                        email = email.trim(),
                        password = password,
                        tenantId = tenantId.trim()
                    )
                )
                authSessionStore.saveTokens(response.accessToken, response.refreshToken)
                sessionProvider.setIdentity(response.user.tenantId, response.user.id)
                _state.value = LoginState.Success(
                    "${response.user.firstName} ${response.user.lastName}".trim()
                )
            } catch (error: HttpException) {
                _state.value = LoginState.Error(
                    when (error.code()) {
                        401 -> "Login details are incorrect or this account is inactive."
                        429 -> "Too many login attempts. Wait a minute and try again."
                        else -> "Could not sign in (HTTP ${error.code()}). Check the server and try again."
                    }
                )
            } catch (_: IOException) {
                _state.value = LoginState.Error("Cannot reach the RsSmart server. Check the internet connection and API URL.")
            } catch (_: Exception) {
                _state.value = LoginState.Error("Sign-in failed. Check the details and server configuration.")
            }
        }
    }

    fun resetState() {
        if (_state.value !is LoginState.Loading) _state.value = LoginState.Idle
    }

    sealed class LoginState {
        object Idle : LoginState()
        object Loading : LoginState()
        data class Success(val displayName: String) : LoginState()
        data class Error(val message: String) : LoginState()
    }
}
