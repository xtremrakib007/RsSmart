package com.retail.pos.ui.auth

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.retail.pos.session.PosAuthSession
import com.retail.pos.session.PosSessionProvider
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import javax.inject.Inject

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val sessionProvider: PosSessionProvider,
    private val authSession: PosAuthSession
) : ViewModel() {
    private val _busy = MutableStateFlow(false)
    val busy = _busy.asStateFlow()
    private val _error = MutableStateFlow<String?>(null)
    val error = _error.asStateFlow()
    private val _signedIn = MutableStateFlow(false)
    val signedIn = _signedIn.asStateFlow()

    fun login(apiBaseUrl: String, tenantId: String, email: String, password: String) {
        if (_busy.value) return
        val base = apiBaseUrl.trim().trimEnd('/')
        if (!base.startsWith("https://")) {
            _error.value = "Enter your deployed HTTPS API base URL. HTTP is not accepted."
            return
        }
        if (tenantId.isBlank() || email.isBlank() || password.isBlank()) {
            _error.value = "Company/Tenant ID, email and password are required."
            return
        }
        viewModelScope.launch {
            _busy.value = true
            _error.value = null
            try {
                val result = withContext(Dispatchers.IO) {
                    val connection = (URL("$base/v1/auth/login").openConnection() as HttpURLConnection)
                    try {
                        connection.requestMethod = "POST"
                        connection.connectTimeout = 15000
                        connection.readTimeout = 15000
                        connection.doOutput = true
                        connection.setRequestProperty("Content-Type", "application/json")
                        connection.setRequestProperty("Accept", "application/json")
                        val payload = JSONObject()
                            .put("tenantId", tenantId.trim())
                            .put("email", email.trim())
                            .put("password", password)
                            .toString()
                        connection.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
                        val status = connection.responseCode
                        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
                        val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                        if (status !in 200..299) {
                            val message = runCatching { JSONObject(body).optString("message") }.getOrNull()
                            throw IllegalStateException(message?.takeIf { it.isNotBlank() } ?: "Login failed (HTTP $status). Check credentials and tenant ID.")
                        }
                        val envelope = JSONObject(body)
                        val json = envelope.optJSONObject("data") ?: envelope
                        val user = json.getJSONObject("user")
                        val token = json.getString("accessToken")
                        LoginResult(token, user.getString("tenantId"), user.getString("id"), user.optString("email", email))
                    } finally {
                        connection.disconnect()
                    }
                }
                sessionProvider.setIdentity(result.tenantId, result.userId)
                authSession.setToken(result.accessToken)
                _signedIn.value = true
            } catch (e: Exception) {
                _error.value = when (e) {
                    is java.net.UnknownHostException -> "Cannot reach the API. Check the server URL and internet connection."
                    is java.net.ConnectException -> "API server is unavailable. Deploy and start the backend first."
                    else -> e.message ?: "Unable to sign in."
                }
            } finally {
                _busy.value = false
            }
        }
    }

    fun resetSignedIn() { _signedIn.value = false }
    private data class LoginResult(val accessToken: String, val tenantId: String, val userId: String, val email: String)
}

@Composable
fun LoginScreen(onSignedIn: () -> Unit, viewModel: LoginViewModel = androidx.hilt.navigation.compose.hiltViewModel()) {
    var apiUrl by remember { mutableStateOf("") }
    var tenantId by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val busy by viewModel.busy.collectAsState()
    val error by viewModel.error.collectAsState()
    val signedIn by viewModel.signedIn.collectAsState()

    LaunchedEffect(signedIn) {
        if (signedIn) {
            viewModel.resetSignedIn()
            onSignedIn()
        }
    }

    Scaffold { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(Icons.Default.Lock, contentDescription = null, modifier = Modifier.size(56.dp), tint = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.height(12.dp))
            Text("RsSmart POS", style = MaterialTheme.typography.headlineMedium)
            Text("Sign in with your company account", style = MaterialTheme.typography.bodyMedium)
            Spacer(Modifier.height(20.dp))
            OutlinedTextField(apiUrl, { apiUrl = it }, Modifier.fillMaxWidth(), label = { Text("Backend API base URL (HTTPS)") }, placeholder = { Text("https://your-api.example.com") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri))
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(tenantId, { tenantId = it }, Modifier.fillMaxWidth(), label = { Text("Company / Tenant ID") }, singleLine = true)
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(email, { email = it }, Modifier.fillMaxWidth(), label = { Text("Email") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email))
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(password, { password = it }, Modifier.fillMaxWidth(), label = { Text("Password") }, singleLine = true, visualTransformation = PasswordVisualTransformation())
            if (error != null) {
                Spacer(Modifier.height(8.dp))
                Text(error.orEmpty(), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }
            Spacer(Modifier.height(16.dp))
            Button(
                onClick = { viewModel.login(apiUrl, tenantId, email, password) },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                enabled = !busy
            ) {
                if (busy) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                else Text("Sign in")
            }
            Spacer(Modifier.height(12.dp))
            Text("No default/demo credentials are created. Ask your company administrator for your account, tenant ID and API URL.", style = MaterialTheme.typography.bodySmall)
        }
    }
}
