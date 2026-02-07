import { useState, useEffect, useMemo } from 'react';
import CodeMirrorEditor from './components/Editor/CodeMirrorEditor';
import Sidebar from './components/Sidebar/Sidebar';
import ReactMarkdown from 'react-markdown';
import './App.css';
import './gfm.css';

import HelpModal from './components/Help/HelpModal';
import ActivationModal from './components/Activation/ActivationModal';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import {
    activatePurchasedLicense,
    initializeLicenseAccess,
    rebindLicense,
    type LicenseAccessState,
} from './utils/license';
import { asBlob } from 'html-docx-js-typescript';

type ExportType = 'markdown' | 'pdf' | 'docx' | 'jpeg';
type LicenseMode = 'store' | 'portable';

interface FolderResult {
    path: string;
    files: string[];
}

interface FileOperationResult {
    success: boolean;
    path?: string;
    content?: string;
    error?: string;
    canceled?: boolean;
}

function isElectronDesktop() {
    return /electron/i.test(navigator.userAgent) && typeof (window as any).require === 'function';
}

function getFileNameFromPath(filePath: string): string {
    const parts = filePath.split(/[\\/]/);
    return parts[parts.length - 1] || 'Untitled.md';
}

function buildExportHtml(innerHtml: string): string {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
body { font-family: Georgia, serif; color: #222; margin: 30px; line-height: 1.6; }
h1, h2, h3, h4, h5, h6 { font-family: "Segoe UI", Arial, sans-serif; color: #111; }
pre { background: #f6f8fa; border: 1px solid #e1e4e8; padding: 16px; overflow: auto; border-radius: 6px; }
code { background: #f6f8fa; border: 1px solid #e1e4e8; border-radius: 3px; padding: 0.2em 0.4em; }
blockquote { margin: 1em 0; padding: 0 1em; color: #6a737d; border-left: 4px solid #dfe2e5; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #dfe2e5; padding: 8px; text-align: left; }
img { max-width: 100%; height: auto; }
a { color: #0366d6; }
</style>
</head>
<body>${innerHtml}</body>
</html>`;
}

function App() {
    const licenseMode: LicenseMode = String((import.meta as any).env?.VITE_LICENSE_MODE || 'portable').toLowerCase() === 'store'
        ? 'store'
        : 'portable';

    const initialContent = localStorage.getItem('mdwriter_backup')
        || '# Welcome to MDWriter\n\nTo focus on the current paragraph, click the eye icon.\n\nThe right side now shows the rendered preview.';

    const [markdown, setMarkdown] = useState<string>(initialContent);
    const [savedSnapshot, setSavedSnapshot] = useState<string>(initialContent);
    const [fileList, setFileList] = useState<string[]>([]);
    const [folderPath, setFolderPath] = useState<string>('');
    const [currentFilePath, setCurrentFilePath] = useState<string>('');
    const [currentFileName, setCurrentFileName] = useState<string>('Unsaved.md');
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [focusMode, setFocusMode] = useState<boolean>(true);
    const [fontSize, setFontSize] = useState<number>(19);

    const [helpVisible, setHelpVisible] = useState(false);

    const [licenseState, setLicenseState] = useState<LicenseAccessState | null>(null);
    const [licenseBusy, setLicenseBusy] = useState(false);
    const [licenseError, setLicenseError] = useState('');
    const [checkingActivation, setCheckingActivation] = useState(true);

    const dirty = useMemo(() => markdown !== savedSnapshot, [markdown, savedSnapshot]);

    const refreshLicenseAccess = async () => {
        setCheckingActivation(true);
        setLicenseError('');
        try {
            if (licenseMode === 'store') {
                setLicenseState({
                    allowed: true,
                    mode: 'licensed',
                    deviceId: 'STORE-CHANNEL',
                });
                return;
            }
            const state = await initializeLicenseAccess();
            setLicenseState(state);
        } finally {
            setCheckingActivation(false);
        }
    };

    useEffect(() => {
        refreshLicenseAccess();
    }, []);

    useEffect(() => {
        localStorage.setItem('mdwriter_backup', markdown);
    }, [markdown]);

    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (!dirty) return;
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [dirty]);

    useEffect(() => {
        if (!isElectronDesktop() || !currentFilePath || !dirty) {
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const { ipcRenderer } = (window as any).require('electron');
                const result = await ipcRenderer.invoke('save-file', {
                    filePath: currentFilePath,
                    content: markdown,
                }) as FileOperationResult;

                if (result.success) {
                    setSavedSnapshot(markdown);
                }
            } catch (err) {
                console.error('Autosave failed:', err);
            }
        }, 1500);

        return () => clearTimeout(timer);
    }, [markdown, currentFilePath, dirty]);

    useEffect(() => {
        const handler = async (event: KeyboardEvent) => {
            if (!isElectronDesktop()) return;

            const key = event.key.toLowerCase();
            const ctrlOrMeta = event.ctrlKey || event.metaKey;

            if (!ctrlOrMeta) return;
            if (key !== 's') return;

            event.preventDefault();

            if (event.shiftKey) {
                await handleSaveAs();
            } else {
                await handleSave();
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [markdown, currentFilePath, currentFileName, folderPath, dirty]);

    const requestDiscardIfDirty = () => {
        if (!dirty) return true;
        return window.confirm('You have unsaved changes. Discard them?');
    };

    const handleSaveAs = async () => {
        if (!isElectronDesktop()) {
            alert('Save As is only available in the Desktop app.');
            return false;
        }

        try {
            const { ipcRenderer } = (window as any).require('electron');
            const defaultName = currentFileName || 'Untitled.md';
            const defaultPath = folderPath ? `${folderPath}\\${defaultName}` : defaultName;

            setIsSaving(true);
            const result = await ipcRenderer.invoke('save-file-as', {
                content: markdown,
                defaultPath,
            }) as FileOperationResult;

            if (result.success && result.path) {
                const fileName = getFileNameFromPath(result.path);
                setCurrentFilePath(result.path);
                setCurrentFileName(fileName);
                setSavedSnapshot(markdown);

                if (!fileList.includes(fileName)) {
                    setFileList((prev) => [...prev, fileName].sort((a, b) => a.localeCompare(b)));
                }
                return true;
            }

            if (!result.canceled && result.error) {
                alert(`Save As failed: ${result.error}`);
            }
            return false;
        } catch (err: any) {
            alert(`Save As failed: ${err.message}`);
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = async () => {
        if (!isElectronDesktop()) {
            alert('Save is only available in the Desktop app.');
            return false;
        }

        if (!currentFilePath) {
            return handleSaveAs();
        }

        try {
            const { ipcRenderer } = (window as any).require('electron');
            setIsSaving(true);

            const result = await ipcRenderer.invoke('save-file', {
                filePath: currentFilePath,
                content: markdown,
            }) as FileOperationResult;

            if (result.success) {
                setSavedSnapshot(markdown);
                return true;
            }

            alert(`Save failed: ${result.error || 'Unknown error'}`);
            return false;
        } catch (err: any) {
            alert(`Save failed: ${err.message}`);
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const loadFileFromFolder = async (nextFolderPath: string, fileName: string, skipDirtyCheck = false) => {
        if (!isElectronDesktop()) return;
        if (!skipDirtyCheck && !requestDiscardIfDirty()) return;

        try {
            const { ipcRenderer } = (window as any).require('electron');
            const result = await ipcRenderer.invoke('read-markdown-file', {
                folderPath: nextFolderPath,
                fileName,
            }) as FileOperationResult;

            if (!result.success) {
                alert(`Failed to read file: ${result.error || 'Unknown error'}`);
                return;
            }

            const nextContent = result.content || '';
            setMarkdown(nextContent);
            setSavedSnapshot(nextContent);
            setCurrentFilePath(result.path || `${nextFolderPath}\\${fileName}`);
            setCurrentFileName(fileName);
        } catch (err: any) {
            alert(`Failed to read file: ${err.message}`);
        }
    };

    const handleOpenFolder = async () => {
        if (!isElectronDesktop()) {
            alert('This feature is only available in the Desktop app.');
            return;
        }

        if (!requestDiscardIfDirty()) return;

        try {
            const { ipcRenderer } = (window as any).require('electron');
            const result = await ipcRenderer.invoke('open-folder') as FolderResult | null;

            if (!result || !result.files) {
                return;
            }

            setFolderPath(result.path);
            setFileList(result.files);

            if (result.files.length > 0) {
                await loadFileFromFolder(result.path, result.files[0], true);
            } else {
                setCurrentFilePath('');
                setCurrentFileName('Unsaved.md');
                setMarkdown('');
                setSavedSnapshot('');
            }
        } catch (err) {
            console.error('Failed to open folder:', err);
        }
    };

    const handleSelectFile = async (fileName: string) => {
        if (!folderPath) return;
        await loadFileFromFolder(folderPath, fileName);
    };

    const handleNewFile = () => {
        if (!requestDiscardIfDirty()) return;

        const newName = `Untitled-${Date.now()}.md`;
        const template = '# New File\n\n';

        setCurrentFilePath('');
        setCurrentFileName(newName);
        setMarkdown(template);
        setSavedSnapshot('');
    };

    const handleExport = async (type: ExportType) => {
        if (!isElectronDesktop()) {
            alert('Export is only available in the Desktop app.');
            return;
        }

        try {
            const { ipcRenderer } = (window as any).require('electron');
            const previewEl = document.querySelector('.preview-content') as HTMLElement | null;
            let content: any = markdown;
            let html = '';

            if (previewEl) {
                html = buildExportHtml(previewEl.innerHTML);
            }

            if (type === 'docx') {
                const blob = await asBlob(html || buildExportHtml(markdown));
                content = await (blob as Blob).arrayBuffer();
            }

            const ext = type === 'markdown' ? 'md' : type;
            const result = await ipcRenderer.invoke('export-file', {
                content,
                type,
                html,
                filename: `export-${Date.now()}.${ext}`,
            }) as FileOperationResult;

            if (result.success) {
                alert(`Successfully exported to ${result.path}`);
            } else if (!result.canceled) {
                alert(`Export failed: ${result.error || 'Unknown error'}`);
            }
        } catch (err) {
            console.error('Export failed:', err);
            alert('Export failed: ' + (err as any).message);
        }
    };

    const handleActivateLicense = async (orderNo: string, activationCode: string) => {
        setLicenseBusy(true);
        setLicenseError('');
        try {
            const result = await activatePurchasedLicense(orderNo, activationCode);
            if (!result.ok) {
                setLicenseError(result.message || 'Activation failed.');
                return;
            }
            await refreshLicenseAccess();
        } finally {
            setLicenseBusy(false);
        }
    };

    const handleRebindLicense = async (orderNo: string) => {
        setLicenseBusy(true);
        setLicenseError('');
        try {
            const result = await rebindLicense(orderNo);
            if (!result.ok) {
                setLicenseError(result.message || 'Rebind failed.');
                return;
            }
            await refreshLicenseAccess();
        } finally {
            setLicenseBusy(false);
        }
    };

    const handleRefreshTrial = async () => {
        setLicenseBusy(true);
        setLicenseError('');
        try {
            await refreshLicenseAccess();
        } finally {
            setLicenseBusy(false);
        }
    };

    if (checkingActivation) return <div className="loading">Checking activation...</div>;
    if (licenseMode !== 'store' && !licenseState?.allowed) {
        return (
            <ActivationModal
                deviceId={licenseState?.deviceId || 'UNKNOWN-DEVICE'}
                orderNo={licenseState?.orderNo}
                trialExpireAt={licenseState?.trialExpireAt}
                trialDaysLeft={licenseState?.trialDaysLeft}
                reason={licenseState?.reason}
                busy={licenseBusy}
                error={licenseError}
                onActivate={handleActivateLicense}
                onRebind={handleRebindLicense}
                onRefreshTrial={handleRefreshTrial}
            />
        );
    }

    return (
        <div className={`app-container ${focusMode ? 'focus-active' : ''}`}>
            <Sidebar
                files={fileList}
                activeFile={currentFileName}
                onSelectFile={handleSelectFile}
                onNewFile={handleNewFile}
                onOpenFolder={handleOpenFolder}
                onHelp={() => setHelpVisible(true)}
            />

            <main className="editor-container">
                <div className="editor-header">
                    <div className="file-status">
                        <span className="file-name">{currentFileName}</span>
                        <span className={`license-badge ${licenseState?.mode || 'licensed'}`}>
                            {licenseMode === 'store'
                                ? 'Store Licensed'
                                : licenseState?.mode === 'licensed'
                                ? 'Licensed'
                                : `Trial ${licenseState?.trialDaysLeft ?? 0}d`}
                        </span>
                        <span className={`dirty-badge ${dirty ? 'dirty' : 'clean'}`}>
                            {dirty ? 'Unsaved' : (isSaving ? 'Saving...' : 'Saved')}
                        </span>
                    </div>
                    <div className="header-actions">
                        <button
                            onClick={() => setFocusMode(!focusMode)}
                            className={`action-btn ${focusMode ? 'active' : ''}`}
                            title="Toggle Focus Mode"
                        >
                            {focusMode ? 'Focused' : 'Focus'}
                        </button>
                        <button className="action-btn" onClick={handleSave}>Save</button>
                        <button className="action-btn" onClick={handleSaveAs}>Save As</button>
                        <div className="font-control">
                            <label htmlFor="font-size-select">Font</label>
                            <select
                                id="font-size-select"
                                value={fontSize}
                                onChange={(e) => setFontSize(Number(e.target.value))}
                            >
                                {[14, 16, 18, 20, 24, 28].map((size) => (
                                    <option key={size} value={size}>{size}px</option>
                                ))}
                            </select>
                        </div>
                        <div className="export-menu">
                            <button className="action-btn" onClick={() => handleExport('markdown')}>Export .md</button>
                            <button className="action-btn" onClick={() => handleExport('docx')}>Export .docx</button>
                            <button className="action-btn" onClick={() => handleExport('pdf')}>Export .pdf</button>
                            <button className="action-btn" onClick={() => handleExport('jpeg')}>Export .jpeg</button>
                        </div>
                    </div>
                </div>
                <CodeMirrorEditor value={markdown} onChange={setMarkdown} fontSize={fontSize} />
            </main>

            <aside className="preview-container">
                <div className="preview-content">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        components={{
                            a: ({ ...props }) => (
                                <a
                                    {...props}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        let href = props.href || '';
                                        if (!href) return;

                                        if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) {
                                            href = 'https://' + href;
                                        }

                                        if (isElectronDesktop()) {
                                            try {
                                                const { ipcRenderer } = (window as any).require('electron');
                                                ipcRenderer.send('open-external', href);
                                            } catch (_err) {
                                                window.open(href, '_blank');
                                            }
                                        } else {
                                            window.open(href, '_blank');
                                        }
                                    }}
                                />
                            )
                        }}
                    >
                        {markdown}
                    </ReactMarkdown>
                </div>
            </aside>

            {helpVisible && <HelpModal onClose={() => setHelpVisible(false)} />}
        </div>
    );
}

export default App;
