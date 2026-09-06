# Dependencies — non-obvious pins

## file_picker: pinned to exact `10.3.8` (not `^10.3.8`, not `11.x`)

- **11.0.0+**: `android/build.gradle` skips applying the Kotlin Gradle Plugin when AGP ≥ 9, assuming the app has AGP 9's built-in Kotlin support enabled (`android.builtInKotlin=true`). This app keeps built-in Kotlin off (see `android/gradle.properties`) because `app_links`'s own `build.gradle.kts` has an AGP-version mismatch bug under built-in Kotlin. Result: 11.x's Kotlin sources never compile → release build fails with `cannot find symbol: class FilePickerPlugin`.
- **10.3.9 / 10.3.10**: separate Android build regression — see [flutter_file_picker#1960](https://github.com/miguelpruivo/flutter_file_picker/issues/1960).
- **10.3.8**: last known-good release. Unconditionally applies `org.jetbrains.kotlin.android`, matching this project's classic (non-built-in) Kotlin toolchain.
- Also note the Dart API differs from 11.x: use `FilePicker.platform.pickFiles(...)`, not the 11.x static `FilePicker.pickFiles(...)`.

Revisit this pin if `app_links` ships a build.gradle.kts fix for the AGP-version mismatch, or if `file_picker` fixes its AGP-9 detection to respect `android.builtInKotlin` instead of just the AGP major version — either would let the project move to built-in Kotlin cleanly and unpin both.

## url_launcher (`^6.3.1`)

Already declared in `pubspec.yaml` from an earlier scaffold but had zero real usages until the 2026-08-23 mobile-parity pass. First used in `features/training/widgets/exercise_video.dart` to open a YouTube video externally when the in-app iframe player reports a playback error (owner-restricted embedding, region locks). Standard maintained plugin, no known issues — noting the pin only because it went from unused to load-bearing.
