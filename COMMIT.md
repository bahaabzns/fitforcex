> COMMIT AND PUSH PROMPT

Review all staged and unstaged changes from **this development session only**. Ignore changes that existed before this session or are unrelated to today's work.

Understand the intent behind every modification and group related changes into logical commits where appropriate.

Before making any commits or pushing, produce a release summary that includes:

1. A categorized list of all features, improvements, fixes, refactors, performance optimizations, UI/UX enhancements, and other notable changes completed during this session.

2. A list of onboarding opportunities for **this session's changes only**:
   - Identify new features or workflow/UI changes that users are unlikely to discover on their own.
   - For each item, recommend whether it should use:
     - a tooltip,
     - a feature spotlight,
     - a "What's New" announcement,
     - or no onboarding.
   - Explain why.
   - Suggest the exact UI element where it should appear.
   - Provide concise copy.

3. Generate logical conventional commit messages (feat:, fix:, refactor:, style:, perf:, chore:) for each commit.

### Approval Gate

Stop after generating the release summary, onboarding recommendations, and proposed commit messages.

**Do NOT:**
- create commits,
- implement tooltips/onboarding,
- push,
- or modify any code.

Wait for my explicit approval of:
1. the commit messages, and
2. the onboarding/tooltip plan.

### After Approval

1. Implement the approved tooltips/feature spotlights/What's New announcements.
2. Create the approved logical commits using the approved commit messages.
3. Push the commits to the remote repository.



> PRE DEPLOY REVIEW

Review un committed changes before I deploy. Check for:

1. **Correctness** — logic errors, edge cases, off-by-one bugs, unhandled null/undefined values
2. **Security** — injection risks, exposed secrets/credentials, unsafe input handling, auth/permission gaps
3. **Error handling** — missing try/catch, unhandled promise rejections, silent failures
4. **Performance** — obvious inefficiencies, N+1 queries, unnecessary re-renders/loops
5. **Breaking changes** — anything that could affect existing functionality, API contracts, or downstream consumers
6. **Tests** — are new/changed code paths covered? Do existing tests still make sense?
7. **Code quality** — dead code, leftover debug statements (console.log, print, etc.), unclear naming, missing comments where logic is non-obvious
8. **Consistency** — does this match the existing codebase's patterns and conventions?

For each issue found, tell me:
- File and line (if applicable)
- Severity (blocker / should-fix / nice-to-have)
- A specific suggested fix

Then give me a final verdict: ready to deploy, or not yet — with a short list of what needs to happen first.

Here are my changes: [paste diff / describe changes / attach files]


















> DATABASE ACCESS

cd server
export DATABASE_URL=$(grep -m1 '^DATABASE_URL=' /home/fitforce/app/server/.env | cut -d= -f2-)
echo "DATABASE_URL is: $DATABASE_URL"

