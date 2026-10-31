package com.company.salesapp.presentation.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.company.salesapp.data.remote.dto.AppConfigDto
import com.company.salesapp.data.repository.AppConfigRepository
import com.company.salesapp.data.repository.DEFAULT_MENU
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AppSettingsForm(
    val features: Map<String, Boolean> = DEFAULT_MENU.associateWith { true },
    val selfieRequired: Boolean = false,
    val gpsRequired: Boolean = false,
    val nearbyLimit: String = "50",
    val currency: String = "RM",
    val supportPhone: String = "",
    val noticeText: String = "",
    val noticeLevel: String = "info",
    val latestVersionCode: String = "0",
    val minVersionCode: String = "0",
    val apkUrl: String = "",
    val updateNotes: String = ""
) {
    companion object {
        fun from(d: AppConfigDto) = AppSettingsForm(
            features = DEFAULT_MENU.associateWith { d.features?.get(it) ?: true },
            selfieRequired = d.attendance?.selfieRequired ?: false,
            gpsRequired = d.attendance?.gpsRequired ?: false,
            nearbyLimit = (d.nearbyLimit ?: 50).toString(),
            currency = d.currency ?: "RM",
            supportPhone = d.supportPhone.orEmpty(),
            noticeText = d.notice?.text.orEmpty(),
            noticeLevel = d.notice?.level ?: "info",
            latestVersionCode = (d.update?.latestVersionCode ?: 0).toString(),
            minVersionCode = (d.update?.minVersionCode ?: 0).toString(),
            apkUrl = d.update?.apkUrl.orEmpty(),
            updateNotes = d.update?.notes.orEmpty()
        )
    }

    /** The change sent to the server; the server checks every value. */
    fun toPatch(): Map<String, Any?> = mapOf(
        "features" to features,
        "attendance" to mapOf("selfieRequired" to selfieRequired, "gpsRequired" to gpsRequired),
        "nearbyLimit" to (nearbyLimit.toIntOrNull() ?: 50),
        "currency" to currency,
        "supportPhone" to supportPhone,
        "notice" to mapOf("text" to noticeText, "level" to noticeLevel),
        "update" to mapOf(
            "latestVersionCode" to (latestVersionCode.toIntOrNull() ?: 0),
            "minVersionCode" to (minVersionCode.toIntOrNull() ?: 0),
            "apkUrl" to apkUrl,
            "notes" to updateNotes
        )
    )
}

data class AppSettingsUiState(
    val form: AppSettingsForm = AppSettingsForm(),
    val loading: Boolean = true,
    val saving: Boolean = false,
    val message: String? = null,
    val error: String? = null
)

@HiltViewModel
class AppSettingsViewModel @Inject constructor(private val repo: AppConfigRepository) : ViewModel() {
    private val _state = MutableStateFlow(AppSettingsUiState(form = AppSettingsForm.from(repo.config.value.raw)))
    val state: StateFlow<AppSettingsUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            repo.refresh()
                .onSuccess { c -> _state.update { it.copy(loading = false, form = AppSettingsForm.from(c.raw)) } }
                .onFailure { e -> _state.update { it.copy(loading = false, error = e.message) } }
        }
    }

    fun edit(change: (AppSettingsForm) -> AppSettingsForm) = _state.update { it.copy(form = change(it.form), message = null) }

    fun save() {
        viewModelScope.launch {
            _state.update { it.copy(saving = true, error = null, message = null) }
            repo.update(_state.value.form.toPatch())
                .onSuccess { c -> _state.update { it.copy(saving = false, form = AppSettingsForm.from(c.raw), message = "Saved. Phones get it on their next start or refresh.") } }
                .onFailure { e -> _state.update { it.copy(saving = false, error = e.message ?: "Could not save") } }
        }
    }
}
