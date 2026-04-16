'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import dynamic from 'next/dynamic';

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), { ssr: false });

/* ── 타입 ── */
interface Board {
  id: number;
  name: string;
  slug: string;
  boardType: 'system' | 'custom';
  systemKey: string | null;
  description: string | null;
  postCount: number;
  isActive: boolean;
}
interface Post {
  id: number;
  boardId: number;
  title: string;
  content: string | null;
  authorName: string | null;
  authorEmail: string | null;
  authorPhone: string | null;
  formData: Record<string, string> | null;
  isVisible: boolean;
  isPinned: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function BoardsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [slug, setSlug] = useState<string | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pinned'>('all');

  // 슬라이드 패널 상태
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postPinned, setPostPinned] = useState(false);
  const [postSaving, setPostSaving] = useState(false);

  // 게시판 추가 모달
  const [showAddBoard, setShowAddBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardSlug, setNewBoardSlug] = useState('');

  // 사이드바 모바일
  const [sideOpen, setSideOpen] = useState(false);

  useEffect(() => {
    params.then(({ slug: s }) => setSlug(s));
  }, [params]);

  useEffect(() => {
    if (slug) loadBoards();
  }, [slug]);

  useEffect(() => {
    if (activeBoardId && slug) loadPosts(1);
  }, [activeBoardId, filter]);

  /* ── 데이터 로드 ── */

  async function loadBoards() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/boards?slug=${slug}`);
      const data = await res.json();
      if (res.ok && data.boards) {
        setBoards(data.boards);
        if (data.boards.length > 0 && !activeBoardId) {
          setActiveBoardId(data.boards[0].id);
        }
      } else {
        setError(data.error || '게시판 목록 로딩 실패');
      }
    } catch {
      setError('게시판 목록 로딩 실패');
    } finally {
      setLoading(false);
    }
  }

  async function loadPosts(p: number) {
    if (!activeBoardId || !slug) return;
    setPostsLoading(true);
    try {
      const pinnedParam = filter === 'pinned' ? '&pinned=true' : '';
      const res = await fetch(
        `/api/admin/boards/${activeBoardId}/posts?slug=${slug}&page=${p}&limit=20${pinnedParam}`
      );
      const data = await res.json();
      if (res.ok) {
        setPosts(data.posts || []);
        setTotalPosts(data.total || 0);
        setPage(p);
      }
    } catch {
      // ignore
    } finally {
      setPostsLoading(false);
    }
  }

  /* ── 게시판 추가 ── */

  async function handleAddBoard(e: FormEvent) {
    e.preventDefault();
    if (!slug || !newBoardName || !newBoardSlug) return;
    try {
      const res = await fetch('/api/admin/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, name: newBoardName, boardSlug: newBoardSlug, description: '' }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowAddBoard(false);
        setNewBoardName('');
        setNewBoardSlug('');
        await loadBoards();
        if (data.board) setActiveBoardId(data.board.id);
      } else {
        alert(data.error || '게시판 추가 실패');
      }
    } catch {
      alert('게시판 추가 실패');
    }
  }

  async function handleDeleteBoard(boardId: number) {
    if (!slug) return;
    if (!confirm('이 게시판과 모든 게시물이 삭제됩니다. 계속하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/admin/boards/${boardId}?slug=${slug}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        await loadBoards();
        if (activeBoardId === boardId) setActiveBoardId(boards[0]?.id || null);
      } else {
        alert(data.error || '삭제 실패');
      }
    } catch {
      alert('삭제 실패');
    }
  }

  /* ── 게시물 CRUD ── */

  function openNewPost() {
    setEditingPost(null);
    setPostTitle('');
    setPostContent('');
    setPostPinned(false);
    setPanelOpen(true);
  }

  function openEditPost(post: Post) {
    setEditingPost(post);
    setPostTitle(post.title);
    setPostContent(post.content || '');
    setPostPinned(post.isPinned);
    setPanelOpen(true);
  }

  async function handleSavePost(e: FormEvent) {
    e.preventDefault();
    if (!slug || !activeBoardId || !postTitle.trim()) return;
    setPostSaving(true);
    try {
      const url = editingPost
        ? `/api/admin/boards/${activeBoardId}/posts/${editingPost.id}`
        : `/api/admin/boards/${activeBoardId}/posts`;
      const method = editingPost ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          title: postTitle,
          content: postContent,
          isPinned: postPinned,
        }),
      });
      if (res.ok) {
        setPanelOpen(false);
        loadPosts(page);
        loadBoards(); // postCount 갱신
      } else {
        const data = await res.json();
        alert(data.error || '저장 실패');
      }
    } catch {
      alert('저장 실패');
    } finally {
      setPostSaving(false);
    }
  }

  async function handleDeletePost(postId: number) {
    if (!slug || !activeBoardId) return;
    if (!confirm('게시물을 삭제하시겠습니까?')) return;
    try {
      await fetch(`/api/admin/boards/${activeBoardId}/posts/${postId}?slug=${slug}`, {
        method: 'DELETE',
      });
      loadPosts(page);
      loadBoards();
    } catch {
      alert('삭제 실패');
    }
  }

  /* ── 렌더 ── */

  const activeBoard = boards.find((b) => b.id === activeBoardId);
  const isInquiry = activeBoard?.systemKey === 'inquiry';
  const totalPages = Math.ceil(totalPosts / 20);

  if (!slug || loading) {
    return (
      <div className="c-empty">
        <div className="spinner" style={{ margin: '0 auto 12px' }} />
        <div className="c-empty-text">로딩 중...</div>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 className="c-page-title">게시판</h1>
        <p className="c-page-subtitle">
          게시판과 게시물을 관리합니다. 시스템 게시판(문의, Q&A)은 자동으로
          생성되며 삭제할 수 없습니다.
        </p>
      </div>

      {error && (
        <div className="c-alert c-alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="wb-wrap" style={{ minHeight: 480 }}>
        {/* 사이드바 — 게시판 목록 */}
        <aside className={`wb-side${sideOpen ? ' open' : ''}`}>
          <div
            style={{
              fontSize: 'var(--fs-xs)',
              fontWeight: 'var(--fw-bold)',
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              padding: '0 12px 12px',
              borderBottom: '1px solid var(--border)',
              marginBottom: 12,
            }}
          >
            게시판
          </div>

          <div className="pd-side-group">
            {boards.map((b) => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  className={`pd-side-group-label${activeBoardId === b.id ? ' active' : ''}`}
                  onClick={() => {
                    setActiveBoardId(b.id);
                    setFilter('all');
                    setSideOpen(false);
                  }}
                  style={{
                    flex: 1,
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    font: 'inherit',
                    padding: '8px 12px',
                  }}
                >
                  {b.boardType === 'system' && (
                    <span style={{ marginRight: 4, fontSize: 'var(--fs-xs)' }}>📌</span>
                  )}
                  {b.name}
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 'var(--fs-xs)',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    {b.postCount}
                  </span>
                </button>
                {b.boardType === 'custom' && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleDeleteBoard(b.id)}
                    style={{ padding: '2px 6px', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}
                    title="삭제"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* 게시판 추가 */}
          <div style={{ padding: '16px 12px 0', borderTop: '1px solid var(--border)', marginTop: 12 }}>
            {showAddBoard ? (
              <form onSubmit={handleAddBoard} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  className="form-input"
                  placeholder="게시판 이름"
                  value={newBoardName}
                  onChange={(e) => {
                    setNewBoardName(e.target.value);
                    setNewBoardSlug(e.target.value.toLowerCase().replace(/[^a-z0-9가-힣]/g, '-').replace(/-+/g, '-'));
                  }}
                  style={{ fontSize: 'var(--fs-xs)' }}
                  autoFocus
                />
                <input
                  className="form-input"
                  placeholder="슬러그 (영문)"
                  value={newBoardSlug}
                  onChange={(e) => setNewBoardSlug(e.target.value)}
                  style={{ fontSize: 'var(--fs-xs)' }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="submit" className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                    추가
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowAddBoard(false)}
                  >
                    취소
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAddBoard(true)}
                style={{ width: '100%' }}
              >
                + 게시판 추가
              </button>
            )}
          </div>
        </aside>

        {/* 메인 — 게시물 목록 */}
        <main className="wb-main" style={{ paddingTop: 0 }}>
          {activeBoard && (
            <>
              {/* 상단 바 */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 0',
                  borderBottom: '1px solid var(--border)',
                  marginBottom: 16,
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* 모바일 사이드바 토글 */}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm topnav-side-toggle"
                    onClick={() => setSideOpen((v) => !v)}
                    style={{ display: 'none' }}
                  >
                    ☰
                  </button>
                  <h2
                    style={{
                      fontSize: 'var(--fs-lg)',
                      fontWeight: 'var(--fw-bold)',
                      margin: 0,
                    }}
                  >
                    {activeBoard.name}
                  </h2>
                  {activeBoard.description && (
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                      {activeBoard.description}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={openNewPost}
                >
                  글쓰기
                </button>
              </div>

              {/* 탭 필터 */}
              <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
                {(['all', 'pinned'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      borderBottom: filter === f ? '2px solid var(--accent)' : '2px solid transparent',
                      background: 'none',
                      color: filter === f ? 'var(--accent)' : 'var(--text-secondary)',
                      fontWeight: filter === f ? 'var(--fw-bold)' : 'var(--fw-normal)',
                      fontSize: 'var(--fs-sm)',
                      cursor: 'pointer',
                    }}
                  >
                    {f === 'all' ? '전체' : '공지'}
                  </button>
                ))}
              </div>

              {/* 게시물 테이블 */}
              {postsLoading ? (
                <div className="c-empty">
                  <div className="spinner" style={{ margin: '0 auto 12px' }} />
                </div>
              ) : posts.length === 0 ? (
                <div className="c-empty">
                  <div className="c-empty-text">게시물이 없습니다.</div>
                </div>
              ) : (
                <table className="c-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '50%' }}>제목</th>
                      <th>작성자</th>
                      <th>날짜</th>
                      <th style={{ textAlign: 'right' }}>조회</th>
                      <th style={{ width: 60 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map((post) => (
                      <tr key={post.id}>
                        <td>
                          <button
                            type="button"
                            onClick={() => openEditPost(post)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              font: 'inherit',
                              textAlign: 'left',
                              fontWeight: 'var(--fw-medium)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {post.isPinned && (
                              <span
                                style={{
                                  display: 'inline-block',
                                  fontSize: 'var(--fs-xs)',
                                  color: 'var(--accent)',
                                  fontWeight: 'var(--fw-bold)',
                                  marginRight: 6,
                                  background: 'var(--status-error-bg)',
                                  padding: '1px 6px',
                                  borderRadius: 'var(--radius-sm)',
                                }}
                              >
                                공지
                              </span>
                            )}
                            {post.title}
                          </button>
                        </td>
                        <td style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
                          {post.authorName || '-'}
                        </td>
                        <td style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                          {new Date(post.createdAt).toLocaleDateString('ko-KR', {
                            month: '2-digit',
                            day: '2-digit',
                          })}
                        </td>
                        <td
                          style={{
                            fontSize: 'var(--fs-xs)',
                            color: 'var(--text-tertiary)',
                            textAlign: 'right',
                          }}
                        >
                          {post.viewCount}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleDeletePost(post.id)}
                            style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', padding: '2px 6px' }}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 4,
                    padding: '16px 0',
                  }}
                >
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => loadPosts(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* 슬라이드 패널 — 글 쓰기/수정 */}
      <div className={`slide-panel${panelOpen ? ' open' : ''}`}>
        <div className="slide-panel-overlay" onClick={() => setPanelOpen(false)} />
        <div className="slide-panel-content" style={{ width: 'min(640px, 90vw)' }}>
          <div className="slide-panel-header">
            <h3 className="slide-panel-title">
              {editingPost ? '게시물 수정' : '새 게시물'}
            </h3>
            <button
              type="button"
              className="slide-panel-close"
              onClick={() => setPanelOpen(false)}
            >
              ✕
            </button>
          </div>
          <form onSubmit={handleSavePost} className="slide-panel-body">
              {/* 문의 게시판 — formData 표시 */}
              {editingPost && isInquiry && editingPost.formData && (
                <div
                  className="form-group"
                  style={{
                    background: 'var(--bg-secondary)',
                    padding: 16,
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 16,
                  }}
                >
                  <label className="form-label" style={{ marginBottom: 8 }}>
                    접수 정보
                  </label>
                  {Object.entries(editingPost.formData).map(([key, val]) => (
                    <div
                      key={key}
                      style={{
                        display: 'flex',
                        gap: 8,
                        fontSize: 'var(--fs-sm)',
                        padding: '4px 0',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <span style={{ fontWeight: 'var(--fw-medium)', minWidth: 80, color: 'var(--text-secondary)' }}>
                        {key}
                      </span>
                      <span style={{ color: 'var(--text-primary)' }}>{val}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">제목</label>
                <input
                  className="form-input"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="제목을 입력하세요"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">내용</label>
                <RichTextEditor
                  value={postContent}
                  onChange={setPostContent}
                  placeholder="내용을 입력하세요..."
                  minHeight={280}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="post-pinned"
                  checked={postPinned}
                  onChange={(e) => setPostPinned(e.target.checked)}
                />
                <label htmlFor="post-pinned" style={{ fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
                  공지로 고정
                </label>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setPanelOpen(false)}>
                  취소
                </button>
                <button type="submit" className="btn btn-primary" disabled={postSaving}>
                  {postSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
        </div>
      </div>

      {/* 사이드바 오버레이 */}
      {sideOpen && (
        <div
          className="wb-side-overlay show"
          onClick={() => setSideOpen(false)}
        />
      )}
    </>
  );
}
