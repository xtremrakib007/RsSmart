package com.company.salesapp.presentation.customers

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.company.salesapp.data.local.dao.CustomerDao
import com.company.salesapp.data.local.dao.CustomerVisitDao
import com.company.salesapp.data.local.entity.CustomerEntity
import com.company.salesapp.data.local.entity.CustomerVisitEntity
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class CustomerDetailViewModel @Inject constructor(
    private val customerDao: CustomerDao,
    private val visitDao: CustomerVisitDao
) : ViewModel() {

    private val _customer = MutableStateFlow<CustomerEntity?>(null)
    val customer: StateFlow<CustomerEntity?> = _customer.asStateFlow()

    private val _visits = MutableStateFlow<List<CustomerVisitEntity>>(emptyList())
    val visits: StateFlow<List<CustomerVisitEntity>> = _visits.asStateFlow()

    fun loadCustomer(customerId: String) {
        viewModelScope.launch {
            _customer.value = customerDao.getById(customerId)
            visitDao.getByCustomer(customerId).collect {
                _visits.value = it
            }
        }
    }
}
