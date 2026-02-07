import React, { useEffect } from 'react';
import './HelpModal.css';

interface HelpModalProps {
    onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
    // Close on Escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    return (
        <div className="help-modal-overlay" onClick={onClose}>
            <div className="help-modal-content" onClick={e => e.stopPropagation()}>
                <button className="help-modal-close" onClick={onClose}>&times;</button>
                <h2>Markdown Syntax Guide</h2>

                <div className="help-section">
                    <h3>Headers</h3>
                    <table className="help-table">
                        <tbody>
                            <tr>
                                <td><code># H1</code></td>
                                <td>Big Header (Space required)</td>
                            </tr>
                            <tr>
                                <td><code>## H2</code></td>
                                <td>Medium Header (Space required)</td>
                            </tr>
                            <tr>
                                <td><code>### H3</code></td>
                                <td>Small Header (Space required)</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="help-section">
                    <h3>Emphasis</h3>
                    <table className="help-table">
                        <tbody>
                            <tr>
                                <td><code>**bold**</code></td>
                                <td><strong>Bold Text</strong></td>
                            </tr>
                            <tr>
                                <td><code>*italic*</code></td>
                                <td><em>Italic Text</em></td>
                            </tr>
                            <tr>
                                <td><code>~~strike~~</code></td>
                                <td><del>Strikethrough</del></td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="help-section">
                    <h3>Lists</h3>
                    <table className="help-table">
                        <tbody>
                            <tr>
                                <td><code>- Item</code></td>
                                <td>Bullet List</td>
                            </tr>
                            <tr>
                                <td><code>1. Item</code></td>
                                <td>Numbered List</td>
                            </tr>
                            <tr>
                                <td><code>- [x] Task</code></td>
                                <td>Task List</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="help-section">
                    <h3>Other</h3>
                    <table className="help-table">
                        <tbody>
                            <tr>
                                <td><code>&gt; Quote</code></td>
                                <td>Blockquote</td>
                            </tr>
                            <tr>
                                <td><code>`code`</code></td>
                                <td>Inline Code</td>
                            </tr>
                            <tr>
                                <td><code>```cpp</code></td>
                                <td>Code Block</td>
                            </tr>
                            <tr>
                                <td><code>[Link](url)</code></td>
                                <td>Hyperlink</td>
                            </tr>
                        </tbody>
                    </table>
                    <p style={{ fontSize: '0.85em', color: '#888', marginTop: '10px', lineHeight: '1.4' }}>
                        * <strong>Exit Quote/List:</strong> Use an empty line.<br />
                        * <strong>Close Code Block:</strong> Type <code>```</code> or <code>~~~</code> on a new line.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default HelpModal;
