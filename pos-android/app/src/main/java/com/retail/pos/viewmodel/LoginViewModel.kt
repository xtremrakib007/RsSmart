package com.retail.pos.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.retail.pos.data.remote.PosAuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class LoginViewModel @Inject constructor(private val repository: PosAuthRepository) : ViewModel() {
    data class State(val isLoading: Boolean = false, val isLoggedIn: Boolean = false, val error: String? = null)
    private val _state = MutableStateFlow(State())
    val state = _state.asStateFlow()

    init {
        viewModelScope.launch {
            repository.isLoggedIn.collect { loggedIn ->
                _state.value = _state.value.copy(isLoggedIn = loggedIn)
            }
        }
    }

    fun login(email: String, password: String, tenantId: String) {
        if (email.isBlank() || password.isBlank() || tenantId.isBlank()) {
            _state.value = _state.value.copy(error = "Enter your email, password, and company tenant ID.")
            return
        }
        viewModelScope.launch {
            _state.value = State(isLoading = true)
            repository.login(email, password, tenantId).onSuccess {
                _state.value = State(isLoggedIn = true)
            }.onFailure { error ->
                _state.value = State(error = error.message ?: "Sign-in failed.")
            }
        }
    }
}
