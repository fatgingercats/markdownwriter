import React from 'react';
import './Sidebar.css';

interface SidebarProps {
  files: string[];
  activeFile: string;
  onSelectFile: (fileName: string) => void;
  onNewFile: () => void;
  onOpenFolder: () => void;
  onHelp: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ files, activeFile, onSelectFile, onNewFile, onOpenFolder, onHelp }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>LIBRARY</h2>
        <div className="sidebar-actions">
          <button onClick={onOpenFolder} title="Open Folder">📂</button>
          <button onClick={onNewFile} title="New File">➕</button>
          <button onClick={onHelp} title="Markdown Syntax">?</button>
        </div>
      </div>
      <div className="file-list">
        {files.length === 0 ? (
          <div style={{ padding: '20px', color: '#999', fontSize: '12px' }}>
            No files found.<br />Click 📂 to open a folder.
          </div>
        ) : (
          files.map((file, index) => (
            <div
              key={`${file}-${index}`}
              className={`file-item ${activeFile === file ? 'active' : ''}`}
              onClick={() => onSelectFile(file)}
            >
              {file}
            </div>
          ))
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
