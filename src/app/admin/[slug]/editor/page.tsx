'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface SiteFile {
  id: number;
  filename: string;
  fileType: string;
  fileSize: number;
  isEntry: boolean;
  sortOrder: number;
  updatedAt: string;
}

interface Variable {
  code: string;
  description: string;
  category: string;
}

interface Skin {
  id: number;
  slug: string;
  name: string;
  description: string | null;
}

export default function EditorPage() {
  const [files, setFiles] = useState<SiteFile[]>([]);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [activeFile, setActiveFile] = useState<SiteFile | null>(null);
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newFileName, setNewFileName] = useState('');
  const [showNewFile, setShowNewFile] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showVars, setShowVars] = useState(false);
  const [skin, setSkin] = useState<Skin | null>(null);
  const [skinNameInput, setSkinNameInput] = useState('');
  const [skinSaving, setSkinSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const slug = typeof window !== 'undefined' ? window.location.pathname.split('/')[2] : '';

  // 파일 목록 로드
  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/files?slug=${slug}`);
      const data = await res.json();
      if (data.ok) {
        setFiles(data.files);
        setVariables(data.variables || []);
        if (data.skin) {
          setSkin(data.skin);
          setSkinNameInput(data.skin.name);
        }
        if (!activeFile && data.files.length > 0) {
          loadFileContent(data.files[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load files:', e);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  // 스킨 이름 저장
  const saveSkinName = async () => {
    if (!skin) return;
    const trimmed = skinNameInput.trim();
    if (trimmed.length === 0) {
      setSkinNameInput(skin.name);
      return;
    }
    if (trimmed === skin.name) return;

    setSkinSaving(true);
    try {
      const res = await fetch(`/api/skins/${skin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (data.ok) {
        setSkin({ ...skin, name: data.skin.name });
        setSkinNameInput(data.skin.name);
      } else {
        alert(`스킨 이름 저장 실패: ${data.error || '알 수 없는 오류'}`);
        setSkinNameInput(skin.name);
      }
    } catch (e) {
      console.error('Failed to save skin name:', e);
      alert('스킨 이름 저장 중 오류');
      setSkinNameInput(skin.name);
    } finally {
      setSkinSaving(false);
    }
  };

  // 파일 내용 로드
  const loadFileContent = async (file: SiteFile) => {
    setActiveFile(file);
    try {
      const res = await fetch(`/api/admin/files/${file.id}`);
      const data = await res.json();
      if (data.ok) {
        setContent(data.file.content || '');
        setOriginalContent(data.file.content || '');
      }
    } catch (e) {
      console.error('Failed to load file:', e);
    }
  };

  // 파일 저장
  const saveFile = async () => {
    if (!activeFile) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/files/${activeFile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (data.ok) {
        setOriginalContent(content);
      }
    } catch (e) {
      console.error('Failed to save:', e);
    } finally {
      setSaving(false);
    }
  };

  // 새 파일 생성
  const createFile = async () => {
    if (!newFileName.trim()) return;
    try {
      const res = await fetch(`/api/admin/files?slug=${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: newFileName.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowNewFile(false);
        setNewFileName('');
        loadFiles();
      }
    } catch (e) {
      console.error('Failed to create file:', e);
    }
  };

  // 파일 삭제
  const deleteFile = async (file: SiteFile) => {
    if (file.isEntry) return;
    if (!confirm(`${file.filename}을(를) 삭제하시겠습니까?`)) return;
    try {
      await fetch(`/api/admin/files/${file.id}`, { method: 'DELETE' });
      if (activeFile?.id === file.id) {
        setActiveFile(null);
        setContent('');
      }
      loadFiles();
    } catch (e) {
      console.error('Failed to delete:', e);
    }
  };

  // 치환코드 삽입
  const insertVariable = (code: string) => {
    if (!textareaRef.current) return;
    const ta = textareaRef.current;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newContent = content.substring(0, start) + code + content.substring(end);
    setContent(newContent);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + code.length, start + code.length);
    }, 0);
  };

  // Ctrl+S 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [content, activeFile]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const hasChanges = content !== originalContent;
  const fileTypeIcon = (type: string) => {
    switch (type) {
      case 'html': return '📄';
      case 'css': return '🎨';
      case 'js': return '⚡';
      case 'image': return '🖼️';
      default: return '📁';
    }
  };

  const groupedVars = variables.reduce<Record<string, Variable[]>>((acc, v) => {
    (acc[v.category] = acc[v.category] || []).push(v);
    return acc;
  }, {});

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1e1e1e', color: '#ccc' }}>로딩 중...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1e1e1e', color: '#d4d4d4', fontFamily: "'Pretendard Variable', monospace" }}>
      {/* 상단 바 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: '#252526', borderBottom: '1px solid #3c3c3c', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href={`/admin/${slug}`} style={{ color: '#888', fontSize: 13, textDecoration: 'none' }}>← 어드민</a>
          <span style={{ color: '#ccc', fontWeight: 700, fontSize: 14 }}>코드 에디터</span>
          {skin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 12, marginLeft: 4, borderLeft: '1px solid #3c3c3c' }}>
              <span style={{ color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>스킨</span>
              <input
                value={skinNameInput}
                onChange={e => setSkinNameInput(e.target.value)}
                onBlur={saveSkinName}
                onKeyDown={e => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') {
                    setSkinNameInput(skin.name);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                disabled={skinSaving}
                title={`#${skin.id} · slug: ${skin.slug} · 클릭하여 이름 수정 (Enter 저장, Esc 취소)`}
                placeholder="스킨 이름"
                style={{
                  background: '#3c3c3c',
                  border: '1px solid #4a4a4a',
                  borderRadius: 4,
                  padding: '4px 8px',
                  color: '#e0e0e0',
                  fontSize: 13,
                  fontWeight: 600,
                  outline: 'none',
                  minWidth: 160,
                  opacity: skinSaving ? 0.5 : 1,
                }}
              />
              <span style={{ color: '#666', fontSize: 11 }}>#{skin.id}</span>
              {skinSaving && <span style={{ color: '#888', fontSize: 11 }}>저장 중…</span>}
            </div>
          )}
          {activeFile && <span style={{ color: '#888', fontSize: 13 }}>{activeFile.filename}{hasChanges ? ' •' : ''}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowVars(!showVars)} style={btnStyle(showVars)}>
            {'{ }'} 치환코드
          </button>
          <button onClick={() => setShowPreview(!showPreview)} style={btnStyle(showPreview)}>
            미리보기
          </button>
          <button onClick={saveFile} disabled={!hasChanges || saving} style={{ ...btnStyle(false), background: hasChanges ? '#0e639c' : '#3c3c3c', color: hasChanges ? '#fff' : '#888' }}>
            {saving ? '저장 중...' : '저장 (Ctrl+S)'}
          </button>
          <a href={`/${slug}`} target="_blank" rel="noopener" style={{ ...btnStyle(false), textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            사이트 보기 ↗
          </a>
        </div>
      </div>

      {/* 메인 영역 */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* 파일 트리 */}
        <div style={{ width: 220, background: '#252526', borderRight: '1px solid #3c3c3c', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '10px 12px', fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>파일</span>
            <button onClick={() => setShowNewFile(!showNewFile)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 16, padding: 0 }}>+</button>
          </div>
          {showNewFile && (
            <div style={{ padding: '4px 12px', display: 'flex', gap: 4 }}>
              <input
                value={newFileName}
                onChange={e => setNewFileName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createFile()}
                placeholder="파일명.html"
                style={{ flex: 1, background: '#3c3c3c', border: '1px solid #555', borderRadius: 3, padding: '4px 8px', color: '#ccc', fontSize: 12, outline: 'none' }}
                autoFocus
              />
              <button onClick={createFile} style={{ background: '#0e639c', color: '#fff', border: 'none', borderRadius: 3, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>추가</button>
            </div>
          )}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {files.map(f => (
              <div
                key={f.id}
                onClick={() => loadFileContent(f)}
                style={{
                  padding: '6px 12px',
                  fontSize: 13,
                  cursor: 'pointer',
                  background: activeFile?.id === f.id ? '#37373d' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>
                  <span style={{ marginRight: 6 }}>{fileTypeIcon(f.fileType)}</span>
                  {f.filename}
                </span>
                {!f.isEntry && (
                  <button
                    onClick={e => { e.stopPropagation(); deleteFile(f); }}
                    style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 12, padding: '0 4px' }}
                    title="삭제"
                  >✕</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 코드 편집기 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {activeFile ? (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={e => setContent(e.target.value)}
              spellCheck={false}
              style={{
                flex: 1,
                background: '#1e1e1e',
                color: '#d4d4d4',
                border: 'none',
                outline: 'none',
                padding: 16,
                fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
                fontSize: 14,
                lineHeight: 1.6,
                resize: 'none',
                tabSize: 2,
                whiteSpace: 'pre',
                overflowWrap: 'normal',
                overflowX: 'auto',
              }}
            />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
              파일을 선택하세요
            </div>
          )}
        </div>

        {/* 치환코드 패널 */}
        {showVars && (
          <div style={{ width: 280, background: '#252526', borderLeft: '1px solid #3c3c3c', overflow: 'auto', flexShrink: 0 }}>
            <div style={{ padding: '10px 12px', fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>치환코드</div>
            {Object.entries(groupedVars).map(([category, vars]) => (
              <div key={category}>
                <div style={{ padding: '8px 12px 4px', fontSize: 11, color: '#888', fontWeight: 600 }}>{category}</div>
                {vars.map(v => (
                  <div
                    key={v.code}
                    onClick={() => insertVariable(v.code)}
                    style={{ padding: '6px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid #2d2d2d' }}
                    title={`클릭하여 삽입: ${v.code}`}
                  >
                    <code style={{ color: '#9cdcfe', fontSize: 11 }}>{v.code}</code>
                    <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>{v.description}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* 미리보기 */}
        {showPreview && (
          <div style={{ width: '40%', borderLeft: '1px solid #3c3c3c', flexShrink: 0 }}>
            <iframe
              src={`/${slug}`}
              style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
              title="미리보기"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function btnStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? '#37373d' : '#3c3c3c',
    color: '#ccc',
    border: '1px solid #555',
    borderRadius: 4,
    padding: '4px 12px',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
}
