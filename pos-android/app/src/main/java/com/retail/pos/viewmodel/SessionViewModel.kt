package com.retail.pos.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.retail.pos.session.PosSessionProvider
import com.retail.shared.data.local.dao.SessionDao
import com.retail.shared.data.local.entity.PosSession
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class SessionViewModel @Inject constructor(
    private val sessionDao: SessionDao,
    private val sessionProvider: PosSessionProvider
) : ViewModel() {

    private val deviceId = sessionProvider.deviceId

    val openSession: StateFlow<PosSession?> = sessionDao.getOpenSession(deviceId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    private val _sessionAction = MutableStateFlow<SessionAction>(SessionAction.Idle)
    val sessionAction: StateFlow<SessionAction> = _sessionAction.asStateFlow()

    fun openSession(openingCash: Double, notes: String?) {
        viewModelScope.launch {
            _sessionAction.value = SessionAction.Processing
            try {
                val tenantId = sessionProvider.tenantId.first()
                val userId = sessionProvider.userId.first()
                if (tenantId.isBlank() || userId.isBlank()) {
                    _sessionAction.value = SessionAction.Error("Sign in with your company account before opening a shift.")
                    return@launch
                }
                val existing = sessionDao.getOpenSessionOnce(deviceId)
                if (existing != null) {
                    sessionProvider.setActiveSession(existing.id)
                    _sessionAction.value = SessionAction.Error("Session already open")
                    return@launch
                }

                val session = PosSession(
                    id = UUID.randomUUID().toString(),
                    tenantId = tenantId,
                    userId = userId,
                    deviceId = deviceId,
                    openingCash = openingCash,
                    openedAt = System.currentTimeMillis(),
                    notes = notes,
                    syncStatus = "PENDING"
                )
                sessionDao.insert(session)
                sessionProvider.setActiveSession(session.id)
                _sessionAction.value = SessionAction.Opened(session.id)
            } catch (e: Exception) {
                _sessionAction.value = SessionAction.Error(e.message ?: "Failed to open session")
            }
        }
    }

    fun closeSession(closingCash: Double, notes: String?) {
        viewModelScope.launch {
            _sessionAction.value = SessionAction.Processing
            try {
                val session = sessionDao.getOpenSessionOnce(deviceId)
                if (session == null) {
                    _sessionAction.value = SessionAction.Error("No open session")
                    return@launch
                }

                val expected = session.openingCash + session.totalSales - session.totalRefunds
                val diff = closingCash - expected

                val updated = session.copy(
                    closingCash = closingCash,
                    expectedCash = expected,
                    cashDifference = diff,
                    closedAt = System.currentTimeMillis(),
                    status = "CLOSED",
                    notes = notes ?: session.notes,
                    syncStatus = "PENDING"
                )
                sessionDao.update(updated)
                sessionProvider.clearActiveSession()
                _sessionAction.value = SessionAction.Closed
            } catch (e: Exception) {
                _sessionAction.value = SessionAction.Error(e.message ?: "Failed to close session")
            }
        }
    }

    fun resetAction() {
        _sessionAction.value = SessionAction.Idle
    }

    sealed class SessionAction {
        object Idle : SessionAction()
        object Processing : SessionAction()
        data class Opened(val sessionId: String) : SessionAction()
        object Closed : SessionAction()
        data class Error(val message: String) : SessionAction()
    }
}
