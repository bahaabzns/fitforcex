import Modal from "@/app/components/Modal";

export default function NameModal({ open, title, value, placeholder, submitText, onChange, onSubmit, onClose }) {
    return (
        <Modal open={open} onClose={onClose} title={title}>
            <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
                <input
                    type="text"
                    className="input-field"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    autoFocus
                />
                <button className="btn-primary px-4 w-full" type="submit">
                    {submitText}
                </button>
            </form>
        </Modal>
    );
}