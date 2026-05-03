import Modal from "@/app/components/Modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function NameModal({ open, title, value, placeholder, submitText, onChange, onSubmit, onClose }) {
    return (
        <Modal open={open} onClose={onClose} title={title}>
            <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
                <Input
                    type="text"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    autoFocus
                />
                <Button type="submit" className="w-full">
                    {submitText}
                </Button>
            </form>
        </Modal>
    );
}
