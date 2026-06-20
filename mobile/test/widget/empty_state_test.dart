import 'package:fitforce_x/core/theme/app_theme.dart';
import 'package:fitforce_x/core/widgets/empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('EmptyState renders title and hint', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: const Scaffold(
          body: EmptyState(
            icon: Icons.home_outlined,
            title: 'Coming soon',
            hint: 'On its way.',
          ),
        ),
      ),
    );

    expect(find.text('Coming soon'), findsOneWidget);
    expect(find.text('On its way.'), findsOneWidget);
    expect(find.byIcon(Icons.home_outlined), findsOneWidget);
  });
}
