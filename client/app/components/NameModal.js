import Modal from "@/app/components/Modal";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { Button } from "@heroui/react/button";

export default function NameModal({ open, title, value, placeholder, submitText, onChange, onSubmit, onClose }) {
    return (
        <Modal open={open} onClose={onClose} title={title}>
            <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
                <TextField value={value} onChange={onChange}>
                    <Input type="text" placeholder={placeholder} autoFocus />
                </TextField>
                <Button type="submit" className="w-full">
                    {submitText}
                </Button>
            </form>
        </Modal>
    );
}
