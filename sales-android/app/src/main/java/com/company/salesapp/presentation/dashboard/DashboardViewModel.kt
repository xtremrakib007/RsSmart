package com.company.salesapp.presentation.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.company.salesapp.data.local.dao.OrderDao
import com.company.salesapp.data.local.dao.CustomerVisitDao
import com.company.salesapp.data.local.dao.SyncEventDao
import com.company.salesapp.data.repository.AuthRepository
import com.company.salesapp.data.repository.PushTokenRepository
import com.company.salesapp.data.repository.SalesRepository
import com.company.salesapp.util.NetworkConnectivityObserver
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val pushTokenRepository: PushTokenRepository,
    private val orderDao: OrderDao,
    private val visitDao: CustomerVisitDao,
    private val syncEventDao: SyncEventDao,
    private val networkObserver: NetworkConnectivityObserver,
    private val salesRepository: SalesRepository
) : ViewModel() {

    private val _state = MutableStateFlow(DashboardState())
    val state: StateFlow<DashboardState> = _state.asStateFlow()

    val pendingSyncCount: StateFlow<Int> = syncEventDao.getPendingCountFlow()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(), 0)

    val isOnline: StateFlow<Boolean> = networkObserver.isOnline
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(), true)

    init {
        refreshServerDashboard()
        viewModelScope.launch {
            authRepository.userId.filterNotNull().flatMapLatest { userId ->
                orderDao.getDrafts(userId)
            }.collect { orders ->
                _state.update { it.copy(todayOrders = orders.size) }
            }
        }
    }

    private fun refreshServerDashboard() {
        viewModelScope.launch {
            salesRepository.dashboard().onSuccess { d ->
                _state.update { it.copy(todayOrders = d.todayOrders, todayRevenue = d.todayRevenue, todayVisits = d.todayVisits, todayCollections = d.todayCollections) }
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            pushTokenRepository.unregister()
            authRepository.logout()
        }
    }
}

data class DashboardState(
    val todayOrders: Int = 0,
    val todayRevenue: Double = 0.0,
    val todayVisits: Int = 0,
    val todayCollections: Double = 0.0,
    val isLoading: Boolean = false
)
