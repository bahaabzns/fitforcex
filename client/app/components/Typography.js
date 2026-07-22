import { cn } from "@/lib/utils";

/**
 * Local re-implementation of heroui-native's Typography API (that package is
 * React Native/Expo-only — this app is Next.js web on @heroui/react, which
 * has no typography primitive of its own) so every screen shares one
 * semantic type scale instead of ad-hoc text-* class strings.
 */
const TYPE_CLASSES = {
    h1:       "text-3xl font-bold leading-tight",
    h2:       "text-2xl font-bold leading-tight",
    h3:       "text-xl font-semibold leading-snug",
    h4:       "text-lg font-semibold leading-snug",
    h5:       "text-base font-semibold leading-normal",
    h6:       "text-sm font-semibold leading-normal",
    body:     "text-sm font-normal leading-normal",
    "body-sm": "text-xs font-normal leading-normal",
    "body-xs": "text-[11px] font-normal leading-normal",
    code:     "font-mono text-xs bg-default rounded-md px-1.5 py-0.5 self-start inline-block",
};

const WEIGHT_CLASSES = {
    normal:   "font-normal",
    medium:   "font-medium",
    semibold: "font-semibold",
    bold:     "font-bold",
};

const COLOR_CLASSES = {
    default: "text-foreground",
    muted:   "text-muted-foreground",
};

const ALIGN_CLASSES = {
    start:   "text-start",
    center:  "text-center",
    end:     "text-end",
    justify: "text-justify",
};

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

export default function Typography({
    type = "body",
    as,
    color = "default",
    weight,
    align = "start",
    truncate = false,
    className,
    children,
    ...props
}) {
    const Tag = as ?? (HEADING_TAGS.has(type) ? type : type === "code" ? "code" : "p");

    return (
        <Tag
            className={cn(
                TYPE_CLASSES[type] ?? TYPE_CLASSES.body,
                COLOR_CLASSES[color],
                weight && WEIGHT_CLASSES[weight],
                ALIGN_CLASSES[align],
                truncate && "truncate",
                className,
            )}
            {...props}
        >
            {children}
        </Tag>
    );
}

Typography.Heading = function TypographyHeading({ type = "h1", ...props }) {
    return <Typography type={type} {...props} />;
};

Typography.Paragraph = function TypographyParagraph({ type = "body", ...props }) {
    return <Typography type={type} {...props} />;
};

Typography.Code = function TypographyCode(props) {
    return <Typography {...props} type="code" />;
};
