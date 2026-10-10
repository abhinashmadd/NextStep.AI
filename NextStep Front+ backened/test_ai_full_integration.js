const http = require('http');

function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method,
      headers: {
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runIntegrationVerification() {
  console.log('========================================================');
  console.log('NextStep Model & Frontend/Backend Full Integration Test');
  console.log('========================================================\n');

  // Test 1: Proxy /api/ai/health via port 3000
  console.log('1. Testing GET /api/ai/health via Node port 3000...');
  const healthRes = await request('/api/ai/health', 'GET');
  console.log('Status:', healthRes.status);
  console.log('Body  :', healthRes.body);
  if (healthRes.status !== 200 || healthRes.body.status !== 'healthy') {
    throw new Error('AI health check proxy failed!');
  }
  console.log('✓ PASS: AI Health proxy connected to Python NIM service.\n');

  // Test 2: Proxy /api/skills/extract via port 3000
  console.log('2. Testing POST /api/skills/extract via Node port 3000...');
  const extractRes = await request('/api/skills/extract', 'POST', {
    text: 'Developed REST API microservices in Python with FastAPI, Docker, and PostgreSQL databases.'
  });
  console.log('Status:', extractRes.status);
  console.log('Skills:', extractRes.body.extracted_skills);
  if (extractRes.status !== 200 || !extractRes.body.extracted_skills?.length) {
    throw new Error('Skill extraction proxy failed!');
  }
  console.log('✓ PASS: Skill Graph extraction connected through Node gateway.\n');

  // Test 3: Proxy /api/scoring/rank via port 3000
  console.log('3. Testing POST /api/scoring/rank via Node port 3000...');
  const rankRes = await request('/api/scoring/rank', 'POST', {
    skills: [{ skill: 'Python', level: 3 }, { skill: 'Docker', level: 2 }],
    interests: ['Backend Development'],
    education: 'B.Tech'
  });
  console.log('Status   :', rankRes.status);
  console.log('Ranked #1:', rankRes.body[0]?.career, 'Score:', rankRes.body[0]?.final_score);
  if (rankRes.status !== 200 || !rankRes.body?.length) {
    throw new Error('Career scoring proxy failed!');
  }
  console.log('✓ PASS: Multi-dimensional Scoring Engine connected through Node gateway.\n');

  // Test 4: Proxy /api/rag/query via port 3000
  console.log('4. Testing POST /api/rag/query via Node port 3000...');
  const ragRes = await request('/api/rag/query', 'POST', {
    query: 'What projects should I build to prepare for Software Developer?'
  });
  console.log('Status :', ragRes.status);
  console.log('Answer :', ragRes.body.answer?.slice(0, 150) + '...');
  console.log('Sources:', ragRes.body.sources);
  if (ragRes.status !== 200 || !ragRes.body.answer) {
    throw new Error('RAG query proxy failed!');
  }
  console.log('✓ PASS: RAG Knowledge Base pipeline connected through Node gateway.\n');

  // Test 5: Full Workflow AI Analysis
  console.log('5. Testing POST /api/ai/analyze via Node port 3000...');
  const analyzeRes = await request('/api/ai/analyze', 'POST', {
    student_profile: 'Alex Sharma, Computer Science, 3rd Year',
    target_career: 'Software Developer',
    student_evidence: 'Built a full stack web application with Node.js and MongoDB.',
    career_requirements: ['Software Development', 'Data Structures', 'Git', 'System Design']
  });
  console.log('Status          :', analyzeRes.status);
  console.log('Readiness Score :', analyzeRes.body.readiness_score + '%');
  console.log('Next Best Action:', analyzeRes.body.next_best_action?.title);
  if (analyzeRes.status !== 200 || !analyzeRes.body.next_best_action) {
    throw new Error('AI analysis failed!');
  }
  console.log('✓ PASS: End-to-end AI Analysis workflow connected.\n');

  console.log('========================================================');
  console.log('🎉 ALL 5 INTEGRATION TESTS PASSED WITH 100% SUCCESS!');
  console.log('The NextStep model API is now fully connected and functional!');
  console.log('========================================================');
}

runIntegrationVerification().catch(err => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
