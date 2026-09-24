package com.company.salesapp.presentation.customers

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.company.salesapp.data.local.entity.CustomerEntity
import com.company.salesapp.data.repository.AuthRepository
import com.company.salesapp.data.repository.CustomerRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class CustomerListViewModel @Inject constructor(
    private val customerRepository: CustomerRepository,
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _customers = MutableStateFlow<List<CustomerEntity>>(emptyList())
    val customers: StateFlow<List<CustomerEntity>> = _customers.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private var allCustomers = emptyList<CustomerEntity>()

    init {
        viewModelScope.launch {
            authRepository.tenantId.filterNotNull().flatMapLatest { tenantId ->
                customerRepository.getCustomers(tenantId)
            }.collect {
                allCustomers = it
                _customers.value = it
            }
        }
    }

    fun search(query: String) {
        _customers.value = if (query.isBlank()) {
            allCustomers
        } else {
            allCustomers.filter { 
                it.name.contains(query, ignoreCase = true) || 
                it.phone?.contains(query) == true ||
                it.email?.contains(query, ignoreCase = true) == true
            }
        }
    }
}
