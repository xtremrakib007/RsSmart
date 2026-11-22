package com.company.salesapp.presentation.settings

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.company.salesapp.data.repository.DEFAULT_MENU
import com.company.salesapp.presentation.components.SalesTopBar

private val FEATURE_LABELS = mapOf(
    "attendance" to "Attendance", "today" to "Today's Route", "nearby" to "Nearby", "team" to "Team (managers)",
    "customers" to "Customers", "orders" to "Orders", "visits" to "Visits", "collections" to "Collections",
    "expenses" to "Expenses", "sync" to "Sync"
)

/** Admin: settings every phone loads from the server, so no new APK is needed to change them. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppSettingsScreen(navController: NavController, viewModel: AppSettingsViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsState()
    val f = state.form
    Scaffold(topBar = { SalesTopBar(title = "App settings", onBack = { navController.popBackStack() }) }) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth())

            Section("Menu tiles")
            DEFAULT_MENU.forEach { key ->
                SwitchRow(FEATURE_LABELS[key] ?: key, f.features[key] ?: true) { on ->
                    viewModel.edit { it.copy(features = it.features + (key to on)) }
                }
            }

            Section("Attendance")
            SwitchRow("Selfie required", f.selfieRequired) { on -> viewModel.edit { it.copy(selfieRequired = on) } }
            SwitchRow("GPS location required", f.gpsRequired) { on -> viewModel.edit { it.copy(gpsRequired = on) } }

            Section("General")
            Field("Currency", f.currency) { v -> viewModel.edit { it.copy(currency = v) } }
            Field("Support phone", f.supportPhone, KeyboardType.Phone) { v -> viewModel.edit { it.copy(supportPhone = v) } }
            Field("Nearby list size", f.nearbyLimit, KeyboardType.Number) { v -> viewModel.edit { it.copy(nearbyLimit = v) } }

            Section("Notice on the dashboard")
            OutlinedTextField(
                value = f.noticeText, onValueChange = { v -> viewModel.edit { it.copy(noticeText = v) } },
                label = { Text("Message (empty = none)") }, modifier = Modifier.fillMaxWidth(), minLines = 2
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("info" to "Info", "warning" to "Warning", "urgent" to "Urgent").forEach { (level, label) ->
                    FilterChip(selected = f.noticeLevel == level, onClick = { viewModel.edit { it.copy(noticeLevel = level) } }, label = { Text(label) })
                }
            }

            Section("App update")
            Field("APK link (https://…)", f.apkUrl, KeyboardType.Uri) { v -> viewModel.edit { it.copy(apkUrl = v) } }
            Field("Latest version code", f.latestVersionCode, KeyboardType.Number) { v -> viewModel.edit { it.copy(latestVersionCode = v) } }
            Field("Oldest allowed version code", f.minVersionCode, KeyboardType.Number) { v -> viewModel.edit { it.copy(minVersionCode = v) } }
            OutlinedTextField(
                value = f.updateNotes, onValueChange = { v -> viewModel.edit { it.copy(updateNotes = v) } },
                label = { Text("What's new") }, modifier = Modifier.fillMaxWidth(), minLines = 2
            )

            state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            state.message?.let { Text(it, color = MaterialTheme.colorScheme.primary) }
            Button(onClick = { viewModel.save() }, enabled = !state.saving && !state.loading, modifier = Modifier.fillMaxWidth()) {
                Text(if (state.saving) "Saving…" else "Save")
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun Section(title: String) {
    Text(title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 12.dp))
}

@Composable
private fun SwitchRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, modifier = Modifier.weight(1f))
        Switch(checked = checked, onCheckedChange = onChange)
    }
}

@Composable
private fun Field(label: String, value: String, type: KeyboardType = KeyboardType.Text, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value, onValueChange = onChange, label = { Text(label) }, singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = type), modifier = Modifier.fillMaxWidth()
    )
}
