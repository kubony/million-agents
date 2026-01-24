/**
 * 사용 가능한 공식 스킬 목록
 * AI 워크플로우 생성 시 참조됨
 */
export const AVAILABLE_SKILLS = [
  {
    id: 'image-gen-nanobanana',
    name: 'Image Generator',
    description: 'Google Gemini API를 사용한 AI 이미지 생성',
    keywords: ['이미지', 'image', '그림', '사진', 'picture', 'illustration', 'graphic'],
  },
  {
    id: 'ppt-generator',
    name: 'PPT Generator',
    description: '한국어에 최적화된 미니멀 프레젠테이션 생성',
    keywords: ['ppt', '발표', 'presentation', 'slides', 'powerpoint', '슬라이드'],
  },
  {
    id: 'video-gen-veo3',
    name: 'Video Generator',
    description: 'Google Veo3 API를 사용한 AI 영상 생성',
    keywords: ['영상', 'video', '동영상', 'animation', '애니메이션'],
  },
  {
    id: 'pdf',
    name: 'PDF',
    description: 'PDF 텍스트 추출, 생성, 병합/분할, 폼 처리',
    keywords: ['pdf', '문서', 'document'],
  },
  {
    id: 'docx',
    name: 'Word Document',
    description: 'Word 문서 생성, 편집, 변경 추적, 주석',
    keywords: ['워드', 'docx', 'word', '한글', '문서'],
  },
  {
    id: 'xlsx',
    name: 'Excel',
    description: '스프레드시트 생성, 편집, 수식, 데이터 분석',
    keywords: ['엑셀', 'xlsx', 'excel', '스프레드시트', 'spreadsheet', '표'],
  },
  {
    id: 'pptx',
    name: 'PowerPoint',
    description: 'PPT 생성, 편집, 레이아웃, 스피커 노트',
    keywords: ['pptx', 'powerpoint', 'presentation'],
  },
  {
    id: 'git-commit-push',
    name: 'Git Commit/Push',
    description: 'Git 변경사항 분석, 커밋 메시지 작성, 푸시/PR 생성',
    keywords: ['git', 'commit', 'push', 'pr', 'pull request', '커밋', '푸시'],
  },
] as const;

export type AvailableSkillId = typeof AVAILABLE_SKILLS[number]['id'];

/**
 * 스킬 ID로 스킬 정보 조회
 */
export function getSkillById(skillId: string) {
  return AVAILABLE_SKILLS.find((skill) => skill.id === skillId);
}

/**
 * 키워드로 스킬 검색
 */
export function searchSkillsByKeyword(keyword: string) {
  const lowerKeyword = keyword.toLowerCase();
  return AVAILABLE_SKILLS.filter((skill) =>
    skill.keywords.some((kw) => kw.toLowerCase().includes(lowerKeyword))
  );
}
