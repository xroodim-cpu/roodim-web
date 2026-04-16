'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

/* ── 툴바 아이콘 SVG ── */
function BoldIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"/><path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/></svg>;
}
function ItalicIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>;
}
function H2Icon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6v12M4 12h6M10 6v12"/><path d="M21 18h-5c0-3 5-3 5-6 0-1.5-1.5-3-3-3s-3 1.5-3 3"/></svg>;
}
function H3Icon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6v12M4 12h6M10 6v12"/><path d="M15 8s1-2 3-2 3 1 3 3-2 2-2 2"/><path d="M16 14s1 2 3 2 3-1 3-3-2-2-2-2"/></svg>;
}
function ListIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>;
}
function OrderedListIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="2" y="8" fill="currentColor" fontSize="8" fontFamily="sans-serif" stroke="none">1</text><text x="2" y="14" fill="currentColor" fontSize="8" fontFamily="sans-serif" stroke="none">2</text><text x="2" y="20" fill="currentColor" fontSize="8" fontFamily="sans-serif" stroke="none">3</text></svg>;
}
function QuoteIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4z"/></svg>;
}
function LinkIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>;
}
function ImageIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
}
function HrIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12"/></svg>;
}

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 200 }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: placeholder || '내용을 입력하세요...' }),
    ],
    content: value,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
  });

  // 외부에서 value가 바뀌면 에디터 갱신
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  const addLink = () => {
    const url = window.prompt('URL을 입력하세요:');
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  };

  const addImage = () => {
    const url = window.prompt('이미지 URL을 입력하세요:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const Btn = ({ active, onClick, title, children }: {
    active?: boolean; onClick: () => void; title: string; children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        background: active ? 'var(--bg-tertiary)' : 'transparent',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        padding: '4px 6px',
        cursor: 'pointer',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {children}
    </button>
  );

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      {/* 툴바 */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          padding: '6px 8px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
        }}
      >
        <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="굵게">
          <BoldIcon />
        </Btn>
        <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="기울임">
          <ItalicIcon />
        </Btn>
        <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
        <Btn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="제목 H2">
          <H2Icon />
        </Btn>
        <Btn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="제목 H3">
          <H3Icon />
        </Btn>
        <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
        <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="목록">
          <ListIcon />
        </Btn>
        <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="번호 목록">
          <OrderedListIcon />
        </Btn>
        <Btn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="인용">
          <QuoteIcon />
        </Btn>
        <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
        <Btn active={editor.isActive('link')} onClick={addLink} title="링크">
          <LinkIcon />
        </Btn>
        <Btn onClick={addImage} title="이미지">
          <ImageIcon />
        </Btn>
        <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="구분선">
          <HrIcon />
        </Btn>
      </div>

      {/* 에디터 본문 */}
      <div
        className="rte-content"
        style={{ minHeight, padding: '12px 16px', cursor: 'text' }}
        onClick={() => editor.chain().focus().run()}
      >
        <EditorContent editor={editor} />
      </div>

      {/* 에디터 내부 스타일 */}
      <style>{`
        .rte-content .tiptap {
          outline: none;
          font-size: var(--fs-sm);
          color: var(--text-primary);
          line-height: 1.65;
        }
        .rte-content .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--text-tertiary);
          pointer-events: none;
          height: 0;
        }
        .rte-content .tiptap h2 { font-size: var(--fs-lg); font-weight: var(--fw-bold); margin: 16px 0 8px; }
        .rte-content .tiptap h3 { font-size: var(--fs-base); font-weight: var(--fw-bold); margin: 12px 0 6px; }
        .rte-content .tiptap ul, .rte-content .tiptap ol { padding-left: 20px; }
        .rte-content .tiptap blockquote {
          border-left: 3px solid var(--border);
          padding-left: 12px;
          color: var(--text-secondary);
          margin: 8px 0;
        }
        .rte-content .tiptap a { color: var(--accent); text-decoration: underline; }
        .rte-content .tiptap img { max-width: 100%; border-radius: var(--radius-sm); margin: 8px 0; }
        .rte-content .tiptap hr { border: none; border-top: 1px solid var(--border); margin: 16px 0; }
        .rte-content .tiptap p { margin: 0 0 8px; }
      `}</style>
    </div>
  );
}
