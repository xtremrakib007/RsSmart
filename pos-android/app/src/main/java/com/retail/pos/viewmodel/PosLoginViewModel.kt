package com.retail.pos.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.retail.pos.session.PosAuthStore
import com.retail.pos.session.PosSessionProvider
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import javax.inject.Inject

@HiltViewModel
class PosLoginViewModel @Inject constructor(
    private val authStore: PosAuthStore,
    private val sessionProvider: PosSessionProvider
) : ViewModel() {
    private val _state = MutableStateFlow<LoginState>(LoginState.Idle)
    val state: StateFlow<LoginState> = _state.asStateFlow()

    val savedApiBaseUrl: String get() = authStore.apiBaseUrl()
    val alreadyLoggedIn: Boolean get() = authStore.isLoggedIn()

    fun login(apiBaseUrl: String, tenantId: String, email: String, password: String) {
        if (_state.value is LoginState.Loading) return
        viewModelScope.launch {
            _state.value = LoginState.Loading
            try {
                val base = apiBaseUrl.trim().trimEnd('/')
                val parsed = URL(base)
                require(parsed.protocol.equals("https", ignoreCase = true)) {
                    "Use your secure HTTPS backend URL."
                }
                require(!tenantId.isBlank() && !email.isBlank() && password.isNotEmpty()) {
                    "Enter your company tenant ID, email and password."
                }

                val session = withContext(Dispatchers.IO) {
                    val connection = (URL("$base/auth/login").openConnection() as HttpURLConnection)
                    try {
                        connection.requestMethod = "POST"
                        connection.connectTimeout = 12_000
                        connection.readTimeout = 12_000
                        connection.doOutput = true
                        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                        connection.setRequestProperty("Accept", "application/json")
                        val body = JSONObject()
                            .put("tenantId", tenantId.trim())
                            .put("email", email.trim())
                            .put("password", password)
                            .toString()
                        connection.outputStream.use { it.write(body.toByteArray(StandardCharsets.UTF_8)) }
                        val status = connection.responseCode
                        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
                        val responseText = stream?.bufferedReader(StandardCharsets.UTF_8)?.use { it.readText() }.orEmpty()
                        if (status !in 200..299) throw IllegalStateException(
                            if (status == 401) "Email, password or tenant ID is incorrect, or the account is inactive."
                            else "Login service returned an error (HTTP $status). Check the backend URL and try again."
                        )
                        val response = JSONObject(responseText)
                        val user = response.getJSONObject("user")
                        val accessToken = response.getString("accessToken")
                        val refreshToken = response.getString("refreshToken")
                        val resolvedTenantId = user.getString("tenantId")
                        val userId = user.getString("id")
                        require(accessToken.isNotBlank() && refreshToken.isNotBlank()) {
                            "The login response did not contain valid session tokens."
                        }
                        Triple(
                            resolvedTenantId to userId,
                            accessToken to refreshToken,
                            base
                        )
                    } finally {
                        connection.disconnect()
                    }
                }
                authStore.saveSession(session.third, session.second.first, session.second.second)
                sessionProvider.setIdentity(session.first.first, session.first.second)
                _state.value = LoginState.Success
            } catch (e: Exception) {
                _state.value = LoginState.Error(
                    when (e) {
                        is java.net.UnknownHostException -> "Could not reach the backend. Check the API URL and internet connection."
                        is java.net.SocketTimeoutException -> "Login timed out. Please try again."
                        else -> e.message?.takeIf { it.length < 180 } ?: "Login failed. Please check your details and try again."
                    }
                )
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            authStore.clear()
            sessionProvider.clearActiveSession()
            sessionProvider.setIdentity("", "")
            _state.value = LoginState.Idle
        }
    }

    sealed class LoginState {
        data object Idle : LoginState()
        data object Loading : LoginState()
        data object Success : LoginState()
        data class Error(val message: String) : LoginState()
    }
}
