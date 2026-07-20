Review all staged and unstaged changes, understand the intent behind each modification, group related changes logically if needed, and generate clear, conventional commit messages (feat:, fix:, refactor:, style:, perf:, chore:). Then commit all changes with concise, descriptive messages that accurately summarize the work.


> database

export DATABASE_URL=$(grep -m1 '^DATABASE_URL=' /home/fitforce/app/server/.env | cut -d= -f2-)
echo "DATABASE_URL is: $DATABASE_URL"
