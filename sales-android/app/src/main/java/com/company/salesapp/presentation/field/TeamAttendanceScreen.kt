package com.company.salesapp.presentation.field

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import coil.compose.AsyncImage
import com.company.salesapp.data.remote.dto.TeamMemberDto
import com.company.salesapp.presentation.components.ErrorMessage
import com.company.salesapp.presentation.components.SalesTopBar
import com.company.salesapp.presentation.theme.InfoBlue
import com.company.salesapp.presentation.theme.SuccessGreen
import com.company.salesapp.presentation.theme.WarningOrange
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/** Managers: who is in, out or not yet in today, with the check-in selfie and place. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TeamAttendanceScreen(navController: NavController, viewModel: TeamAttendanceViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsState()
    Scaffold(topBar = {
        SalesTopBar(title = "Team attendance", onBack = { navController.popBackStack() }, actions = {
            IconButton(onClick = { viewModel.refresh() }) { Icon(Icons.Default.Refresh, "Refresh") }
        })
    }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { viewModel.shiftDay(-1) }) { Icon(Icons.Default.ChevronLeft, "Previous day") }
                Text(
                    if (state.date == LocalDate.now()) "Today" else state.date.format(DateTimeFormatter.ofPattern("EEE, d MMM yyyy")),
                    style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f)
                )
                IconButton(onClick = { viewModel.shiftDay(1) }, enabled = state.date.isBefore(LocalDate.now())) { Icon(Icons.Default.ChevronRight, "Next day") }
            }
            state.data?.summary?.let { s ->
                Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Pill("In", s.`in`, SuccessGreen, Modifier.weight(1f))
                    Pill("Out", s.out, InfoBlue, Modifier.weight(1f))
                    Pill("Not in", s.notIn, WarningOrange, Modifier.weight(1f))
                }
            }
            when {
                state.loading && state.data == null -> CircularProgressIndicator(Modifier.padding(24.dp))
                state.error != null -> ErrorMessage(state.error!!) { viewModel.refresh() }
                else -> LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    // Not-in first: those are the ones to call.
                    val order = mapOf("NOT_IN" to 0, "IN" to 1, "OUT" to 2)
                    items(state.data?.team.orEmpty().sortedBy { order[it.status] ?: 3 }, key = { it.userId }) { m -> MemberRow(m) }
                }
            }
        }
    }
}

@Composable
private fun Pill(label: String, n: Int, color: androidx.compose.ui.graphics.Color, modifier: Modifier) {
    Card(modifier, colors = CardDefaults.cardColors(containerColor = color.copy(alpha = 0.12f))) {
        Column(Modifier.padding(10.dp).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("$n", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = color)
            Text(label, style = MaterialTheme.typography.labelSmall, color = color)
        }
    }
}

@Composable
private fun MemberRow(m: TeamMemberDto) {
    val context = LocalContext.current
    Card(Modifier.fillMaxWidth()) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            if (m.checkInPhotoUrl != null) {
                AsyncImage(model = m.checkInPhotoUrl, contentDescription = "Check-in selfie", contentScale = ContentScale.Crop,
                    modifier = Modifier.size(52.dp).clip(CircleShape))
            } else {
                Surface(Modifier.size(52.dp), shape = CircleShape, color = MaterialTheme.colorScheme.surfaceVariant) {
                    Box(contentAlignment = Alignment.Center) { Text(m.name.take(1).uppercase(), style = MaterialTheme.typography.titleLarge) }
                }
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(m.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                val line = when (m.status) {
                    "IN" -> "In since ${m.checkInAt?.let { timeOf(it) } ?: "—"} · ${formatMinutes(m.minutesWorked)}"
                    "OUT" -> "${m.checkInAt?.let { timeOf(it) } ?: "—"} – ${m.checkOutAt?.let { timeOf(it) } ?: "—"} · ${formatMinutes(m.minutesWorked)}"
                    else -> "Not checked in"
                }
                Text(line, style = MaterialTheme.typography.bodySmall,
                    color = if (m.status == "NOT_IN") MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (m.checkInLat != null && m.checkInLng != null) {
                IconButton(onClick = { FieldActions.directions(context, m.checkInLat, m.checkInLng, null) }) { Icon(Icons.Default.Place, "Check-in place") }
            }
            if (!m.phone.isNullOrBlank()) {
                IconButton(onClick = { FieldActions.call(context, m.phone) }) { Icon(Icons.Default.Call, "Call") }
            }
        }
    }
}
