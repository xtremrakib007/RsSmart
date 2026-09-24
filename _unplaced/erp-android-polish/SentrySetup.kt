import io.sentry.android.core.SentryAndroid

class ERPApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        SentryAndroid.init(this) { options ->
            options.dsn = BuildConfig.SENTRY_DSN
            options.environment = BuildConfig.BUILD_TYPE
            options.release = "${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})"
            options.tracesSampleRate = 1.0
            options.profilesSampleRate = 1.0
        }
    }
}
