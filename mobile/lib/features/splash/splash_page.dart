import 'package:flutter/material.dart';

/// Shown while the auth controller resolves the session (AuthUnknown). The
/// router redirects away as soon as the state settles.
class SplashPage extends StatelessWidget {
  const SplashPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
