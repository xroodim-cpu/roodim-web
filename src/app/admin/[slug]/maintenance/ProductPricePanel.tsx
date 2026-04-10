'use client';

import type { ProductItem } from './MaintenanceWorkspace';

interface Props {
  products: ProductItem[];
  onProductClick: (product: ProductItem) => void;
}

export default function ProductPricePanel({ products, onProductClick }: Props) {
  return (
    <div className="flex flex-col h-full p-4">
      {/* 타이틀 */}
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <h3 className="font-semibold text-gray-800 text-sm">프로젝트 가격표</h3>
      </div>

      {/* 상품 목록 */}
      {products.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <svg className="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-xs">가격표가 설정되지 않았습니다</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2">
          {products.map(product => (
            <button
              key={product.id}
              onClick={() => onProductClick(product)}
              className="w-full text-left p-3 rounded-lg border border-gray-100 hover:border-[#cc222c]/30 hover:bg-red-50/30 transition group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-800 truncate group-hover:text-[#cc222c] transition">
                    {product.name}
                  </div>
                  {product.description && (
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                      {product.description}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="font-bold text-sm text-[#cc222c]">
                    ₩{product.price.toLocaleString('ko-KR')}
                  </div>
                  {product.price !== product.base_price && (
                    <div className="text-[10px] text-gray-400 line-through">
                      ₩{product.base_price.toLocaleString('ko-KR')}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 하단 안내 */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-[10px] text-gray-400 text-center">
          상품 클릭 시 채팅창에 자동 입력됩니다
        </p>
      </div>
    </div>
  );
}
