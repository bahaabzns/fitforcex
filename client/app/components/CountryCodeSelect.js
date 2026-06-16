'use client';

import { useTranslations } from "next-intl";
import { ComboBox } from "@heroui/react/combo-box";
import { Input } from "@heroui/react/input";
import { ListBox } from "@heroui/react/list-box";

export const COUNTRY_CODES = [
    { code: "+93", name: "Afghanistan" }, { code: "+355", name: "Albania" }, { code: "+213", name: "Algeria" },
    { code: "+376", name: "Andorra" }, { code: "+244", name: "Angola" }, { code: "+54", name: "Argentina" },
    { code: "+374", name: "Armenia" }, { code: "+61", name: "Australia" }, { code: "+43", name: "Austria" },
    { code: "+994", name: "Azerbaijan" }, { code: "+973", name: "Bahrain" }, { code: "+880", name: "Bangladesh" },
    { code: "+375", name: "Belarus" }, { code: "+32", name: "Belgium" }, { code: "+55", name: "Brazil" },
    { code: "+1", name: "Canada / USA" }, { code: "+86", name: "China" }, { code: "+57", name: "Colombia" },
    { code: "+385", name: "Croatia" }, { code: "+357", name: "Cyprus" }, { code: "+420", name: "Czech Republic" },
    { code: "+45", name: "Denmark" }, { code: "+20", name: "Egypt" }, { code: "+358", name: "Finland" },
    { code: "+33", name: "France" }, { code: "+995", name: "Georgia" }, { code: "+49", name: "Germany" },
    { code: "+233", name: "Ghana" }, { code: "+30", name: "Greece" }, { code: "+36", name: "Hungary" },
    { code: "+354", name: "Iceland" }, { code: "+91", name: "India" }, { code: "+62", name: "Indonesia" },
    { code: "+98", name: "Iran" }, { code: "+964", name: "Iraq" }, { code: "+353", name: "Ireland" },
    { code: "+972", name: "Israel" }, { code: "+39", name: "Italy" }, { code: "+81", name: "Japan" },
    { code: "+962", name: "Jordan" }, { code: "+7", name: "Kazakhstan / Russia" }, { code: "+254", name: "Kenya" },
    { code: "+965", name: "Kuwait" }, { code: "+961", name: "Lebanon" }, { code: "+218", name: "Libya" },
    { code: "+60", name: "Malaysia" }, { code: "+960", name: "Maldives" }, { code: "+52", name: "Mexico" },
    { code: "+212", name: "Morocco" }, { code: "+31", name: "Netherlands" }, { code: "+64", name: "New Zealand" },
    { code: "+234", name: "Nigeria" }, { code: "+47", name: "Norway" }, { code: "+968", name: "Oman" },
    { code: "+92", name: "Pakistan" }, { code: "+970", name: "Palestine" }, { code: "+507", name: "Panama" },
    { code: "+63", name: "Philippines" }, { code: "+48", name: "Poland" }, { code: "+351", name: "Portugal" },
    { code: "+974", name: "Qatar" }, { code: "+40", name: "Romania" }, { code: "+250", name: "Rwanda" },
    { code: "+966", name: "Saudi Arabia" }, { code: "+221", name: "Senegal" }, { code: "+381", name: "Serbia" },
    { code: "+65", name: "Singapore" }, { code: "+27", name: "South Africa" }, { code: "+82", name: "South Korea" },
    { code: "+34", name: "Spain" }, { code: "+94", name: "Sri Lanka" }, { code: "+249", name: "Sudan" },
    { code: "+46", name: "Sweden" }, { code: "+41", name: "Switzerland" }, { code: "+963", name: "Syria" },
    { code: "+886", name: "Taiwan" }, { code: "+255", name: "Tanzania" }, { code: "+66", name: "Thailand" },
    { code: "+216", name: "Tunisia" }, { code: "+90", name: "Turkey" }, { code: "+256", name: "Uganda" },
    { code: "+380", name: "Ukraine" }, { code: "+971", name: "United Arab Emirates" }, { code: "+44", name: "United Kingdom" },
    { code: "+1", name: "United States" }, { code: "+998", name: "Uzbekistan" }, { code: "+58", name: "Venezuela" },
    { code: "+84", name: "Vietnam" }, { code: "+967", name: "Yemen" }, { code: "+260", name: "Zambia" },
    { code: "+263", name: "Zimbabwe" },
];

// Country codes aren't unique (e.g. +1, +7), so give each item a stable unique id for the listbox.
const COUNTRY_ITEMS = COUNTRY_CODES.map(c => ({ id: `${c.code}__${c.name}`, code: c.code, name: c.name }));

/**
 * Searchable country-code picker shared across the app (Add Client / Edit Client / etc.).
 * A HeroUI ComboBox with type-to-filter and a code/name list. RTL-aware.
 */
export default function CountryCodeSelect({ value, onChange }) {
    const t = useTranslations('clients');
    const selected = COUNTRY_ITEMS.find(c => c.code === value) ?? null;

    return (
        <ComboBox
            className="w-40 shrink-0"
            variant="secondary"
            aria-label={t('countryCode')}
            menuTrigger="focus"
            selectedKey={selected?.id ?? null}
            onSelectionChange={(key) => {
                const item = COUNTRY_ITEMS.find(c => c.id === key);
                if (item) onChange(item.code);
            }}
        >
            <ComboBox.InputGroup>
                <Input placeholder={t('countryCode')} />
                <ComboBox.Trigger />
            </ComboBox.InputGroup>
            <ComboBox.Popover>
                <ListBox>
                    {COUNTRY_ITEMS.map(c => (
                        <ListBox.Item key={c.id} id={c.id} textValue={`${c.name} ${c.code}`}>
                            <span className="flex-1">{c.name}</span>
                            <span className="text-muted-foreground">{c.code}</span>
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    ))}
                </ListBox>
            </ComboBox.Popover>
        </ComboBox>
    );
}
