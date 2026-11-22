package com.company.salesapp.presentation.field

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.company.salesapp.data.remote.dto.TeamAttendanceDto
import com.company.salesapp.data.repository.SalesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

data class TeamUiState(
    val loading: Boolean = true,
    val date: LocalDate = LocalDate.now(),
    val data: TeamAttendanceDto? = null,
    val error: String? = null
)

@HiltViewModel
class TeamAttendanceViewModel @Inject constructor(private val sales: SalesRepository) : ViewModel() {
    private val _state = MutableStateFlow(TeamUiState())
    val state: StateFlow<TeamUiState> = _state.asStateFlow()

    init { refresh() }

    fun shiftDay(days: Long) {
        val next = _state.value.date.plusDays(days)
        if (next.isAfter(LocalDate.now())) return
        _state.update { it.copy(date = next) }
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            sales.teamAttendance(_state.value.date.toString())
                .onSuccess { d -> _state.update { it.copy(loading = false, data = d) } }
                .onFailure { e -> _state.update { it.copy(loading = false, error = e.message) } }
        }
    }
}
