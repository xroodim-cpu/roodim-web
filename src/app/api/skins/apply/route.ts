import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sites, siteFiles, webSkins, webSkinFiles } from '@/drizzle/schema';
import { eq, and, inArray } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const { siteId, skinId } = await request.json();

    if (!siteId || !skinId) {
      return NextResponse.json({ error: 'siteId and skinId are required' }, { status: 400 });
    }

    // 1. 스킨 존재 확인
    const skin = await db.select().from(webSkins).where(eq(webSkins.id, skinId)).limit(1);
    if (skin.length === 0) {
      return NextResponse.json({ error: 'Skin not found' }, { status: 404 });
    }

    // 2. 스킨 파일 조회
    const skinFiles = await db.select().from(webSkinFiles).where(eq(webSkinFiles.skinId, skinId));
    if (skinFiles.length === 0) {
      return NextResponse.json({ error: 'Skin has no files' }, { status: 400 });
    }

    // 3. 기존 텍스트 파일 삭제 (html, css, js만)
    await db.delete(siteFiles).where(
      and(
        eq(siteFiles.siteId, siteId),
        inArray(siteFiles.fileType, ['html', 'css', 'js'])
      )
    );

    // 4. 스킨 파일을 site_files에 복사
    const now = new Date();
    for (const f of skinFiles) {
      await db.insert(siteFiles).values({
        siteId,
        filename: f.filename,
        fileType: f.fileType,
        content: f.content,
        fileSize: f.fileSize ?? 0,
        isEntry: f.isEntry ?? false,
        sortOrder: f.sortOrder ?? 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 5. sites 테이블 스킨 정보 업데이트
    await db.update(sites).set({
      skinId,
      skinAppliedAt: now,
      skinVersion: skin[0].version,
      updatedAt: now,
    }).where(eq(sites.id, siteId));

    return NextResponse.json({
      success: true,
      appliedSkin: skin[0].name,
      fileCount: skinFiles.length,
    });
  } catch (error) {
    console.error('Skin apply error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
