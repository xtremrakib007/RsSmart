package com.company.salesapp.presentation.sync

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.company.salesapp.data.local.dao.SyncEventDao
import com.company.salesapp.sync.SyncManager
import com.company.salesapp.sync.SyncResult
import com.company.salesapp.util.NetworkConnectivityObserver
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SyncStatusViewModel @Inject constructor(
    private val syncManager: SyncManager,
    private val syncEventDao: SyncEventDao,
    private val networkObserver: NetworkConnectivityObserver
) : ViewModel() {
    val pendingCount: StateFlow<Int> = syncEventDao.getPendingCountFlow().stateIn(viewModelScope, SharingStarted.WhileSubscribed(), 0)
    val isOnline: StateFlow<Boolean> = networkObserver.isOnline.stateIn(viewModelScope, SharingStarted.WhileSubscribed(), true)
    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()
    private val _lastResult = MutableStateFlow<SyncResult?>(null)
    val lastResult: StateFlow<SyncResult?> = _lastResult.asStateFlow()
    fun syncNow() {
        viewModelScope.launch {
            _isSyncing.value = true
            val result = syncManager.sync()
            _lastResult.value = result
            _isSyncing.value = false
        }
    }
}
