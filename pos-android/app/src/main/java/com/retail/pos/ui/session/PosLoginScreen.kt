package com.retail.pos.ui.session

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.retail.pos.viewmodel.PosLoginViewModel

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun PosLoginScreen(
    onLoggedIn: () -> Unit,
    viewModel: PosLoginViewModel = hiltViewModel()
) {
    var apiBaseUrl by remember { mutableStateOf(viewModel.savedApiBaseUrl) }
    var tenantId by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val state by viewModel.state.collectAsState()

    LaunchedEffect(Unit) {
        if (viewModel.alreadyLoggedIn) onLoggedIn()
    }
    LaunchedEffect(state) {
        if (state is PosLoginViewModel.LoginState.Success) onLoggedIn()
    }

    Scaffold(topBar = { TopAppBar(title = { Text("RsSmart POS Sign In") }) }) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp),
            verticalArrangement = Arrangement.Center
        ) {
            Text("Sign in with your company account", style = MaterialTheme.typography.headlineSmall)
            Spacer(Modifier.height(8.dp))
            Text("Use the HTTPS API URL supplied by your RsSmart administrator. No demo credentials are built into this app.", style = MaterialTheme.typography.bodyMedium)
            Spacer(Modifier.height(20.dp))
            OutlinedTextField(
                value = apiBaseUrl,
                onValueChange = { apiBaseUrl = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Backend API URL (HTTPS)") },
                placeholder = { Text("https://api.your-company.com") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri)
            )
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(
                value = tenantId,
                onValueChange = { tenantId = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Company tenant ID") },
                singleLine = true
            )
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Email") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
            )
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Password") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
            )
            if (state is PosLoginViewModel.LoginState.Error) {
                Spacer(Modifier.height(10.dp))
                Text((state as PosLoginViewModel.LoginState.Error).message, color = MaterialTheme.colorScheme.error)
            }
            Spacer(Modifier.height(18.dp))
            Button(
                onClick = { viewModel.login(apiBaseUrl, tenantId, email, password) },
                modifier = Modifier.fillMaxWidth(),
                enabled = state !is PosLoginViewModel.LoginState.Loading
            ) {
                if (state is PosLoginViewModel.LoginState.Loading) {
                    CircularProgressIndicator(modifier = Modifier.height(20.dp), strokeWidth = 2.dp)
                } else {
                    Text("Sign In")
                }
            }
        }
    }
}
