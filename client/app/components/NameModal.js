export default function NameModal({ title, value, placeholder, submitText, onChange, onSubmit, onClose }) {
    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black/30 z-50"
            onClick={onClose}
        >
            <form
            className="card p-6 w-96 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-xl font-bold">{title}</h2>
                <input
                    type="text"
                    className="input-field"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    autoFocus
                />
                <button
                    className="btn-primary px-4 w-full mb-4"
                    onClick={onSubmit}
                >
                    {submitText}
                </button>
            </form>
        </div>
    );
}