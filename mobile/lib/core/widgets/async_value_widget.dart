import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_exception.dart';
import 'error_view.dart';
import 'loading_skeleton.dart';

/// The one place we map `AsyncValue<T>` → loading / error / data UI, so every
/// screen handles the four states the same way (the portal's load pattern).
class AsyncValueWidget<T> extends StatelessWidget {
  const AsyncValueWidget({
    super.key,
    required this.value,
    required this.data,
    this.loading,
    this.onRetry,
  });

  final AsyncValue<T> value;
  final Widget Function(T data) data;
  final Widget? loading;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return value.when(
      skipLoadingOnRefresh: false,
      data: data,
      loading: () => loading ?? const SkeletonList(),
      error: (error, _) => ErrorView(
        message: error is ApiException ? error.message : null,
        onRetry: onRetry,
      ),
    );
  }
}
