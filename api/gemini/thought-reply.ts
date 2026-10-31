
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body ?? {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Thought text is required.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `사용자가 잠들기 전 마음속 걱정과 복잡한 생각을 바다에 내려놓으며 기록한 생각입니다:
"${text.trim()}"

다음 날 아침 사용자가 읽을 다정하고 지혜로운 답글을 작성해주세요.
1. comfortMessage: 따뜻한 공감과 격려 (2~3문장)
2. resolutionAdvice: 부담 없이 실천할 수 있는 현실적인 해결 방안이나 시각의 전환 (2~3문장)`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction:
          '당신은 밤새 사용자의 걱정을 품어준 깊고 고요한 바다의 메신저입니다. 다정하고 부드러운 존댓말로 답하세요.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            comfortMessage: { type: Type.STRING },
            resolutionAdvice: { type: Type.STRING },
          },
          required: ['comfortMessage', 'resolutionAdvice'],
        },
      },
    });

    const result = JSON.parse(response.text ?? '{}');

    return res.status(200).json({
      comfortMessage: result.comfortMessage,
      resolutionAdvice: result.resolutionAdvice,
    });
  } catch (error) {
    console.error('Gemini API error:', error);
    return res.status(500).json({
      error: 'AI reply generation failed.',
    });
  }
}
