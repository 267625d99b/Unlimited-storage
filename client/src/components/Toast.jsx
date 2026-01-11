import { memo, useEffect } from 'react';
import { FiCheck, FiAlertCircle, FiX } from 'react-icons/fi';

const Toast = memo(function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast ${type}`}>
      {type === 'success' ? <FiCheck /> : <FiAlertCircle />}
      <span>{message}</span>
      <button onClick={onClose}><FiX /></button>
    </div>
  );
});

export default Toast;
