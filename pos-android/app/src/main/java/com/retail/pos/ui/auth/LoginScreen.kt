package com.retail.pos.ui.auth

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Mail
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.retail.pos.BuildConfig
import com.retail.pos.viewmodel.LoginViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(onLoginSuccess: () -> Unit, viewModel: LoginViewModel = hiltViewModel()) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var tenantId by remember { mutableStateOf("") }
    val state by viewModel.state.collectAsState()
    val isAuthenticated by viewModel.isAuthenticated.collectAsState()

    LaunchedEffect(isAuthenticated, state.success) {
        if (isAuthenticated || state.success) onLoginSuccess()
    }

    Scaffold { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text("RsSmart POS", style = MaterialTheme.typography.headlineLarge)
            Spacer(Modifier.height(8.dp))
            Text("Sign in with your company cashier account.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(28.dp))
            OutlinedTextField(
                value = email, onValueChange = { email = it },
                label = { Text("Company email") },
                leadingIcon = { Icon(Icons.Default.Mail, contentDescription = null) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
                modifier = Modifier.fillMaxWidth(), singleLine = true
            )
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = password, onValueChange = { password = it },
                label = { Text("Password") },
                leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Next),
                modifier = Modifier.fillMaxWidth(), singleLine = true
            )
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = tenantId, onValueChange = { tenantId = it },
                label = { Text("Tenant ID") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text, imeAction = ImeAction.Done),
                modifier = Modifier.fillMaxWidth(), singleLine = true
            )
            Spacer(Modifier.height(8.dp))
            Text("Backend: ${BuildConfig.API_BASE_URL}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (state.error != null) {
                Spacer(Modifier.height(8.dp))
                Text(state.error!!, color = MaterialTheme.colorScheme.error)
            }
            Spacer(Modifier.height(20.dp))
            Button(
                onClick = { viewModel.login(email, password, tenantId) },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                enabled = !state.isLoading && email.isNotBlank() && password.isNotBlank() && tenantId.isNotBlank()
            ) {
                if (state.isLoading) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                else Text("Sign in")
            }
            Spacer(Modifier.height(12.dp))
            Text(
                "No demo credentials are built in. Ask your company administrator to create your user account.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
