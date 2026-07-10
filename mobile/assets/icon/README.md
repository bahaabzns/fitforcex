# App icon source

`app_icon.png` and `app_icon_foreground.png` are rasterized from the canonical
brand mark at `client/public/blue_f_only.svg` (the same artwork used for the
web app's favicon/PWA icons — see the `brand-logo-system` memory / `client/public/mark.svg`
for the established crop box).

- `app_icon.png` — flat icon (iOS, legacy Android, native splash). Modest padding.
- `app_icon_foreground.png` — Android adaptive-icon foreground layer. Generous
  padding so the mark isn't clipped by circle/squircle/rounded-square launcher masks.

Both are transparent PNGs; `flutter_launcher_icons` composites them onto
`adaptive_icon_background`/`background_color_ios` (white) per `pubspec.yaml`.

To regenerate after the source SVG changes, render `blue_f_only.svg` at 1024×1024
with its `viewBox` swapped to a padded crop around `140.5 217.3 660 660` (the
mark's bounding box) — e.g. via `sharp` — then re-run:

```
flutter pub run flutter_launcher_icons
flutter pub run flutter_native_splash:create
```
