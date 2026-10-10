package com.retail.pos.ui.session

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.retail.pos.viewmodel.LoginViewModel
import com.retail.shared.BuildConfig

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    viewModel: LoginViewModel = hiltViewModel()
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var tenantId by remember { mutableStateOf("") }
    val state by viewModel.state.collectAsState()
    val serverConfigured = BuildConfig.API_BASE_URL.isNotBlank() &&
        !BuildConfig.API_BASE_URL.contains("example.com", ignoreCase = true)

    LaunchedEffect(state) {
        if (state is LoginViewModel.LoginState.Success) {
            viewModel.resetState()
            onLoginSuccess()
        }
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("RsSmart POS") }) }
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp),
            verticalArrangement = Arrangement.Center
        ) {
            Text("Staff sign in", style = MaterialTheme.typography.headlineMedium)
            Spacer(Modifier.height(8.dp))
            Text(
                "Sign in with your RsSmart company account before opening a cashier shift.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(24.dp))
            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                label = { Text("Work email") },
                leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Password") },
                leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = tenantId,
                onValueChange = { tenantId = it },
                label = { Text("Company tenant ID") },
                supportingText = { Text("Use the tenant ID supplied by your RsSmart company administrator.") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            if (!serverConfigured) {
                Spacer(Modifier.height(12.dp))
                Text(
                    "The API server URL has not been configured for this build. Deploy the RsSmart backend and build with the rssmartApiBaseUrl Gradle property before signing in.",
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall
                )
            }
            if (state is LoginViewModel.LoginState.Error) {
                Spacer(Modifier.height(12.dp))
                Text(
                    (state as LoginViewModel.LoginState.Error).message,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
            Spacer(Modifier.height(20.dp))
            Button(
                onClick = { viewModel.login(email, password, tenantId) },
                enabled = serverConfigured && state !is LoginViewModel.LoginState.Loading,
                modifier = Modifier.fillMaxWidth().height(54.dp)
            ) {
                if (state is LoginViewModel.LoginState.Loading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                } else {
                    Text("Sign in")
                }
            }
        }
    }
}
