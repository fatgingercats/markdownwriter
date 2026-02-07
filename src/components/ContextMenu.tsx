import React from 'react';

interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    onSetFontSize: (size: number) => void;
    startSize: number;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, onSetFontSize, startSize }) => {
    React.useEffect(() => {
        const handleClick = () => onClose();
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [onClose]);

    return (
        <div style={{
            position: 'fixed',
            top: y,
            left: x,
            background: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            zIndex: 1000,
            padding: '5px 0',
            minWidth: '150px'
        }}>
            <div style={{ padding: '5px 15px', color: '#999', fontSize: '12px', fontWeight: 'bold' }}>Font Size</div>
            {[14, 16, 18, 20, 24, 28].map(size => (
                <div
                    key={size}
                    onClick={() => onSetFontSize(size)}
                    style={{
                        padding: '8px 15px',
                        cursor: 'pointer',
                        background: size === startSize ? '#f0f0f0' : 'transparent',
                        display: 'flex',
                        justifyContent: 'space-between'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                    onMouseLeave={(e) => e.currentTarget.style.background = size === startSize ? '#f0f0f0' : 'transparent'}
                >
                    <span>{size}px</span>
                    {size === startSize && <span>✓</span>}
                </div>
            ))}
        </div>
    );
};

export default ContextMenu;
