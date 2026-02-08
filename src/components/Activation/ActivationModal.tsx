import React, { useState } from 'react';

interface ActivationModalProps {
    deviceId: string;
    orderNo?: string;
    trialExpireAt?: string;
    trialDaysLeft?: number;
    reason?: string;
    busy?: boolean;
    error?: string;
    onActivate: (orderNo: string, activationCode: string) => Promise<void>;
    onRebind: (orderNo: string) => Promise<void>;
    onRefreshTrial: () => Promise<void>;
}

const ActivationModal: React.FC<ActivationModalProps> = ({
    deviceId,
    orderNo,
    trialExpireAt,
    trialDaysLeft,
    reason,
    busy,
    error,
    onActivate,
    onRebind,
    onRefreshTrial,
}) => {
    const [orderNoValue, setOrderNoValue] = useState(orderNo || '');
    const [activationCode, setActivationCode] = useState('');

    React.useEffect(() => {
        setOrderNoValue(orderNo || '');
    }, [orderNo]);

    const canUseTrial = (trialDaysLeft ?? 0) > 0;

    const handleActivate = async () => {
        if (!orderNoValue.trim() || !activationCode.trim()) {
            return;
        }
        await onActivate(orderNoValue.trim(), activationCode.trim());
    };

    const handleRebind = async () => {
        if (!orderNoValue.trim()) {
            return;
        }
        await onRebind(orderNoValue.trim());
    };

    return (
        <div className="activation-overlay">
            <div className="activation-modal">
                <h2>DraftOne License</h2>
                <p>{canUseTrial ? `Trial active: ${trialDaysLeft} day(s) left` : 'Trial expired. Please activate to continue.'}</p>

                <div className="field">
                    <label>Device ID:</label>
                    <div className="id-container">
                        <code>{deviceId}</code>
                        <button onClick={() => navigator.clipboard.writeText(deviceId)} disabled={busy}>Copy</button>
                    </div>
                    <small>{trialExpireAt ? `Trial expires at: ${new Date(trialExpireAt).toLocaleString()}` : 'No trial expiration found.'}</small>
                </div>

                <div className="field">
                    <label>Order No:</label>
                    <input
                        type="text"
                        placeholder="ORDER-XXXX"
                        value={orderNoValue}
                        onChange={(e) => setOrderNoValue(e.target.value)}
                        disabled={busy}
                    />
                </div>

                <div className="field">
                    <label>Activation Code:</label>
                    <input
                        type="text"
                        placeholder="Paste activation code"
                        value={activationCode}
                        onChange={(e) => setActivationCode(e.target.value)}
                        disabled={busy}
                    />
                </div>

                {reason && <p className="error-message">{reason}</p>}
                {error && <p className="error-message">{error}</p>}

                <div className="activation-actions">
                    <button className="activate-btn" onClick={handleActivate} disabled={busy || !orderNoValue.trim() || !activationCode.trim()}>
                        {busy ? 'Processing...' : 'Activate'}
                    </button>
                    <button className="secondary-btn" onClick={handleRebind} disabled={busy || !orderNoValue.trim()}>
                        Rebind Device
                    </button>
                    <button className="secondary-btn" onClick={onRefreshTrial} disabled={busy}>
                        Refresh Trial
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ActivationModal;
