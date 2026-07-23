Review all staged and unstaged changes, understand the intent behind every modification, and group related changes into logical commits where appropriate.

Before committing, produce a release summary that includes:
1. A categorized list of all implemented features, improvements, fixes, refactors, and other notable changes.
2. A list of the features or fixes that should have a "New Feature" / "What's New" tooltip or in-app announcement because users are unlikely to discover them on their own. For each item, briefly explain why it needs a tooltip and suggest where in the UI it should appear.

After the review, generate clear, conventional commit messages (feat:, fix:, refactor:, style:, perf:, chore:) for each logical commit, then commit all changes with concise, descriptive messages that accurately summarize the work.


> database

export DATABASE_URL=$(grep -m1 '^DATABASE_URL=' /home/fitforce/app/server/.env | cut -d= -f2-)
echo "DATABASE_URL is: $DATABASE_URL"

