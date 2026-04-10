'use client';

import type { ProductItem } from './MaintenanceWorkspace';

interface Props {
  products: ProductItem[];
  onProductClick: (product: ProductItem) => void;
}

export default function ProductPricePanel({ products, onProductClick }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px 16px' }}>
      {/* 타이틀 — 루딤링크 섹션 헤더 스타일 */}
      <div style={{
        fontSize: '12px',
        fontWeight: 700,
        color: '#929aa6',
        marginBottom: '12px',
        letterSpacing: '-0.01em',
      }}>
        프로젝트 가격표
      </div>

      {/* 상품 목록 */}
      {products.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: '#929aa6' }}>
            <div style={{ fontSize: '36px', marginBottom: '8px', opacity: 0.3 }}>📋</div>
            <p style={{ fontSize: '13px', fontWeight: 500 }}>가격표가 설정되지 않았습니다</p>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {products.map(product => (
            <button
              key={product.id}
              onClick={() => onProductClick(product)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid #e7eaef',
                background: '#fff',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(204,34,44,0.3)';
                e.currentTarget.style.background = 'rgba(204,34,44,0.02)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#e7eaef';
                e.currentTarget.style.background = '#fff';
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1f2328' }}>
                  {product.name}
                </div>
                {product.description && (
                  <div style={{
                    fontSize: '12px',
                    color: '#6a737d',
                    marginTop: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {product.description}
                  </div>
                )}
              </div>
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#cc222c' }}>
                  ₩{product.price.toLocaleString('ko-KR')}
                </div>
                {product.price !== product.base_price && (
                  <div style={{ fontSize: '10px', color: '#bbc0c8', textDecoration: 'line-through' }}>
                    ₩{product.base_price.toLocaleString('ko-KR')}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 하단 안내 */}
      <div style={{
        marginTop: '12px',
        paddingTop: '12px',
        borderTop: '1px solid #f1f2f6',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: '11px', color: '#bbc0c8' }}>
          상품 클릭 시 채팅창에 자동 입력됩니다
        </p>
      </div>
    </div>
  );
}
