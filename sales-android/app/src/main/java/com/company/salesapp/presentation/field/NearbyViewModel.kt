package com.company.salesapp.presentation.field

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.company.salesapp.data.remote.dto.FieldCustomerDto
import com.company.salesapp.data.repository.SalesRepository
import com.company.salesapp.gps.LocationTracker
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import javax.inject.Inject

data class NearbyUiState(
    val loading: Boolean = false,
    val customers: List<FieldCustomerDto> = emptyList(),
    val query: String = "",
    val error: String? = null,
    val located: Boolean = false
)

@HiltViewModel
class NearbyViewModel @Inject constructor(
    private val sales: SalesRepository,
    private val locationTracker: LocationTracker
) : ViewModel() {
    private val _state = MutableStateFlow(NearbyUiState())
    val state: StateFlow<NearbyUiState> = _state.asStateFlow()

    fun setQuery(q: String) = _state.update { it.copy(query = q) }

    /** Gets the current position, then the user's customers nearest first. */
    fun load() {
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            val loc = withTimeoutOrNull(10_000) { runCatching { locationTracker.getCurrentLocation().first() }.getOrNull() }
                ?: locationTracker.getLastLocation()
            if (loc == null) {
                _state.update { it.copy(loading = false, error = "Location is off — turn on GPS and try again") }
                return@launch
            }
            sales.nearby(loc.latitude, loc.longitude)
                .onSuccess { list -> _state.update { it.copy(loading = false, customers = list, located = true) } }
                .onFailure { e -> _state.update { it.copy(loading = false, error = e.message) } }
        }
    }
}
