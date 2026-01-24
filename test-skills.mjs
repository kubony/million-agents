import { io } from 'socket.io-client';
import { nanoid } from 'nanoid';

const socket = io('http://localhost:3001');
const workflowId = nanoid();

// Excel과 PPT 스킬을 포함한 테스트 워크플로우
const testWorkflow = {
  workflowId,
  workflowName: '스킬 테스트 워크플로우',
  nodes: [
    {
      id: 'input-1',
      type: 'input',
      position: { x: 100, y: 200 },
      data: {
        label: '요청 입력',
        description: '문서 생성 요청',
        inputType: 'text',
        value: '2024년 AI 시장 분석 리포트 - 주요 트렌드, 시장 규모, 성장 전망, 주요 기업 분석 포함',
        status: 'idle',
      },
    },
    {
      id: 'agent-1',
      type: 'subagent',
      position: { x: 400, y: 100 },
      data: {
        label: '리서치 에이전트',
        description: 'AI 시장 데이터 수집 및 분석',
        role: 'analyst',
        tools: ['Read', 'Write'],
        model: 'haiku',
        status: 'idle',
      },
    },
    {
      id: 'skill-excel',
      type: 'skill',
      position: { x: 700, y: 50 },
      data: {
        label: 'Excel 생성',
        description: '시장 데이터를 Excel로 정리',
        skillType: 'official',
        skillId: 'xlsx',
        status: 'idle',
      },
    },
    {
      id: 'skill-ppt',
      type: 'skill',
      position: { x: 700, y: 200 },
      data: {
        label: 'PPT 생성',
        description: '분석 결과를 프레젠테이션으로',
        skillType: 'official',
        skillId: 'pptx',
        status: 'idle',
      },
    },
    {
      id: 'output-1',
      type: 'output',
      position: { x: 1000, y: 150 },
      data: {
        label: '최종 결과',
        description: '생성된 모든 문서',
        outputType: 'auto',
        status: 'idle',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'input-1', target: 'agent-1' },
    { id: 'e2', source: 'agent-1', target: 'skill-excel' },
    { id: 'e3', source: 'agent-1', target: 'skill-ppt' },
    { id: 'e4', source: 'skill-excel', target: 'output-1' },
    { id: 'e5', source: 'skill-ppt', target: 'output-1' },
  ],
  inputs: {
    'input-1': '2024년 AI 시장 분석 리포트 - 주요 트렌드, 시장 규모, 성장 전망, 주요 기업 분석 포함',
  },
};

console.log('═══════════════════════════════════════════════════════════');
console.log('  스킬 테스트 - Excel & PPT 파일 생성');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('📋 워크플로우 ID:', workflowId);
console.log('📊 노드 구조: Input → Analyst → [Excel, PPT] → Output');
console.log('');

socket.on('connect', () => {
  console.log('✅ 서버 연결 성공');
  console.log('📤 워크플로우 실행 요청...');
  console.log('');
  socket.emit('execute:workflow', testWorkflow);
});

socket.on('workflow:started', () => {
  console.log('▶️  워크플로우 시작됨');
});

socket.on('node:update', (update) => {
  const statusEmoji = {
    running: '🔄',
    completed: '✅',
    error: '❌',
  };
  const emoji = statusEmoji[update.status] || '📍';
  const nodeLabel = testWorkflow.nodes.find(n => n.id === update.nodeId)?.data.label || update.nodeId;
  console.log(`${emoji} [${nodeLabel}] ${update.status} (${update.progress || 0}%)`);
});

socket.on('console:log', (log) => {
  const emoji = log.type === 'error' ? '❌' : log.type === 'warn' ? '⚠️' : log.type === 'debug' ? '🔍' : 'ℹ️';
  console.log(`${emoji} ${log.message}`);
});

socket.on('workflow:completed', (data) => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🎉 워크플로우 완료!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('📁 출력 디렉토리:', data.outputDir);
  console.log('');

  if (data.results) {
    console.log('📊 생성된 파일:');
    for (const result of data.results) {
      console.log(`   ${result.success ? '✅' : '❌'} ${result.label}`);
      if (result.files && result.files.length > 0) {
        for (const file of result.files) {
          console.log(`      📄 ${file.name} (${file.type})`);
          console.log(`         → ${file.path}`);
        }
      }
    }
  }

  console.log('');
  socket.disconnect();
  process.exit(0);
});

socket.on('workflow:error', (data) => {
  console.log('');
  console.log('❌ 워크플로우 오류:', data.error);
  socket.disconnect();
  process.exit(1);
});

socket.on('connect_error', (error) => {
  console.log('❌ 연결 오류:', error.message);
  process.exit(1);
});

// 타임아웃 (5분)
setTimeout(() => {
  console.log('⏰ 타임아웃 - 5분 초과');
  socket.disconnect();
  process.exit(1);
}, 300000);
