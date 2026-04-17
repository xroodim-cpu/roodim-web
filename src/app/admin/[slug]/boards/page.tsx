'use client';

import { useState, useEffect, FormEvent } from 'react';
import dynamic from 'next/dynamic';

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), { ssr: false });

/* ── 타입 ── */
interface WbMember {
  id: number;
  siteId: string;
  role: string;
  customerName: string | null;
  adminCustomerId: number | null;
  invitedAt: string;
}
interface AvailableSite {
  id: string;
  name: string;
  slug: string;
  adminCustomerId: number | null;
}

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
  // 문의게시판 답변 (inquiry 한정 — 공개 노출 안 함)
  replyContent?: string | null;
  repliedAt?: string | null;
  repliedBy?: string | null;
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
  // 문의게시판 답변 (inquiry 한정)
  const [postReplyContent, setPostReplyContent] = useState('');
  const [replySaving, setReplySaving] = useState(false);

  // 게시판 추가 모달
  const [showAddBoard, setShowAddBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardSlug, setNewBoardSlug] = useState('');

  // 사이드바 모바일
  const [sideOpen, setSideOpen] = useState(false);

  // 멤버 관리
  const [wbMembers, setWbMembers] = useState<WbMember[]>([]);
  const [availableSites, setAvailableSites] = useState<AvailableSite[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteSiteId, setInviteSiteId] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');

  useEffect(() => {
    params.then(({ slug: s }) => setSlug(s));
  }, [params]);

  useEffect(() => {
    if (slug) {
      loadBoards();
      loadMembers();
    }
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

  /* ── 멤버 관리 ── */

  async function loadMembers() {
    if (!slug) return;
    try {
      const res = await fetch(`/api/admin/boards/members?slug=${slug}`);
      const data = await res.json();
      if (res.ok && data.ok) {
        setWbMembers(data.members || []);
        setAvailableSites(data.availableSites || []);
      }
    } catch {
      // ignore
    }
  }

  async function inviteMember(e: FormEvent) {
    e.preventDefault();
    if (!slug || !inviteSiteId) return;
    const site = availableSites.find(s => s.id === inviteSiteId);
    try {
      const res = await fetch('/api/admin/boards/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          siteId: inviteSiteId,
          role: inviteRole,
          customerName: site?.name || null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setShowInvite(false);
        setInviteSiteId('');
        setInviteRole('viewer');
        loadMembers();
      } else {
        alert(data.error || '초대 실패');
      }
    } catch {
      alert('초대 실패');
    }
  }

  async function removeMember(memberId: number, name: string) {
    if (!slug) return;
    if (!confirm(`${name || '멤버'}를 제거하시겠습니까?`)) return;
    try {
      await fetch(`/api/admin/boards/members?slug=${slug}&memberId=${memberId}`, {
        method: 'DELETE',
      });
      loadMembers();
    } catch {
      alert('제거 실패');
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
    setPostReplyContent('');
    setPanelOpen(true);
  }

  function openEditPost(post: Post) {
    setEditingPost(post);
    setPostTitle(post.title);
    setPostContent(post.content || '');
    setPostPinned(post.isPinned);
    setPostReplyContent(post.replyContent || '');
    setPanelOpen(true);
  }

  /**
   * 문의 답변 저장 — 본문 수정과 분리된 엔드포인트 호출.
   * `replyContent` 만 보내 PUT 이 해당 필드 + replied_at/by 만 갱신하게 함.
   */
  async function handleSaveReply() {
    if (!slug || !activeBoardId || !editingPost) return;
    setReplySaving(true);
    try {
      const res = await fetch(
        `/api/admin/boards/${activeBoardId}/posts/${editingPost.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, replyContent: postReplyContent }),
        },
      );
      const data = await res.json();
      if (res.ok) {
        // 로컬 상태 갱신 — 목록에 뱃지 바로 반영
        setPosts((prev) =>
          prev.map((p) =>
            p.id === editingPost.id
              ? {
                  ...p,
                  replyContent: data.post?.replyContent ?? postReplyContent,
                  repliedAt: data.post?.repliedAt ?? new Date().toISOString(),
                  repliedBy: data.post?.repliedBy ?? null,
                }
              : p,
          ),
        );
        setEditingPost((prev) =>
          prev
            ? {
                ...prev,
                replyContent: data.post?.replyContent ?? postReplyContent,
                repliedAt: data.post?.repliedAt ?? new Date().toISOString(),
                repliedBy: data.post?.repliedBy ?? null,
              }
            : prev,
        );
      } else {
        alert(data.error || '답변 저장 실패');
      }
    } catch {
      alert('답변 저장 실패');
    } finally {
      setReplySaving(false);
    }
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
  const pinnedCount = posts.filter((p) => p.isPinned).length;

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
      <div className="bd-page-wrap">
        {/* 사이드바 — 게시판 목록 */}
        <aside className={`bd-side wb-side${sideOpen ? ' open' : ''}`}>
          <div className="bd-side-heading">게시판</div>

          <div className="pd-side-group">
            {boards.map((b) => (
              <div key={b.id} className="bd-side-row">
                <button
                  type="button"
                  className={`pd-side-group-label bd-side-btn${activeBoardId === b.id ? ' active' : ''}`}
                  onClick={() => {
                    setActiveBoardId(b.id);
                    setFilter('all');
                    setSideOpen(false);
                  }}
                >
                  {b.boardType === 'system' && <span className="bd-side-pin">📌</span>}
                  <span className="bd-side-name">{b.name}</span>
                  <span className="pd-side-group-count">{b.postCount}</span>
                </button>
                {b.boardType === 'custom' && (
                  <button
                    type="button"
                    className="bd-side-delete"
                    onClick={() => handleDeleteBoard(b.id)}
                    title="게시판 삭제"
                    aria-label="게시판 삭제"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* 게시판 추가 */}
          <div className="bd-side-add">
            {showAddBoard ? (
              <form onSubmit={handleAddBoard} className="bd-side-add-form">
                <input
                  className="form-input"
                  placeholder="게시판 이름"
                  value={newBoardName}
                  onChange={(e) => {
                    setNewBoardName(e.target.value);
                    setNewBoardSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9가-힣]/g, '-')
                        .replace(/-+/g, '-')
                    );
                  }}
                  autoFocus
                />
                <input
                  className="form-input"
                  placeholder="슬러그 (영문)"
                  value={newBoardSlug}
                  onChange={(e) => setNewBoardSlug(e.target.value)}
                />
                <div className="bd-side-add-actions">
                  <button type="submit" className="btn btn-primary btn-sm">
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
                className="btn btn-secondary btn-sm bd-side-add-btn"
                onClick={() => setShowAddBoard(true)}
              >
                + 게시판 추가
              </button>
            )}
          </div>

          {/* 멤버 관리 */}
          <div className="bd-side-members">
            <div className="bd-side-heading" style={{ marginTop: 8 }}>
              멤버
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 6 }}>{wbMembers.length}</span>
            </div>
            <div className="pd-side-group">
              {wbMembers.length === 0 ? (
                <div style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-tertiary)' }}>
                  초대된 멤버가 없습니다.
                </div>
              ) : (
                wbMembers.map((m) => (
                  <div key={m.id} className="bd-side-row" style={{ alignItems: 'center' }}>
                    <span className="bd-side-name" style={{ flex: 1, fontSize: 13 }}>
                      {m.customerName || '(이름 없음)'}
                    </span>
                    <span style={{
                      fontSize: 11, padding: '1px 6px', borderRadius: 4,
                      background: m.role === 'editor' ? '#e8f5e9' : '#e3f2fd',
                      color: m.role === 'editor' ? '#2e7d32' : '#1565c0',
                    }}>
                      {m.role === 'editor' ? '편집' : '열람'}
                    </span>
                    <button
                      type="button"
                      className="bd-side-delete"
                      onClick={() => removeMember(m.id, m.customerName || '')}
                      title="멤버 제거"
                      aria-label="멤버 제거"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* 멤버 초대 */}
            <div className="bd-side-add">
              {showInvite ? (
                <form onSubmit={inviteMember} className="bd-side-add-form">
                  <select
                    className="form-input"
                    value={inviteSiteId}
                    onChange={(e) => setInviteSiteId(e.target.value)}
                    required
                    style={{ fontSize: 13 }}
                  >
                    <option value="">사이트 선택</option>
                    {availableSites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.slug})
                      </option>
                    ))}
                  </select>
                  <select
                    className="form-input"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    style={{ fontSize: 13 }}
                  >
                    <option value="viewer">열람자</option>
                    <option value="editor">편집자</option>
                  </select>
                  <div className="bd-side-add-actions">
                    <button type="submit" className="btn btn-primary btn-sm">초대</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowInvite(false)}>취소</button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm bd-side-add-btn"
                  onClick={() => setShowInvite(true)}
                >
                  + 멤버 초대
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* 메인 — 게시물 목록 */}
        <main className="bd-main">
          {/* 페이지 헤더 */}
          <div className="bd-page-header">
            <div className="bd-page-header-left">
              <button
                type="button"
                className="btn btn-ghost btn-sm bd-side-toggle"
                onClick={() => setSideOpen((v) => !v)}
                aria-label="게시판 목록 열기"
              >
                ☰
              </button>
              <div>
                <h1 className="c-page-title">
                  {activeBoard ? activeBoard.name : '게시판'}
                </h1>
                <p className="c-page-subtitle">
                  {activeBoard?.description ||
                    '게시판과 게시물을 관리합니다. 시스템 게시판(문의·Q&A)은 자동 생성됩니다.'}
                </p>
              </div>
            </div>
            {activeBoard && (
              <button type="button" className="btn btn-primary btn-sm" onClick={openNewPost}>
                글쓰기
              </button>
            )}
          </div>

          {error && (
            <div className="c-alert c-alert-error" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}

          {activeBoard && (
            <>
              {/* 탭 필터 */}
              <div className="pd-filter">
                <div className="pd-filter-tabs">
                  <button
                    type="button"
                    className={`pd-ftab${filter === 'all' ? ' active' : ''}`}
                    onClick={() => setFilter('all')}
                  >
                    전체
                    <span className="pd-ftab-count">{totalPosts}</span>
                  </button>
                  <button
                    type="button"
                    className={`pd-ftab${filter === 'pinned' ? ' active' : ''}`}
                    onClick={() => setFilter('pinned')}
                  >
                    공지
                    {filter === 'pinned' && (
                      <span className="pd-ftab-count">{pinnedCount}</span>
                    )}
                  </button>
                </div>
              </div>

              {/* 게시물 테이블 */}
              <div
                className="card"
                style={{ border: '1px solid var(--border)', overflow: 'hidden' }}
              >
                {postsLoading ? (
                  <div className="c-empty">
                    <div className="spinner" style={{ margin: '0 auto 12px' }} />
                    <div className="c-empty-text">로딩 중...</div>
                  </div>
                ) : posts.length === 0 ? (
                  <div className="c-empty">
                    <div className="c-empty-icon">📝</div>
                    <div className="c-empty-text">게시물이 없습니다.</div>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table className="c-table">
                      <thead>
                        <tr>
                          <th>제목</th>
                          <th style={{ width: 120 }}>작성자</th>
                          <th style={{ width: 100 }}>날짜</th>
                          <th style={{ width: 80, textAlign: 'right' }}>조회</th>
                          <th style={{ width: 80, textAlign: 'right' }}>관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {posts.map((post) => (
                          <tr
                            key={post.id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => openEditPost(post)}
                          >
                            <td style={{ fontWeight: 'var(--fw-semi)' }}>
                              {post.isPinned && (
                                <span
                                  className="c-badge c-badge-accent"
                                  style={{ marginRight: 6 }}
                                >
                                  공지
                                </span>
                              )}
                              {isInquiry && (
                                post.replyContent ? (
                                  <span
                                    className="c-badge"
                                    style={{
                                      marginRight: 6,
                                      background: '#e8f5e9',
                                      color: '#2e7d32',
                                    }}
                                  >
                                    ✓ 답변완료
                                  </span>
                                ) : (
                                  <span
                                    className="c-badge"
                                    style={{
                                      marginRight: 6,
                                      background: '#fff3e0',
                                      color: '#e65100',
                                    }}
                                  >
                                    ⏳ 미답변
                                  </span>
                                )
                              )}
                              {post.title}
                            </td>
                            <td style={{ color: 'var(--text-secondary)' }}>
                              {post.authorName || '—'}
                            </td>
                            <td style={{ color: 'var(--text-tertiary)' }}>
                              {new Date(post.createdAt).toLocaleDateString('ko-KR', {
                                month: '2-digit',
                                day: '2-digit',
                              })}
                            </td>
                            <td
                              style={{
                                color: 'var(--text-tertiary)',
                                textAlign: 'right',
                              }}
                            >
                              {post.viewCount}
                            </td>
                            <td
                              style={{ textAlign: 'right' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDeletePost(post.id)}
                              >
                                삭제
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="bd-pagination">
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
            <div className="slide-panel-title">
              {editingPost ? '게시물 수정' : '새 게시물'}
            </div>
            <button
              type="button"
              className="slide-panel-close btn-icon"
              onClick={() => setPanelOpen(false)}
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
          <form onSubmit={handleSavePost} className="slide-panel-body">
            {/* 문의 게시판 — formData 표시 */}
            {editingPost && isInquiry && editingPost.formData && (
              <div className="form-group bd-inquiry-data">
                <label className="form-label">접수 정보</label>
                <div className="bd-inquiry-list">
                  {Object.entries(editingPost.formData).map(([key, val]) => (
                    <div key={key} className="bd-inquiry-row">
                      <span className="bd-inquiry-key">{key}</span>
                      <span className="bd-inquiry-val">{val}</span>
                    </div>
                  ))}
                </div>
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

            <div className="form-group bd-pin-row">
              <input
                type="checkbox"
                id="post-pinned"
                checked={postPinned}
                onChange={(e) => setPostPinned(e.target.checked)}
              />
              <label htmlFor="post-pinned">공지로 고정</label>
            </div>

            {/* 문의 답변 — inquiry 게시판 & 기존 글 수정 시에만 */}
            {editingPost && isInquiry && (
              <div
                className="form-group"
                style={{
                  borderTop: '1px solid var(--border)',
                  paddingTop: 20,
                  marginTop: 8,
                }}
              >
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>답변</span>
                  {editingPost.repliedAt && (
                    <span
                      className="c-badge"
                      style={{
                        background: '#e8f5e9',
                        color: '#2e7d32',
                        fontSize: 11,
                        fontWeight: 'normal',
                      }}
                    >
                      {new Date(editingPost.repliedAt).toLocaleString('ko-KR')}
                      {editingPost.repliedBy ? ` · ${editingPost.repliedBy}` : ''}
                    </span>
                  )}
                </label>
                <RichTextEditor
                  value={postReplyContent}
                  onChange={setPostReplyContent}
                  placeholder="답변을 입력하세요. (공개 사이트에는 노출되지 않습니다)"
                  minHeight={200}
                />
                <p
                  style={{
                    margin: '6px 0 0',
                    fontSize: 12,
                    color: 'var(--text-tertiary)',
                  }}
                >
                  답변은 어드민에서만 확인됩니다. 방문자에게는 노출되지 않습니다.
                </p>
                <div style={{ marginTop: 10, textAlign: 'right' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveReply}
                    disabled={replySaving}
                  >
                    {replySaving ? '저장 중...' : '답변 저장'}
                  </button>
                </div>
              </div>
            )}

            <div className="bd-form-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setPanelOpen(false)}
              >
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
        <div className="wb-side-overlay show" onClick={() => setSideOpen(false)} />
      )}
    </>
  );
}
