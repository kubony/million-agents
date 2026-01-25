# Anthropic API 프록시 서버 구축 가이드

makecc 사용자에게 무료로 API를 제공하기 위한 프록시 서버 구축 가이드입니다.

## 개요

### 프록시 서버란?

```
[makecc 클라이언트] → [프록시 서버] → [Anthropic API]
                         ↑
                    API 키 보관
```

- 클라이언트는 API 키 없이 프록시 서버에 요청
- 프록시 서버가 내부적으로 API 키를 붙여서 Anthropic에 전달
- 사용량 추적, 요청 제한 등 중앙 관리 가능

### 장점

- 사용자가 API 키 없이 makecc 사용 가능
- API 키 노출 위험 없음
- 사용량/비용 중앙 관리
- 요청 제한(rate limiting) 구현 가능

---

## 빠른 시작 (5분)

### 1. 프로젝트 생성

```bash
mkdir makecc-proxy && cd makecc-proxy
npm init -y
npm install express cors @anthropic-ai/sdk dotenv
```

### 2. 서버 코드 작성

**index.js**
```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk').default;

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Anthropic 클라이언트 (서버에서 API 키 관리)
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Messages API 프록시
app.post('/v1/messages', async (req, res) => {
  try {
    const response = await anthropic.messages.create(req.body);
    res.json(response);
  } catch (error) {
    console.error('API Error:', error.message);
    res.status(error.status || 500).json({
      error: {
        type: error.type || 'api_error',
        message: error.message,
      },
    });
  }
});

// Streaming Messages API 프록시
app.post('/v1/messages/stream', async (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await anthropic.messages.stream(req.body);

    for await (const event of stream) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    res.end();
  } catch (error) {
    console.error('Stream Error:', error.message);
    res.status(error.status || 500).json({
      error: {
        type: error.type || 'api_error',
        message: error.message,
      },
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
```

### 3. 환경 변수 설정

**.env**
```
ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key-here
PORT=3000
```

### 4. 실행

```bash
node index.js
```

### 5. 테스트

```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

---

## 프로덕션 배포

### Option 1: Vercel (무료, 권장)

**vercel.json**
```json
{
  "version": 2,
  "builds": [{ "src": "index.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "index.js" }]
}
```

```bash
npm i -g vercel
vercel --prod
```

환경 변수는 Vercel 대시보드에서 설정.

### Option 2: Railway

```bash
npm i -g @railway/cli
railway login
railway init
railway up
```

### Option 3: Fly.io

**fly.toml**
```toml
app = "makecc-proxy"
primary_region = "nrt"

[http_service]
  internal_port = 3000
  force_https = true

[env]
  PORT = "3000"
```

```bash
fly launch
fly secrets set ANTHROPIC_API_KEY=sk-ant-api03-...
fly deploy
```

---

## 고급 기능

### Rate Limiting (요청 제한)

```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 10, // IP당 10회
  message: { error: { message: 'Too many requests, please try again later.' } },
});

app.use('/v1/messages', limiter);
```

### 사용량 로깅

```javascript
app.post('/v1/messages', async (req, res) => {
  const startTime = Date.now();

  try {
    const response = await anthropic.messages.create(req.body);

    // 사용량 로깅
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      model: req.body.model,
      input_tokens: response.usage?.input_tokens,
      output_tokens: response.usage?.output_tokens,
      latency_ms: Date.now() - startTime,
      ip: req.ip,
    }));

    res.json(response);
  } catch (error) {
    // ... 에러 처리
  }
});
```

### API 키 인증 (선택적)

특정 사용자만 허용하려면:

```javascript
const ALLOWED_API_KEYS = new Set([
  'makecc-user-key-1',
  'makecc-user-key-2',
]);

app.use('/v1/messages', (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || !ALLOWED_API_KEYS.has(apiKey)) {
    return res.status(401).json({
      error: { message: 'Invalid or missing API key' },
    });
  }

  next();
});
```

---

## makecc 연동

### 1. 프록시 URL 설정

makecc UI에서:
1. 우측 상단 설정(⚙️) 클릭
2. **Proxy URL**에 배포된 서버 URL 입력
   - 예: `https://your-proxy.vercel.app`
3. **API Mode**는 `proxy` 선택
4. API Key는 비워두기 (프록시가 관리)

### 2. 환경 변수로 설정 (선택)

프로젝트의 `.env`에:
```
MAKECC_PROXY_URL=https://your-proxy.vercel.app
```

---

## 문제 해결

### CORS 에러

```javascript
app.use(cors({
  origin: '*', // 또는 특정 도메인
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
}));
```

### Timeout 에러

Vercel/Serverless는 기본 10초 제한. 긴 요청은:
- `max_tokens` 줄이기
- Streaming 사용
- Railway/Fly.io로 전환 (제한 없음)

### 429 Rate Limit (Anthropic)

Anthropic API 제한에 걸리면:
- 요청 간격 늘리기
- 여러 API 키 로테이션
- 캐싱 구현

---

## 보안 체크리스트

- [ ] API 키는 환경 변수로만 관리 (코드에 하드코딩 금지)
- [ ] HTTPS 필수 (배포 서비스가 자동 처리)
- [ ] Rate limiting 적용
- [ ] 요청 로깅으로 이상 탐지
- [ ] 정기적인 API 키 로테이션
