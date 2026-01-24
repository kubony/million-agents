import { io } from 'socket.io-client';
import { nanoid } from 'nanoid';

const socket = io('http://localhost:3001');

const workflowId = nanoid();

// 테스트용 워크플로우: 상세페이지 이미지 세트 생성
const testWorkflow = {
  workflowId,
  workflowName: '상세페이지 이미지 세트',
  nodes: [
    {
      id: 'input-1',
      type: 'input',
      data: {
        label: '상품 정보',
        description: '상세페이지를 만들 상품 정보를 입력하세요',
        inputType: 'text',
        value: '프리미엄 무선 블루투스 이어폰 - 노이즈 캔슬링, 30시간 배터리, IPX5 방수',
      },
    },
    {
      id: 'subagent-1',
      type: 'subagent',
      data: {
        label: '상품 분석가',
        description: '상품의 핵심 특징과 마케팅 포인트를 분석합니다',
        role: 'analyst',
        tools: ['Read'],
        model: 'sonnet',
      },
    },
    {
      id: 'skill-1',
      type: 'skill',
      data: {
        label: '이미지 생성기',
        description: '상세페이지용 이미지 세트를 생성합니다',
        skillType: 'official',
        skillId: 'image-gen-nanobanana',
      },
    },
    {
      id: 'output-1',
      type: 'output',
      data: {
        label: '상세페이지 이미지 세트',
        description: '생성된 이미지와 프롬프트',
        outputType: 'auto',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'input-1', target: 'subagent-1' },
    { id: 'e2', source: 'subagent-1', target: 'skill-1' },
    { id: 'e3', source: 'skill-1', target: 'output-1' },
  ],
  inputs: {
    'input-1': '프리미엄 무선 블루투스 이어폰 - 노이즈 캔슬링, 30시간 배터리, IPX5 방수',
  },
};

console.log('🚀 워크플로우 테스트 시작...');
console.log(`   워크플로우 ID: ${workflowId}`);
console.log(`   워크플로우 이름: ${testWorkflow.workflowName}`);
console.log('');

socket.on('connect', () => {
  console.log('✅ 서버 연결됨');
  console.log('');

  // 워크플로우 실행 요청
  socket.emit('execute:workflow', testWorkflow);
});

socket.on('node:update', (update: { nodeId: string; status: string; progress?: number; result?: string; error?: string }) => {
  const node = testWorkflow.nodes.find(n => n.id === update.nodeId);
  const nodeName = node?.data.label || update.nodeId;

  if (update.status === 'running') {
    console.log(`⏳ [${nodeName}] 실행 중... ${update.progress || 0}%`);
  } else if (update.status === 'completed') {
    console.log(`✅ [${nodeName}] 완료`);
  } else if (update.status === 'error') {
    console.log(`❌ [${nodeName}] 오류: ${update.error}`);
  }
});

socket.on('console:log', (log: { type: string; message: string }) => {
  const icon = log.type === 'error' ? '❌' : log.type === 'warn' ? '⚠️' : 'ℹ️';
  console.log(`${icon} ${log.message}`);
});

socket.on('workflow:completed', (data: { workflowId: string; results?: any[]; outputDir?: string }) => {
  console.log('');
  console.log('========================================');
  console.log('🎉 워크플로우 실행 완료!');
  console.log('========================================');

  if (data.outputDir) {
    console.log(`📁 출력 경로: ${data.outputDir}`);
  }

  if (data.results) {
    console.log('');
    console.log('📋 결과 요약:');
    for (const result of data.results) {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${result.label}`);
      if (result.files && result.files.length > 0) {
        for (const file of result.files) {
          console.log(`      📄 ${file.name}: ${file.path}`);
        }
      }
    }
  }

  console.log('');
  process.exit(0);
});

socket.on('workflow:error', (error: { message: string }) => {
  console.error('❌ 워크플로우 오류:', error.message);
  process.exit(1);
});

socket.on('connect_error', (error) => {
  console.error('❌ 서버 연결 실패:', error.message);
  process.exit(1);
});

// 타임아웃 설정 (5분 - 이미지 생성에 시간이 걸릴 수 있음)
setTimeout(() => {
  console.error('❌ 타임아웃: 워크플로우 실행이 5분을 초과했습니다');
  process.exit(1);
}, 300000);
