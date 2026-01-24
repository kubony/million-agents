import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import ExcelJS from 'exceljs';
import pptxgen from 'pptxgenjs';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export interface SkillExecutionResult {
  success: boolean;
  result?: string;
  files?: Array<{ path: string; type: string; name: string }>;
  error?: string;
}

type LogCallback = (type: 'info' | 'warn' | 'error' | 'debug', message: string) => void;

/**
 * 스킬 실행 서비스 - 실제 파일 생성
 */
export class SkillExecutionService {
  private client: Anthropic;
  private gemini: GoogleGenerativeAI | null = null;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
  }

  /**
   * 스킬 실행 메인 라우터
   */
  async execute(
    skillId: string,
    input: string,
    outputDir: string,
    onLog?: LogCallback
  ): Promise<SkillExecutionResult> {
    // 출력 디렉토리 생성
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    onLog?.('info', `스킬 "${skillId}" 실행 중...`);

    switch (skillId) {
      case 'xlsx':
      case 'excel':
        return this.executeExcelSkill(input, outputDir, onLog);

      case 'pptx':
      case 'ppt-generator':
        return this.executePptSkill(input, outputDir, onLog);

      case 'image-gen-nanobanana':
      case 'image-gen':
        return this.executeImageGenSkill(input, outputDir, onLog);

      case 'docx':
      case 'word':
        return this.executeWordSkill(input, outputDir, onLog);

      case 'pdf':
        return this.executePdfSkill(input, outputDir, onLog);

      default:
        onLog?.('warn', `알 수 없는 스킬: ${skillId}, 일반 텍스트 처리로 대체`);
        return this.executeGenericSkill(skillId, input, outputDir, onLog);
    }
  }

  /**
   * Excel 스킬 - 실제 xlsx 파일 생성
   */
  private async executeExcelSkill(
    input: string,
    outputDir: string,
    onLog?: LogCallback
  ): Promise<SkillExecutionResult> {
    onLog?.('info', 'Excel 파일 생성 중...');

    try {
      // 1단계: Claude로 엑셀 데이터 구조 생성
      const dataPrompt = `당신은 Excel 데이터 구조화 전문가입니다.

## 요청 내용
${input}

## 작업
위 요청을 바탕으로 Excel 스프레드시트에 들어갈 데이터를 JSON 형식으로 생성해주세요.

다음 형식으로 반환하세요:
{
  "title": "문서 제목",
  "sheets": [
    {
      "name": "시트 이름",
      "headers": ["컬럼1", "컬럼2", "컬럼3"],
      "data": [
        ["값1", "값2", "값3"],
        ["값4", "값5", "값6"]
      ],
      "columnWidths": [20, 30, 15]
    }
  ]
}

실제 유용한 데이터를 생성해주세요. 반드시 유효한 JSON만 반환하세요.`;

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: dataPrompt }],
      });

      const responseText = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

      // JSON 추출
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                        responseText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]).trim() : responseText;

      let excelData;
      try {
        excelData = JSON.parse(jsonStr);
      } catch {
        // JSON 파싱 실패 시 기본 구조 생성
        excelData = {
          title: '생성된 문서',
          sheets: [{
            name: 'Sheet1',
            headers: ['항목', '내용'],
            data: [['데이터', responseText.substring(0, 100)]],
            columnWidths: [20, 50],
          }],
        };
      }

      // 2단계: ExcelJS로 실제 파일 생성
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Million Agent';
      workbook.created = new Date();

      for (const sheet of excelData.sheets) {
        const worksheet = workbook.addWorksheet(sheet.name);

        // 헤더 추가
        if (sheet.headers) {
          const headerRow = worksheet.addRow(sheet.headers);
          headerRow.font = { bold: true };
          headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' },
          };
          headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        }

        // 데이터 추가
        if (sheet.data) {
          for (const row of sheet.data) {
            worksheet.addRow(row);
          }
        }

        // 컬럼 너비 설정
        if (sheet.columnWidths) {
          sheet.columnWidths.forEach((width: number, index: number) => {
            worksheet.getColumn(index + 1).width = width;
          });
        }

        // 테두리 추가
        worksheet.eachRow((row) => {
          row.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' },
            };
          });
        });
      }

      // 파일 저장
      const fileName = `${excelData.title || 'document'}.xlsx`.replace(/[/\\?%*:|"<>]/g, '_');
      const filePath = join(outputDir, fileName);
      await workbook.xlsx.writeFile(filePath);

      onLog?.('info', `Excel 파일 생성 완료: ${fileName}`);

      return {
        success: true,
        result: `Excel 파일이 생성되었습니다: ${fileName}\n\n시트 수: ${excelData.sheets.length}`,
        files: [{ path: filePath, type: 'xlsx', name: fileName }],
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Excel 생성 실패';
      onLog?.('error', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * PPT 스킬 - 실제 pptx 파일 생성
   */
  private async executePptSkill(
    input: string,
    outputDir: string,
    onLog?: LogCallback
  ): Promise<SkillExecutionResult> {
    onLog?.('info', 'PowerPoint 파일 생성 중...');

    try {
      // 1단계: Claude로 PPT 구조 생성
      const slidePrompt = `당신은 프레젠테이션 전문가입니다.

## 요청 내용
${input}

## 작업
위 요청을 바탕으로 프레젠테이션 슬라이드 구조를 JSON 형식으로 생성해주세요.

다음 형식으로 반환하세요:
{
  "title": "프레젠테이션 제목",
  "author": "작성자",
  "slides": [
    {
      "type": "title",
      "title": "메인 제목",
      "subtitle": "부제목"
    },
    {
      "type": "content",
      "title": "슬라이드 제목",
      "bullets": ["항목 1", "항목 2", "항목 3"]
    },
    {
      "type": "two-column",
      "title": "비교 슬라이드",
      "left": { "title": "왼쪽 제목", "bullets": ["항목1", "항목2"] },
      "right": { "title": "오른쪽 제목", "bullets": ["항목1", "항목2"] }
    }
  ]
}

10-15개 슬라이드로 구성해주세요. 반드시 유효한 JSON만 반환하세요.`;

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: slidePrompt }],
      });

      const responseText = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

      // JSON 추출
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                        responseText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]).trim() : responseText;

      let pptData;
      try {
        pptData = JSON.parse(jsonStr);
      } catch {
        pptData = {
          title: '프레젠테이션',
          slides: [
            { type: 'title', title: '프레젠테이션', subtitle: input.substring(0, 50) },
            { type: 'content', title: '내용', bullets: [responseText.substring(0, 200)] },
          ],
        };
      }

      // 2단계: PptxGenJS로 실제 파일 생성
      const PptxGenJS = (pptxgen as any).default || pptxgen;
      const pptx = new PptxGenJS();
      pptx.author = pptData.author || 'Million Agent';
      pptx.title = pptData.title;
      pptx.subject = pptData.title;

      // 슬라이드 생성
      for (const slideData of pptData.slides) {
        const slide = pptx.addSlide();

        switch (slideData.type) {
          case 'title':
            // 타이틀 슬라이드
            slide.addText(slideData.title, {
              x: 0.5,
              y: 2.5,
              w: '90%',
              h: 1.5,
              fontSize: 44,
              bold: true,
              align: 'center',
              color: '363636',
            });
            if (slideData.subtitle) {
              slide.addText(slideData.subtitle, {
                x: 0.5,
                y: 4,
                w: '90%',
                h: 0.75,
                fontSize: 24,
                align: 'center',
                color: '666666',
              });
            }
            break;

          case 'content':
            // 컨텐츠 슬라이드
            slide.addText(slideData.title, {
              x: 0.5,
              y: 0.5,
              w: '90%',
              h: 0.75,
              fontSize: 32,
              bold: true,
              color: '363636',
            });
            if (slideData.bullets) {
              const bulletText = slideData.bullets.map((b: string) => ({
                text: b,
                options: { bullet: true, fontSize: 18, color: '444444' },
              }));
              slide.addText(bulletText, {
                x: 0.5,
                y: 1.5,
                w: '90%',
                h: 4,
                valign: 'top',
              });
            }
            break;

          case 'two-column':
            // 2컬럼 슬라이드
            slide.addText(slideData.title, {
              x: 0.5,
              y: 0.5,
              w: '90%',
              h: 0.75,
              fontSize: 32,
              bold: true,
              color: '363636',
            });
            // 왼쪽 컬럼
            if (slideData.left) {
              slide.addText(slideData.left.title, {
                x: 0.5,
                y: 1.5,
                w: 4.5,
                h: 0.5,
                fontSize: 20,
                bold: true,
                color: '4472C4',
              });
              const leftBullets = (slideData.left.bullets || []).map((b: string) => ({
                text: b,
                options: { bullet: true, fontSize: 16, color: '444444' },
              }));
              slide.addText(leftBullets, {
                x: 0.5,
                y: 2.1,
                w: 4.5,
                h: 3,
                valign: 'top',
              });
            }
            // 오른쪽 컬럼
            if (slideData.right) {
              slide.addText(slideData.right.title, {
                x: 5.2,
                y: 1.5,
                w: 4.5,
                h: 0.5,
                fontSize: 20,
                bold: true,
                color: '4472C4',
              });
              const rightBullets = (slideData.right.bullets || []).map((b: string) => ({
                text: b,
                options: { bullet: true, fontSize: 16, color: '444444' },
              }));
              slide.addText(rightBullets, {
                x: 5.2,
                y: 2.1,
                w: 4.5,
                h: 3,
                valign: 'top',
              });
            }
            break;

          default:
            // 기본 슬라이드
            slide.addText(slideData.title || '슬라이드', {
              x: 0.5,
              y: 0.5,
              w: '90%',
              h: 0.75,
              fontSize: 32,
              bold: true,
            });
        }
      }

      // 파일 저장
      const fileName = `${pptData.title || 'presentation'}.pptx`.replace(/[/\\?%*:|"<>]/g, '_');
      const filePath = join(outputDir, fileName);
      await pptx.writeFile({ fileName: filePath });

      onLog?.('info', `PowerPoint 파일 생성 완료: ${fileName}`);

      return {
        success: true,
        result: `PowerPoint 파일이 생성되었습니다: ${fileName}\n\n슬라이드 수: ${pptData.slides.length}`,
        files: [{ path: filePath, type: 'pptx', name: fileName }],
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'PPT 생성 실패';
      onLog?.('error', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * 이미지 생성 스킬 - Gemini API 사용
   */
  private async executeImageGenSkill(
    input: string,
    outputDir: string,
    onLog?: LogCallback
  ): Promise<SkillExecutionResult> {
    onLog?.('info', '이미지 생성 중...');

    try {
      // 1단계: Claude로 이미지 프롬프트 최적화
      const promptOptimization = `당신은 AI 이미지 생성 프롬프트 전문가입니다.

## 요청
${input}

## 작업
위 요청을 바탕으로 고품질 이미지 생성을 위한 영문 프롬프트를 작성하세요.
프롬프트는 구체적이고 시각적으로 묘사해야 합니다.

다음 JSON 형식으로 반환하세요:
{
  "prompts": [
    {
      "name": "이미지 이름 (한글)",
      "prompt": "상세한 영문 이미지 프롬프트",
      "style": "스타일 (realistic, illustration, cartoon 등)"
    }
  ]
}

3-5개 이미지 프롬프트를 생성하세요. 반드시 유효한 JSON만 반환하세요.`;

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [{ role: 'user', content: promptOptimization }],
      });

      const responseText = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

      // JSON 추출
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                        responseText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]).trim() : responseText;

      let imageData;
      try {
        imageData = JSON.parse(jsonStr);
      } catch {
        imageData = {
          prompts: [{ name: '이미지', prompt: input, style: 'realistic' }],
        };
      }

      const generatedFiles: Array<{ path: string; type: string; name: string }> = [];
      const results: string[] = [];

      // 2단계: Gemini API로 이미지 생성
      if (this.gemini) {
        onLog?.('info', 'Gemini API로 이미지 생성 중...');

        for (let i = 0; i < imageData.prompts.length; i++) {
          const { name, prompt, style } = imageData.prompts[i];
          onLog?.('debug', `이미지 ${i + 1}/${imageData.prompts.length}: ${name}`);

          try {
            const model = this.gemini.getGenerativeModel({ model: 'gemini-3-pro-image-preview' });

            const result = await model.generateContent({
              contents: [{
                role: 'user',
                parts: [{ text: `Generate an image: ${prompt}. Style: ${style}` }]
              }],
              generationConfig: {
                responseModalities: ['TEXT', 'IMAGE'],
              } as any,
            });

            const response = result.response;

            // 이미지 데이터 추출
            for (const part of response.candidates?.[0]?.content?.parts || []) {
              if ((part as any).inlineData) {
                const imageBuffer = Buffer.from((part as any).inlineData.data, 'base64');
                const fileName = `${name.replace(/[/\\?%*:|"<>]/g, '_')}_${i + 1}.png`;
                const filePath = join(outputDir, fileName);

                await writeFile(filePath, imageBuffer);

                generatedFiles.push({ path: filePath, type: 'image', name: fileName });
                results.push(`✅ ${name}: ${fileName}`);
                onLog?.('info', `이미지 생성 완료: ${fileName}`);
              }
            }
          } catch (imgError) {
            const errMsg = imgError instanceof Error ? imgError.message : '이미지 생성 실패';
            results.push(`❌ ${name}: ${errMsg}`);
            onLog?.('warn', `이미지 생성 실패 (${name}): ${errMsg}`);
          }
        }
      } else {
        onLog?.('warn', 'GEMINI_API_KEY가 설정되지 않아 이미지 프롬프트만 생성합니다.');

        // 프롬프트 파일로 저장
        const promptContent = imageData.prompts.map((p: any, i: number) =>
          `## 이미지 ${i + 1}: ${p.name}\n\n**프롬프트:** ${p.prompt}\n\n**스타일:** ${p.style}\n`
        ).join('\n---\n\n');

        const promptPath = join(outputDir, 'image-prompts.md');
        await writeFile(promptPath, `# 이미지 생성 프롬프트\n\n${promptContent}`, 'utf-8');

        generatedFiles.push({ path: promptPath, type: 'markdown', name: 'image-prompts.md' });
        results.push('이미지 프롬프트가 생성되었습니다. (GEMINI_API_KEY 설정 시 실제 이미지 생성)');
      }

      return {
        success: true,
        result: `이미지 생성 결과:\n\n${results.join('\n')}`,
        files: generatedFiles,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '이미지 생성 실패';
      onLog?.('error', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Word 문서 스킬 - HTML 기반 문서 생성
   */
  private async executeWordSkill(
    input: string,
    outputDir: string,
    onLog?: LogCallback
  ): Promise<SkillExecutionResult> {
    onLog?.('info', 'Word 문서 생성 중...');

    try {
      const docPrompt = `당신은 전문 문서 작성가입니다.

## 요청
${input}

## 작업
위 요청을 바탕으로 전문적인 문서를 작성하세요.
마크다운 형식으로 작성하며, 제목, 부제, 목차, 본문을 포함해주세요.`;

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: docPrompt }],
      });

      const docContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

      // HTML 문서 생성 (Word에서 열 수 있는 형식)
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>문서</title>
  <style>
    body { font-family: 'Malgun Gothic', sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
    h2 { color: #34495e; margin-top: 30px; }
    h3 { color: #7f8c8d; }
    p { line-height: 1.8; color: #2c3e50; }
    ul, ol { margin: 15px 0; }
    li { margin: 8px 0; }
  </style>
</head>
<body>
${this.markdownToHtml(docContent)}
</body>
</html>`;

      const fileName = 'document.html';
      const filePath = join(outputDir, fileName);
      await writeFile(filePath, htmlContent, 'utf-8');

      // 마크다운 버전도 저장
      const mdPath = join(outputDir, 'document.md');
      await writeFile(mdPath, docContent, 'utf-8');

      onLog?.('info', `문서 생성 완료: ${fileName}`);

      return {
        success: true,
        result: docContent,
        files: [
          { path: filePath, type: 'html', name: fileName },
          { path: mdPath, type: 'markdown', name: 'document.md' },
        ],
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '문서 생성 실패';
      onLog?.('error', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * PDF 스킬 - HTML 기반 PDF 생성 (기본)
   */
  private async executePdfSkill(
    input: string,
    outputDir: string,
    onLog?: LogCallback
  ): Promise<SkillExecutionResult> {
    // PDF 생성은 Word와 유사하게 HTML 생성 후 안내
    onLog?.('info', 'PDF 문서 생성 중...');

    const result = await this.executeWordSkill(input, outputDir, onLog);

    if (result.success) {
      result.result += '\n\n💡 HTML 파일을 브라우저에서 열고 PDF로 인쇄하여 PDF를 생성할 수 있습니다.';
    }

    return result;
  }

  /**
   * 일반 스킬 실행 (Claude 기반)
   */
  private async executeGenericSkill(
    skillId: string,
    input: string,
    outputDir: string,
    onLog?: LogCallback
  ): Promise<SkillExecutionResult> {
    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `스킬: ${skillId}\n\n입력:\n${input}\n\n위 스킬을 실행하고 결과를 제공해주세요.`,
        }],
      });

      const result = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

      // 결과 파일로 저장
      const filePath = join(outputDir, `${skillId}-result.md`);
      await writeFile(filePath, result, 'utf-8');

      return {
        success: true,
        result,
        files: [{ path: filePath, type: 'markdown', name: `${skillId}-result.md` }],
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '스킬 실행 실패';
      onLog?.('error', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * 간단한 마크다운 → HTML 변환
   */
  private markdownToHtml(md: string): string {
    return md
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^\* (.*$)/gim, '<li>$1</li>')
      .replace(/^- (.*$)/gim, '<li>$1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/\n\n/gim, '</p><p>')
      .replace(/^(.*)$/gim, '<p>$1</p>')
      .replace(/<p><h/gim, '<h')
      .replace(/<\/h(\d)><\/p>/gim, '</h$1>')
      .replace(/<p><li>/gim, '<ul><li>')
      .replace(/<\/li><\/p>/gim, '</li></ul>');
  }
}

export const skillExecutionService = new SkillExecutionService();
