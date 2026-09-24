package com.company.salesapp.presentation.visits

import android.location.Location
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.company.salesapp.data.local.dao.CustomerVisitDao
import com.company.salesapp.data.local.entity.CustomerVisitEntity
import com.company.salesapp.data.repository.AuthRepository
import com.company.salesapp.gps.LocationTracker
import com.company.salesapp.sync.SyncManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.util.*
import javax.inject.Inject

@HiltViewModel
class VisitRecordViewModel @Inject constructor(
    private val visitDao: CustomerVisitDao,
    private val authRepository: AuthRepository,
    private val syncManager: SyncManager,
    private val locationTracker: LocationTracker
) : ViewModel() {
    private val _isRecording = MutableStateFlow(false)
    val isRecording: StateFlow<Boolean> = _isRecording.asStateFlow()
    private val _location = MutableStateFlow<Location?>(null)
    val location: StateFlow<Location?> = _location.asStateFlow()
    private val _saved = MutableStateFlow(false)
    val saved: StateFlow<Boolean> = _saved.asStateFlow()
    private var visitId: String? = null
    private var customerId: String? = null
    private var checkInAt: Long = 0

    fun startVisit(customerId: String) {
        this.customerId = customerId
        this.visitId = UUID.randomUUID().toString()
        this.checkInAt = System.currentTimeMillis()
        _isRecording.value = true
        viewModelScope.launch {
            locationTracker.getCurrentLocation().collect { loc -> _location.value = loc }
        }
    }
    fun completeVisit(notes: String) {
        viewModelScope.launch {
            val tenantId = authRepository.tenantId.first() ?: return@launch
            val userId = authRepository.userId.first() ?: return@launch
            val loc = _location.value
            val visit = CustomerVisitEntity(id = visitId!!, tenantId = tenantId, customerId = customerId!!, userId = userId, checkInAt = checkInAt, checkOutAt = System.currentTimeMillis(), latitude = loc?.latitude, longitude = loc?.longitude, notes = notes)
            visitDao.insert(visit)
            syncManager.queueEvent("customer_visit", visitId!!, "CREATE", mapOf("id" to visitId, "customerId" to customerId, "userId" to userId, "checkInAt" to checkInAt, "checkOutAt" to visit.checkOutAt, "latitude" to loc?.latitude, "longitude" to loc?.longitude, "notes" to notes, "tenantId" to tenantId))
            _isRecording.value = false
            _saved.value = true
        }
    }
}
