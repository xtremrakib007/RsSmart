package com.company.salesapp.presentation.orders

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.company.salesapp.data.local.dao.OrderDao
import com.company.salesapp.data.local.entity.OrderEntity
import com.company.salesapp.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class OrderListViewModel @Inject constructor(
    private val orderDao: OrderDao,
    private val authRepository: AuthRepository
) : ViewModel() {
    private val _orders = MutableStateFlow<List<OrderEntity>>(emptyList())
    val orders: StateFlow<List<OrderEntity>> = _orders.asStateFlow()
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    init {
        viewModelScope.launch {
            authRepository.tenantId.filterNotNull().flatMapLatest { tenantId ->
                orderDao.getAll(tenantId)
            }.collect { _orders.value = it }
        }
    }
}
