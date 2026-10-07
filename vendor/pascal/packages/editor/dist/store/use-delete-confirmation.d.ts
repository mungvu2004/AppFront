type DeleteConfirmationRequest = {
    count: number;
    onConfirm: () => void;
};
type DeleteConfirmationStore = {
    request: DeleteConfirmationRequest | null;
    cancel: () => void;
    confirm: () => void;
    requestConfirmation: (request: DeleteConfirmationRequest) => void;
};
declare const useDeleteConfirmation: import("zustand").UseBoundStore<import("zustand").StoreApi<DeleteConfirmationStore>>;
export default useDeleteConfirmation;
//# sourceMappingURL=use-delete-confirmation.d.ts.map