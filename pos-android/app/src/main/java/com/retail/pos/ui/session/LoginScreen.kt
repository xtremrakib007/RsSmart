package com.retail.pos.ui.session

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Business
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.retail.pos.viewmodel.LoginViewModel

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    viewModel: LoginViewModel = hiltViewModel()
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var tenantId by remember { mutableStateOf("") }
    val state by viewModel.state.collectAsState()

    LaunchedEffect(state.isLoggedIn) {
        if (state.isLoggedIn) onLoginSuccess()
    }

    Scaffold { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("RsSmart POS", style = MaterialTheme.typography.headlineLarge, color = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.height(8.dp))
            Text("Sign in with your company account", style = MaterialTheme.typography.bodyLarge)
            Spacer(Modifier.height(24.dp))
            OutlinedTextField(
                value = tenantId, onValueChange = { tenantId = it },
                label = { Text("Company Tenant ID") }, leadingIcon = { Icon(Icons.Default.Business, null) },
                modifier = Modifier.fillMaxWidth(), singleLine = true
            )
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = email, onValueChange = { email = it },
                label = { Text("Work email") }, leadingIcon = { Icon(Icons.Default.Email, null) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                modifier = Modifier.fillMaxWidth(), singleLine = true
            )
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = password, onValueChange = { password = it },
                label = { Text("Password") }, leadingIcon = { Icon(Icons.Default.Lock, null) },
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                modifier = Modifier.fillMaxWidth(), singleLine = true
            )
            if (state.error != null) {
                Spacer(Modifier.height(12.dp))
                Text(state.error!!, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
            }
            Spacer(Modifier.height(20.dp))
            Button(
                onClick = { viewModel.login(email, password, tenantId) },
                enabled = !state.isLoading && email.isNotBlank() && password.isNotBlank() && tenantId.isNotBlank(),
                modifier = Modifier.fillMaxWidth().height(52.dp)
            ) {
                if (state.isLoading) CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                else Text("Sign in")
            }
            Spacer(Modifier.height(16.dp))
            Text(
                "Use an account created by your RsSmart company administrator. No demo credentials are built into this app.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
