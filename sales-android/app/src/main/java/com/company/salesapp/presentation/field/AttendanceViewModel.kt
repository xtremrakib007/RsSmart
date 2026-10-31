package com.company.salesapp.presentation.field

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.company.salesapp.data.repository.SalesRepository
import com.company.salesapp.gps.LocationTracker
import com.company.salesapp.util.fileToJpegDataUrl
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.io.File
import javax.inject.Inject

data class AttendanceUiState(
    val loading: Boolean = true,
    val status: String = "NOT_IN", // NOT_IN, IN, OUT
    val minutesWorked: Int = 0,
    val checkInAt: String? = null,
    val checkOutAt: String? = null,
    val busy: Boolean = false,
    val message: String? = null,
    val error: String? = null
)

@HiltViewModel
class AttendanceViewModel @Inject constructor(
    private val sales: SalesRepository,
    private val locationTracker: LocationTracker
) : ViewModel() {
    private val _state = MutableStateFlow(AttendanceUiState())
    val state: StateFlow<AttendanceUiState> = _state.asStateFlow()

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            _state.update { it.copy(loading = true) }
            sales.today()
                .onSuccess { t ->
                    _state.update {
                        it.copy(loading = false, status = t.attendance.status, minutesWorked = t.attendance.minutesWorked,
                            checkInAt = t.attendance.checkInAt, checkOutAt = t.attendance.checkOutAt, error = null)
                    }
                }
                .onFailure { e -> _state.update { it.copy(loading = false, error = e.message) } }
        }
    }

    /** Check in (or out, when already in) with the selfie [photo] and the current location. */
    fun submit(photo: File?) {
        val checkingIn = _state.value.status == "NOT_IN"
        viewModelScope.launch {
            _state.update { it.copy(busy = true, error = null, message = null) }
            val loc = withTimeoutOrNull(10_000) { runCatching { locationTracker.getCurrentLocation().first() }.getOrNull() }
                ?: locationTracker.getLastLocation()
            val dataUrl = photo?.let { f -> withContext(Dispatchers.Default) { runCatching { fileToJpegDataUrl(f) }.getOrNull() } }
            val result = if (checkingIn) sales.checkIn(loc?.latitude, loc?.longitude, dataUrl)
                         else sales.checkOut(loc?.latitude, loc?.longitude, dataUrl)
            result
                .onSuccess {
                    _state.update { it.copy(busy = false, message = if (checkingIn) "Checked in ✓" else "Checked out ✓") }
                    refresh()
                }
                .onFailure { e -> _state.update { it.copy(busy = false, error = e.message ?: "Could not save attendance") } }
        }
    }
}
