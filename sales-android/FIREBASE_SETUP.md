# Firebase Cloud Messaging setup

This app requires a real `app/google-services.json` to build — the
`com.google.gms.google-services` plugin (applied in `app/build.gradle.kts`)
fails the build with `File google-services.json is missing` if it's absent.

## Steps

1. Go to the [Firebase console](https://console.firebase.google.com).
2. Create a project (or use an existing one) and add an Android app with
   package name `com.company.salesapp`.
3. Enable Cloud Messaging for the project.
4. Download the generated `google-services.json`.
5. Place it at `app/google-services.json` (see `app/google-services.json.example`
   for the expected structure).

`app/google-services.json` is in `.gitignore` — it contains identifiers tied
to your specific Firebase project and should not be committed.

## Important: must match the backend

The backend's `FIREBASE_SERVICE_ACCOUNT` env var (see
`backend/.env.example`) must come from the **same** Firebase project as
this file. The backend sends push notifications via a service account
(server-side credential); this app receives them via `google-services.json`
(client-side config). If they point at different projects, push
notifications will silently fail — no error, messages just never arrive.
