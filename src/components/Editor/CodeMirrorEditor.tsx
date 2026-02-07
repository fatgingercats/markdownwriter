import React, { useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView, highlightActiveLine } from '@codemirror/view';
import { createTheme } from '@uiw/codemirror-themes';
import { tags as t } from '@lezer/highlight';

// iA Writer Inspired Theme
const iaTheme = createTheme({
    theme: 'light',
    settings: {
        background: '#ffffff',
        foreground: '#333333',
        caret: '#0cb4f5',
        selection: '#bfe7f3',
        selectionMatch: '#bfe7f3',
        lineHighlight: 'transparent',
        gutterBackground: '#ffffff',
        gutterForeground: '#dcdcdc',
        fontFamily: '"iA Writer Duo", "Roboto Mono", monospace',
    },
    styles: [
        // Headers
        { tag: t.heading, fontWeight: 'bold', color: '#111' },
        { tag: t.heading1, fontSize: '2em', fontWeight: '700' },
        { tag: t.heading2, fontSize: '1.6em', fontWeight: '600' },
        { tag: t.heading3, fontSize: '1.3em', fontWeight: '600' },
        { tag: t.heading4, fontSize: '1.2em', fontWeight: '600' },

        // Emphasis
        { tag: t.strong, fontWeight: 'bold', color: '#000' },
        { tag: t.emphasis, fontStyle: 'italic', color: '#444' },
        { tag: t.strikethrough, textDecoration: 'line-through', color: '#888' },

        // Lists
        { tag: t.list, color: '#333' },
        { tag: t.keyword, color: '#0cb4f5' }, // List bullets * - +

        // Links & Images
        { tag: t.link, color: '#0366d6', textDecoration: 'underline' },
        { tag: t.url, color: '#999', textDecoration: 'none' },

        // Code
        { tag: t.monospace, fontFamily: 'monospace', color: '#d14', backgroundColor: '#f6f8fa', padding: '2px 4px', borderRadius: '3px' },
        { tag: t.meta, color: '#999' }, // Code block fences ```

        // Blockquote
        { tag: t.quote, color: '#6a737d', fontStyle: 'italic', borderLeft: '4px solid #dfe2e5' },

        // Horizontal Rule
        { tag: t.contentSeparator, color: '#e1e4e8', fontWeight: 'bold' },
    ],
});

interface EditorProps {
    value: string;
    onChange: (value: string) => void;
    fontSize: number;
}

const CodeMirrorEditor: React.FC<EditorProps> = ({ value, onChange, fontSize }) => {
    const handleChange = useCallback((val: string) => {
        onChange(val);
    }, [onChange]);

    return (
        <CodeMirror
            value={value}
            height="100%"
            extensions={[
                markdown({ base: markdownLanguage, codeLanguages: languages }),
                EditorView.lineWrapping,
                highlightActiveLine(),
                EditorView.theme({
                    "&": {
                        fontSize: `${fontSize}px`, // Dynamic size
                        maxWidth: "700px",
                        margin: "0 auto",
                    },
                    ".cm-content": {
                        fontFamily: '"Courier Prime", "Roboto Mono", monospace',
                        lineHeight: "1.6",
                        paddingBottom: "40vh" // Typewriter feel
                    },
                    ".cm-scroller": {
                        overflow: "auto"
                    }
                })
            ]}
            theme={iaTheme}
            onChange={handleChange}
            basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: true,
                highlightActiveLineGutter: false,
                drawSelection: true,
            }}
            className="cm-editor-wrapper"
        />
    );
};

export default CodeMirrorEditor;
