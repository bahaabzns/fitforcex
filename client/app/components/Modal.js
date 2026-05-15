'use client';
import { Modal } from "@heroui/react/modal";

export default function AppModal({ open, onClose, title, children, wide }) {
    return (
        <Modal isOpen={open} onOpenChange={(o) => !o && onClose()}>
            <Modal.Backdrop>
                <Modal.Container className={wide ? "max-w-2xl" : "max-w-lg"}>
                    <Modal.Dialog>
                        <Modal.Header>
                            <Modal.Heading>{title}</Modal.Heading>
                            <Modal.CloseTrigger />
                        </Modal.Header>
                        <Modal.Body>{children}</Modal.Body>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
