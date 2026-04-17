'use client';

import { useState, useEffect } from 'react';

/* ── 타입 ── */
interface Workboard {
  id: number;
  name: string;
  slug: string;
  ownerSiteId: string | null;
  role: string;
  ownerSiteName: string | null;
  createdAt: string;
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
  title: string;
  content: string | null;
  authorName: string | null;
  authorEmail: string | null;
  isVisible: boolean;
  isPinned: boolean;
  viewCount: number;
  replyContent?: string | null;
  repliedAt?: string | null;
  repliedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function WorkboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [slug, setSlug] = useState<string | null>(null);
  const [workboards, setWorkboards] = useState<Workboard[]>([]);
  const [activeWbId, setActiveWbId] = useState<number | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
  const [wbName, setWbName] = useState('');
  const [myRole, setMyRole] = useState('viewer');
  const [posts, setPosts] = useState<Post[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);

  // 슬라이드 패널
  const [panelOpen, setPanelOpen] = useState(false);
  const [viewingPost, setViewingPost] = useState<Post | null>(null);

  // 사이드바 모바일
  const [sideOpen, setSideOpen] = useState(false);

  useEffect(() => {
    params.then(({ slug: s }) => setSlug(s));
  }, [params]);

  useEffect(() => {
    if (slug) loadWorkboards();
  }, [slug]);

  useEffect(() => {
    if (activeWbId && slug) loadBoards();
  }, [activeWbId]);

  useEffect(() => {
    if (activeBoardId && activeWbId && slug) loadPosts(1);
  }, [activeBoardId]);

  /* ── 데이터 로드 ── */

  async function loadWorkboards() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/workboard?slug=${slug}`);
      const data = await res.json();
      if (res.ok && data.workboards) {
        setWorkboards(data.workboards);
        if (data.workboards.length > 0 && !activeWbId) {
          setActiveWbId(data.workboards[0].id);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function loadBoards() {
    if (!activeWbId || !slug) return;
    try {
      const res = await fetch(`/api/admin/workboard/${activeWbId}/boards?slug=${slug}`);
      const data = await res.json();
      if (res.ok && data.boards) {
        setBoards(data.boards);
        setWbName(data.workboardName || '');
        setMyRole(data.role || 'viewer');
        if (data.boards.length > 0) {
          setActiveBoardId(data.boards[0].id);
        } else {
          setActiveBoardId(null);
          setPosts([]);
        }
      }
    } catch {
      // ignore
    }
  }

  async function loadPosts(p: number) {
    if (!activeWbId || !activeBoardId || !slug) return;
    setPostsLoading(true);
    try {
      const res = await fetch(
        `/api/admin/workboard/${activeWbId}/boards/${activeBoardId}/posts?slug=${slug}&page=${p}`
      );
      const data = await res.json();
      if (res.ok) {
        setPosts(data.posts || []);
        setTotalPosts(data.pagination?.total ?? 0);
        setPage(p);
      }
    } catch {
      // ignore
    } finally {
      setPostsLoading(false);
    }
  }

  function openPost(post: Post) {
    setViewingPost(post);
    setPanelOpen(true);
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

  if (workboards.length === 0) {
    return (
      <div className="c-empty">
        <div className="c-empty-icon">📋</div>
        <div className="c-empty-text">참여 중인 워크보드가 없습니다.</div>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>
          조직 관리자가 워크보드에 초대하면 여기에 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bd-page-wrap">
        {/* 사이드바 — 워크보드 + 게시판 목록 */}
        <aside className={`bd-side wb-side${sideOpen ? ' open' : ''}`}>
          {/* 워크보드 선택 (다수일 때) */}
          {workboards.length > 1 && (
            <>
              <div className="bd-side-heading">워크보드</div>
              <div className="pd-side-group" style={{ marginBottom: 16 }}>
                {workboards.map((wb) => (
                  <button
                    key={wb.id}
                    type="button"
                    className={`pd-side-group-label bd-side-btn${activeWbId === wb.id ? ' active' : ''}`}
                    onClick={() => {
                      setActiveWbId(wb.id);
                      setSideOpen(false);
                    }}
                  >
                    <span className="bd-side-name">{wb.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* 게시판 목록 */}
          <div className="bd-side-heading">게시판</div>
          <div className="pd-side-group">
            {boards.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`pd-side-group-label bd-side-btn${activeBoardId === b.id ? ' active' : ''}`}
                onClick={() => {
                  setActiveBoardId(b.id);
                  setSideOpen(false);
                }}
              >
                {b.boardType === 'system' && <span className="bd-side-pin">📌</span>}
                <span className="bd-side-name">{b.name}</span>
                <span className="pd-side-group-count">{b.postCount}</span>
              </button>
            ))}
            {boards.length === 0 && (
              <div style={{ padding: '12px', color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>
                게시판이 없습니다.
              </div>
            )}
          </div>

          {/* 내 역할 표시 */}
          <div style={{
            marginTop: 'auto',
            padding: '12px',
            borderTop: '1px solid var(--border)',
            fontSize: 'var(--fs-xs)',
            color: 'var(--text-tertiary)',
          }}>
            내 역할: <span style={{
              fontWeight: 'var(--fw-semi)' as never,
              color: myRole === 'editor' ? 'var(--primary)' : 'var(--text-secondary)',
            }}>
              {myRole === 'editor' ? '편집자' : '열람자'}
            </span>
          </div>
        </aside>

        {/* 메인 — 게시물 목록 */}
        <main className="bd-main">
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
                  {wbName && <span style={{ color: 'var(--text-tertiary)', fontWeight: 'var(--fw-normal)' as never }}>워크보드 — </span>}
                  {activeBoard ? activeBoard.name : '게시판'}
                </h1>
                <p className="c-page-subtitle">
                  {activeBoard?.description || '워크보드를 통해 공유된 게시판입니다.'}
                </p>
              </div>
            </div>
          </div>

          {activeBoard && (
            <>
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
                        </tr>
                      </thead>
                      <tbody>
                        {posts.map((post) => (
                          <tr
                            key={post.id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => openPost(post)}
                          >
                            <td style={{ fontWeight: 'var(--fw-semi)' }}>
                              {post.isPinned && (
                                <span className="c-badge c-badge-accent" style={{ marginRight: 6 }}>
                                  공지
                                </span>
                              )}
                              {isInquiry && (
                                post.replyContent ? (
                                  <span
                                    className="c-badge"
                                    style={{ marginRight: 6, background: '#e8f5e9', color: '#2e7d32' }}
                                  >
                                    답변완료
                                  </span>
                                ) : (
                                  <span
                                    className="c-badge"
                                    style={{ marginRight: 6, background: '#fff3e0', color: '#e65100' }}
                                  >
                                    미답변
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
                            <td style={{ color: 'var(--text-tertiary)', textAlign: 'right' }}>
                              {post.viewCount}
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

      {/* 슬라이드 패널 — 글 상세 보기 */}
      <div className={`slide-panel${panelOpen ? ' open' : ''}`}>
        <div className="slide-panel-overlay" onClick={() => setPanelOpen(false)} />
        <div className="slide-panel-content" style={{ width: 'min(640px, 90vw)' }}>
          <div className="slide-panel-header">
            <div className="slide-panel-title">
              {viewingPost?.title || '게시물 상세'}
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
          <div className="slide-panel-body">
            {viewingPost && (
              <>
                {/* 메타 정보 */}
                <div style={{
                  display: 'flex',
                  gap: 16,
                  marginBottom: 16,
                  fontSize: 'var(--fs-sm)',
                  color: 'var(--text-secondary)',
                }}>
                  <span>작성자: {viewingPost.authorName || '—'}</span>
                  <span>날짜: {new Date(viewingPost.createdAt).toLocaleDateString('ko-KR')}</span>
                  <span>조회: {viewingPost.viewCount}</span>
                </div>

                {/* 본문 */}
                <div
                  className="bd-post-content"
                  style={{
                    padding: 16,
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius)',
                    minHeight: 120,
                    lineHeight: 1.7,
                  }}
                  dangerouslySetInnerHTML={{ __html: viewingPost.content || '<p style="color:var(--text-tertiary)">내용 없음</p>' }}
                />

                {/* 답변 표시 (문의게시판) */}
                {isInquiry && viewingPost.replyContent && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{
                      fontSize: 'var(--fs-sm)',
                      fontWeight: 'var(--fw-semi)' as never,
                      color: '#2e7d32',
                      marginBottom: 8,
                    }}>
                      답변 ({viewingPost.repliedBy || 'admin'} · {viewingPost.repliedAt ? new Date(viewingPost.repliedAt).toLocaleDateString('ko-KR') : ''})
                    </div>
                    <div
                      style={{
                        padding: 16,
                        background: '#f1f8e9',
                        borderRadius: 'var(--radius)',
                        borderLeft: '3px solid #4caf50',
                        lineHeight: 1.7,
                      }}
                      dangerouslySetInnerHTML={{ __html: viewingPost.replyContent }}
                    />
                  </div>
                )}

                {/* 문의인데 미답변 */}
                {isInquiry && !viewingPost.replyContent && (
                  <div style={{
                    marginTop: 20,
                    padding: 16,
                    background: '#fff8e1',
                    borderRadius: 'var(--radius)',
                    borderLeft: '3px solid #ffa000',
                    color: '#e65100',
                    fontSize: 'var(--fs-sm)',
                  }}>
                    아직 답변이 등록되지 않았습니다.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 사이드바 모바일 오버레이 */}
      {sideOpen && (
        <div className="wb-side-overlay show" onClick={() => setSideOpen(false)} />
      )}
    </>
  );
}
