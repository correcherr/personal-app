interface ConfirmModalProps {
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'info';
}

export function ConfirmModal({ 
  title, 
  message, 
  confirmText, 
  cancelText = "Cancelar", 
  onConfirm, 
  onCancel,
  type = 'info' 
}: ConfirmModalProps) {
  return (
    <div className="modal-overlay" onClick={onCancel} style={{ zIndex: 3000 }}>
      <div className="modal-content animate-scale-in" onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: '1.4rem', marginBottom: '12px' }}>{title}</h3>
        <p style={{ color: 'var(--text-3)', fontSize: '0.95rem', marginBottom: '24px' }}>{message}</p>
        
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onCancel} style={{ padding: '12px 24px', borderRadius: '12px', fontWeight: 700 }}>
            {cancelText}
          </button>
          <button 
            className={`btn-submit ${type === 'danger' ? 'btn-danger-action' : ''}`} 
            onClick={onConfirm}
            style={{ padding: '12px 24px', borderRadius: '12px', fontWeight: 700 }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
