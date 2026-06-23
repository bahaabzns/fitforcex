import 'package:json_annotation/json_annotation.dart';

/// Numeric DB columns (Prisma `Decimal`/`Numeric`) can arrive as JSON numbers
/// *or* numeric strings. These converters normalise both to Dart doubles so the
/// nutrition math never sees a String — mirroring JS's loose coercion.
class NumToDouble implements JsonConverter<double, dynamic> {
  const NumToDouble();

  @override
  double fromJson(dynamic value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0;
    return 0;
  }

  @override
  dynamic toJson(double value) => value;
}

class NumToDoubleOrNull implements JsonConverter<double?, dynamic> {
  const NumToDoubleOrNull();

  @override
  double? fromJson(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value);
    return null;
  }

  @override
  dynamic toJson(double? value) => value;
}
