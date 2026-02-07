export type AccessMode = 'trial' | 'licensed' | 'blocked';

export interface LicenseAccessState {
    allowed: boolean;
    mode: AccessMode;
    reason?: string;
    deviceId: string;
    trialExpireAt?: string;
    trialDaysLeft?: number;
    licenseToken?: string;
    orderNo?: string;
}

export interface ActivationResult {
    ok: boolean;
    message?: string;
}

interface DeviceFingerprint {
    deviceId: string;
    hardwareProfile?: {
        platform?: string;
        arch?: string;
        cpuModel?: string;
        cpuCount?: number;
        totalMemoryGb?: number;
        macs?: string[];
    };
    toleranceKeys?: string[];
    distributionChannel?: 'portable' | 'installed' | string;
}

const STORAGE_KEYS = {
    deviceId: 'mdwriter_device_id',
    trialExpireAt: 'mdwriter_trial_expire_at',
    licenseToken: 'mdwriter_license_token',
    orderNo: 'mdwriter_order_no',
    fingerprint: 'mdwriter_hardware_fingerprint',
};

const TRIAL_DAYS = 7;

interface ApiResult {
    ok: boolean;
    message?: string;
    trialExpireAt?: string;
    licenseToken?: string;
    orderNo?: string;
}

function isElectronDesktop() {
    return /electron/i.test(navigator.userAgent) && typeof (window as any).require === 'function';
}

function getApiBaseUrl(): string {
    const raw = (import.meta as any).env?.VITE_LICENSE_API_BASE_URL || '';
    return String(raw).trim().replace(/\/+$/, '');
}

function daysLeft(expireAt?: string): number | undefined {
    if (!expireAt) return undefined;
    const ms = Date.parse(expireAt) - Date.now();
    if (Number.isNaN(ms)) return undefined;
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function randomId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadCachedFingerprint(): DeviceFingerprint {
    const deviceId = localStorage.getItem(STORAGE_KEYS.deviceId) || randomId();
    const raw = localStorage.getItem(STORAGE_KEYS.fingerprint);
    if (!raw) return { deviceId };

    try {
        const parsed = JSON.parse(raw);
        return {
            deviceId,
            hardwareProfile: parsed?.hardwareProfile,
            toleranceKeys: Array.isArray(parsed?.toleranceKeys) ? parsed.toleranceKeys : [],
            distributionChannel: parsed?.distributionChannel,
        };
    } catch {
        return { deviceId };
    }
}

function cacheFingerprint(fp: DeviceFingerprint) {
    localStorage.setItem(STORAGE_KEYS.deviceId, fp.deviceId);
    localStorage.setItem(
        STORAGE_KEYS.fingerprint,
        JSON.stringify({
            hardwareProfile: fp.hardwareProfile || {},
            toleranceKeys: fp.toleranceKeys || [],
            distributionChannel: fp.distributionChannel || 'installed',
        })
    );
}

async function requestApi<T extends ApiResult>(path: string, payload: Record<string, any>): Promise<T> {
    const base = getApiBaseUrl();
    if (!base) {
        return { ok: false, message: 'License API not configured.' } as T;
    }

    try {
        const response = await fetch(`${base}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const message = `HTTP ${response.status}`;
            return { ok: false, message } as T;
        }

        return await response.json() as T;
    } catch (err: any) {
        return { ok: false, message: err?.message || 'Network error' } as T;
    }
}

export async function getMachineId(): Promise<string> {
    const fingerprint = await getDeviceFingerprint();
    return fingerprint.deviceId;
}

async function getDeviceFingerprint(): Promise<DeviceFingerprint> {
    if (isElectronDesktop()) {
        try {
            const { ipcRenderer } = (window as any).require('electron');
            const fp = await ipcRenderer.invoke('get-device-fingerprint');
            if (fp && typeof fp.deviceId === 'string' && fp.deviceId.trim()) {
                const normalized: DeviceFingerprint = {
                    deviceId: fp.deviceId,
                    hardwareProfile: fp.hardwareProfile || {},
                    toleranceKeys: Array.isArray(fp.toleranceKeys) ? fp.toleranceKeys : [],
                    distributionChannel: fp.distributionChannel || 'installed',
                };
                cacheFingerprint(normalized);
                return normalized;
            }
        } catch (_err) {
            try {
                const { ipcRenderer } = (window as any).require('electron');
                const legacyId = await ipcRenderer.invoke('get-machine-id');
                if (legacyId && typeof legacyId === 'string') {
                    const fallback = { deviceId: legacyId, distributionChannel: 'installed' };
                    cacheFingerprint(fallback);
                    return fallback;
                }
            } catch (_legacyErr) {
                // fallback to local id
            }
        }
    }

    const cached = loadCachedFingerprint();
    if (cached.deviceId) return cached;

    const generated = { deviceId: randomId(), distributionChannel: 'installed' };
    cacheFingerprint(generated);
    return generated;
}

function ensureLocalTrial(deviceId: string): string {
    const existing = localStorage.getItem(STORAGE_KEYS.trialExpireAt);
    if (existing) return existing;

    const expire = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(STORAGE_KEYS.trialExpireAt, expire);
    localStorage.setItem(STORAGE_KEYS.deviceId, deviceId);
    return expire;
}

function updateCachedState(result: ApiResult) {
    if (result.trialExpireAt) {
        localStorage.setItem(STORAGE_KEYS.trialExpireAt, result.trialExpireAt);
    }
    if (result.licenseToken) {
        localStorage.setItem(STORAGE_KEYS.licenseToken, result.licenseToken);
    }
    if (result.orderNo) {
        localStorage.setItem(STORAGE_KEYS.orderNo, result.orderNo);
    }
}

export async function initializeLicenseAccess(): Promise<LicenseAccessState> {
    const fingerprint = await getDeviceFingerprint();
    const deviceId = fingerprint.deviceId;
    const apiBase = getApiBaseUrl();

    const cachedToken = localStorage.getItem(STORAGE_KEYS.licenseToken) || '';
    const cachedOrder = localStorage.getItem(STORAGE_KEYS.orderNo) || '';

    if (cachedToken) {
        if (!apiBase) {
            return {
                allowed: true,
                mode: 'licensed',
                deviceId,
                licenseToken: cachedToken,
                orderNo: cachedOrder,
            };
        }

        const verify = await requestApi<ApiResult>('/verify', {
            deviceId,
            licenseToken: cachedToken,
            hardwareProfile: fingerprint.hardwareProfile || {},
            toleranceKeys: fingerprint.toleranceKeys || [],
            distributionChannel: fingerprint.distributionChannel || 'installed',
        });

        if (verify.ok) {
            updateCachedState({ ...verify, licenseToken: cachedToken });
            return {
                allowed: true,
                mode: 'licensed',
                deviceId,
                licenseToken: cachedToken,
                trialExpireAt: verify.trialExpireAt || undefined,
                trialDaysLeft: daysLeft(verify.trialExpireAt),
                orderNo: cachedOrder,
            };
        }

        localStorage.removeItem(STORAGE_KEYS.licenseToken);
    }

    if (!apiBase) {
        const expireAt = ensureLocalTrial(deviceId);
        const left = daysLeft(expireAt);
        const allowed = (left ?? 0) > 0;

        return {
            allowed,
            mode: allowed ? 'trial' : 'blocked',
            reason: allowed ? undefined : 'Trial expired (local fallback mode).',
            deviceId,
            trialExpireAt: expireAt,
            trialDaysLeft: left,
        };
    }

    const trialPayload = {
        deviceId,
        hardwareProfile: fingerprint.hardwareProfile || {},
        toleranceKeys: fingerprint.toleranceKeys || [],
        distributionChannel: fingerprint.distributionChannel || 'installed',
    };
    const trial = await requestApi<ApiResult>('/startTrial', trialPayload);

    const expireAt = trial.trialExpireAt || localStorage.getItem(STORAGE_KEYS.trialExpireAt) || ensureLocalTrial(deviceId);
    localStorage.setItem(STORAGE_KEYS.trialExpireAt, expireAt);

    const left = daysLeft(expireAt);
    const allowed = trial.ok ? (left ?? 0) > 0 : (left ?? 0) > 0;

    return {
        allowed,
        mode: allowed ? 'trial' : 'blocked',
        reason: allowed ? undefined : (trial.message || 'Trial expired.'),
        deviceId,
        trialExpireAt: expireAt,
        trialDaysLeft: left,
    };
}

export async function activatePurchasedLicense(orderNo: string, activationCode: string): Promise<ActivationResult> {
    const apiBase = getApiBaseUrl();
    if (!apiBase) {
        return { ok: false, message: 'VITE_LICENSE_API_BASE_URL is not configured.' };
    }

    const fingerprint = await getDeviceFingerprint();
    const deviceId = fingerprint.deviceId;
    const result = await requestApi<ApiResult>('/activate', {
        deviceId,
        orderNo,
        activationCode,
        hardwareProfile: fingerprint.hardwareProfile || {},
        toleranceKeys: fingerprint.toleranceKeys || [],
        distributionChannel: fingerprint.distributionChannel || 'installed',
    });

    if (!result.ok || !result.licenseToken) {
        return { ok: false, message: result.message || 'Activation failed.' };
    }

    updateCachedState({ ...result, orderNo });
    return { ok: true };
}

export async function rebindLicense(orderNo: string): Promise<ActivationResult> {
    const apiBase = getApiBaseUrl();
    if (!apiBase) {
        return { ok: false, message: 'VITE_LICENSE_API_BASE_URL is not configured.' };
    }

    const fingerprint = await getDeviceFingerprint();
    const deviceId = fingerprint.deviceId;
    const result = await requestApi<ApiResult>('/rebind', {
        deviceId,
        orderNo,
        hardwareProfile: fingerprint.hardwareProfile || {},
        toleranceKeys: fingerprint.toleranceKeys || [],
        distributionChannel: fingerprint.distributionChannel || 'installed',
    });

    if (!result.ok || !result.licenseToken) {
        return { ok: false, message: result.message || 'Rebind failed.' };
    }

    updateCachedState({ ...result, orderNo });
    return { ok: true };
}

export function clearLocalLicenseCache() {
    localStorage.removeItem(STORAGE_KEYS.licenseToken);
}
