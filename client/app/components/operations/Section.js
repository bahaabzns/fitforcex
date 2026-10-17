// One labelled block of the Team Workload page: a heading with a one-line description, an optional
// control on the right (look-ahead window, date range...), and the content below. Sections are
// separated by a rule, so a single long page still reads as clear categories.
export default function Section({ title, description, right = null, first = false, children }) {
    return (
        <section className={`flex flex-col gap-4 min-w-0 ${first ? "" : "border-t border-border pt-6"}`}>
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                    {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
                </div>
                {right && <div className="w-full sm:w-auto">{right}</div>}
            </div>
            {children}
        </section>
    );
}
