package com.company.salesapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.navigation.compose.rememberNavController
import com.company.salesapp.data.repository.AuthRepository
import com.company.salesapp.presentation.navigation.SalesNavGraph
import com.company.salesapp.presentation.theme.SalesAppTheme
import com.company.salesapp.push.FcmService
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.first
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var authRepository: AuthRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Route to jump to when this Activity was launched by tapping a
        // push notification (see FcmService.showNotification).
        val deepLinkRoute = intent?.getStringExtra(FcmService.EXTRA_DEEP_LINK_ROUTE)

        setContent {
            SalesAppTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    val navController = rememberNavController()
                    SalesNavGraph(navController = navController)

                    if (deepLinkRoute != null) {
                        LaunchedEffect(deepLinkRoute) {
                            // Wait until the user is actually authenticated
                            // before navigating anywhere — otherwise a
                            // notification tapped while logged out would
                            // try to open a protected screen with no
                            // session. LoginScreen's own effect handles the
                            // normal Login -> Dashboard redirect; this just
                            // follows it to the deep-link target instead.
                            authRepository.isLoggedIn.filter { it }.first()
                            navController.navigate(deepLinkRoute)
                        }
                    }
                }
            }
        }
    }
}
