package com.retail.pos.session

import javax.inject.Inject
import javax.inject.Singleton

/** Holds the current access token in memory only; a fresh login is required after app restart. */
@Singleton
class PosAuthSession @Inject constructor() {
    @Volatile var accessToken: String? = null
        private set

    fun setToken(token: String) { accessToken = token }
    fun clear() { accessToken = null }
}
