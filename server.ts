import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Initialize Gemini API Client server-side
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// API Route: AI Morning Thought Reply
// When a user saves a thought for tomorrow and completes their stillness/sleep,
// this generates a warm, empathetic morning message ("괜찮다"는 위로) and a clear, realistic solution.
app.post('/api/gemini/thought-reply', async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Thought text is required.' });
  }

  // Fallback if API key is missing
  if (!ai || !apiKey) {
    return res.json({
      comfortMessage:
        '어젯밤 당신을 괴롭히던 생각은 깊은 바다가 품고 정화해 주었습니다. 밤새 푹 쉬어낸 당신의 마음은 어제보다 훨씬 가볍고 단단해졌어요. 정말 괜찮습니다.',
      resolutionAdvice:
        '오늘은 그 걱정에 매몰되지 말고, 지금 눈앞에 있는 작고 확실한 일부터 하나씩 천천히 다뤄보세요. 한 번에 모든 것을 해결할 필요는 없습니다.',
    });
  }

  try {
    const prompt = `사용자가 어젯밤 잠들기 전 마음속 걱정과 불안, 복잡한 생각을 바다에 내려놓으며 "내일 다시 보기"로 기록해 둔 생각입니다:
"${text.trim()}"

다음 날 아침, 푹 자고 일어난 사용자가 이 생각을 마주했을 때 읽게 될 다정하고 지혜로운 "바다의 아침 답글"을 작성해주세요.
반드시 아래 2가지 요소를 포함해야 합니다:
1. comfortMessage: "정말 괜찮다"는 따뜻한 공감과 격려, 어젯밤의 불안이 지나갔음을 안심시켜 주는 다정한 한마디 (2~3문장).
2. resolutionAdvice: 이 생각을 오늘 마주할 때 부담 없이 실천해 볼 수 있는 현실적이고 가벼운 해결 방안이나 시각의 전환 (2~3문장).`;

    const generatePromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction:
          '당신은 밤새 사용자의 걱정을 품어주고 정화해준 깊고 고요한 바다의 지혜로운 메신저입니다. 다정하고 부드러운 존댓말로, 무겁지 않고 마음에 온기를 주는 아침 답글을 전달하세요.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            comfortMessage: {
              type: Type.STRING,
              description: '따뜻한 공감과 "괜찮아요"라는 위로의 메시지',
            },
            resolutionAdvice: {
              type: Type.STRING,
              description: '부담 없이 시도할 수 있는 현실적이고 명쾌한 해결 방안 또는 조언',
            },
          },
          required: ['comfortMessage', 'resolutionAdvice'],
        },
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini API timeout')), 6500)
    );

    const response = await Promise.race([generatePromise, timeoutPromise]);

    const jsonStr = (response.text ?? '{}').trim();
    const parsed = JSON.parse(jsonStr);

    res.json({
      comfortMessage:
        parsed.comfortMessage ||
        '어젯밤의 무거운 마음은 밤사이 고요한 바다가 모두 녹여냈습니다. 당신은 이미 충분히 잘하고 있어요.',
      resolutionAdvice:
        parsed.resolutionAdvice ||
        '오늘은 부담을 내려놓고 작은 한 걸음부터 시작해보세요. 생각보다 훨씬 수월하게 풀릴 거예요.',
    });
  } catch (error) {
    console.error('Error generating AI thought reply:', error);
    // Graceful fallback so user always gets comfort even if quota/network error
    res.json({
      comfortMessage:
        '어젯밤 마음을 무겁게 짓누르던 생각은 이미 깊은 바다의 품에서 고요히 씻겨 내려갔습니다. 지금의 당신은 어제보다 평온하며, 모든 것은 괜찮을 것입니다.',
      resolutionAdvice:
        '복잡하게 얽힌 문제도 쪼개어 보면 작은 조각들일 뿐입니다. 오늘 할 수 있는 가장 단순한 한 가지만 먼저 실행해 보세요.',
    });
  }
});

// Production or Vite Middleware Setup
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer();
