/// Single source of truth for form question types on mobile.
/// Mirrors server/src/modules/forms/questionTypes.ts and
/// client/app/components/forms/questionTypes.js — keep all three in sync
/// when a type is added or removed.
const List<String> kQuestionTypes = [
  'text',
  'long_text',
  'number',
  'date',
  'scale',
  'select',
  'multiselect',
  'metric',
  'attachment',
];
