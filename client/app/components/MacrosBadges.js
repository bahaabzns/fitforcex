import { Card } from "@heroui/react/card";
import { Separator } from "@heroui/react/separator";

export default function MacrosBadges({ calories, protein, carbs, fats }) {
    return (
        <Card>
            <Card.Content className="px-4 py-2.5 flex items-center gap-4">
                <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-foreground">{calories}</span>
                    <span className="text-xs text-muted-foreground">kcal</span>
                </div>
                <Separator orientation="vertical" className="h-5 shrink-0" />
                <div className="flex gap-4 flex-1">
                    {[
                        { label: "C", value: carbs },
                        { label: "P", value: protein },
                        { label: "F", value: fats },
                    ].map(({ label, value }) => (
                        <p key={label} className="text-sm flex items-baseline gap-0.5">
                            <span className="text-xs font-medium text-muted-foreground">{label}</span>
                            <span className="font-medium text-foreground">{value}</span>
                            <span className="text-xs text-muted-foreground">g</span>
                        </p>
                    ))}
                </div>
            </Card.Content>
        </Card>
    );
}
