/// Picks the Arabic value when the locale is Arabic and a non-empty `_ar`
/// translation exists, otherwise the base/English value. Port of the web
/// `utils/localization.js` `getLocalizedField`.
String localizedField({
  required String base,
  String? arabic,
  required String localeCode,
}) {
  if (localeCode == 'ar' && arabic != null && arabic.trim().isNotEmpty) {
    return arabic;
  }
  return base;
}
