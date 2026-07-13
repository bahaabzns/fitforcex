import { Type, Pilcrow, Hash, ArrowLeftRight, CircleDot, SquareCheck, Calendar, BarChart3, Paperclip } from "lucide-react";

// Single source of truth for form question types on the web client.
// Mirrors server/src/modules/forms/questionTypes.ts and mobile/lib/features/forms/question_types.dart —
// keep all three in sync when a type is added or removed.
export const QUESTION_TYPE_VALUES = [
    { value: "text",        labelKey: "typeShortText",   icon: Type },
    { value: "long_text",   labelKey: "typeLongText",    icon: Pilcrow },
    { value: "number",      labelKey: "typeNumber",      icon: Hash },
    { value: "scale",       labelKey: "typeScale",       icon: ArrowLeftRight },
    { value: "select",      labelKey: "typeSingleChoice",icon: CircleDot },
    { value: "multiselect", labelKey: "typeMultiChoice", icon: SquareCheck },
    { value: "date",        labelKey: "typeDate",        icon: Calendar },
    { value: "metric",      labelKey: "typeMetric",      icon: BarChart3 },
    { value: "attachment",  labelKey: "typeAttachment",  icon: Paperclip },
];

// Question types whose answer shape can be meaningfully tracked as a metric
// via the "Track as Metric" action (server/src/modules/forms/questionTypes.ts's metricConvertible).
export const METRIC_CONVERTIBLE_TYPES = ["number", "scale"];

// Mirrors server/src/lib/formAttachments.ts's ATTACHMENT_CATEGORIES — kept
// here too since the Builder needs the list to render the category picker.
export const ATTACHMENT_CATEGORIES = [
    { value: "images",    label: "Images only" },
    { value: "documents", label: "Documents only" },
    { value: "videos",    label: "Videos only" },
    { value: "any",       label: "Any file" },
];
