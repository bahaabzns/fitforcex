// A figure with its unit: the number stays big and bold, the unit after it is smaller and muted
// ("23 plans", "4.9/day", "60%"). Only a value of the shape "number, then unit text" is split; anything
// else (a date, a duration like "3 h 20 min", a dash, a plain number) is shown exactly as given.
const NUMBER_THEN_UNIT = /^(\s*[-+]?[\d.,٠-٩٫٬]+%?)(\s*)([^\d٠-٩]+)$/;

export default function NumberWithUnit({ value, unitClassName = "" }) {
    if (typeof value !== "string") return value;
    const match = NUMBER_THEN_UNIT.exec(value);
    if (!match) return value;
    const [, number, gap, unit] = match;
    return (
        <>
            <bdi>{number.trim()}</bdi>
            <span className={`text-sm font-medium text-muted-foreground ${gap ? "ms-1.5" : "ms-0.5"} ${unitClassName}`}>{unit.trim()}</span>
        </>
    );
}
