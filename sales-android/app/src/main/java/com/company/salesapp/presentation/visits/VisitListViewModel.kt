package com.company.salesapp.presentation.visits

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.company.salesapp.data.local.dao.CustomerVisitDao
import com.company.salesapp.data.local.entity.CustomerVisitEntity
import com.company.salesapp.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class VisitListViewModel @Inject constructor(
    private val visitDao: CustomerVisitDao,
    private val authRepository: AuthRepository
) : ViewModel() {
    private val _visits = MutableStateFlow<List<CustomerVisitEntity>>(emptyList())
    val visits: StateFlow<List<CustomerVisitEntity>> = _visits.asStateFlow()
    init {
        viewModelScope.launch {
            authRepository.userId.filterNotNull().flatMapLatest { userId ->
                visitDao.getByCustomer("all")
            }.collect { _visits.value = it }
        }
    }
}
