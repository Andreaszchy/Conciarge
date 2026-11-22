import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '2mb' }));

function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface IncomingResponseItem {
  id: string;
  guestName?: string;
  isAnonymous?: boolean;
  roomNumber?: string;
  stayType?: string;
  overallRating?: number;
  npsScore?: number;
  openComment?: string;
  answers?: Record<string, string | number>;
}

interface IncomingQuestion {
  id: string;
  label: string;
  type: string;
  category: string;
}

app.post('/api/analyze-opinions', async (req: Request, res: Response) => {
  try {
    const { hotelName, surveyTitle, questions, responses } = req.body as {
      hotelName?: string;
      surveyTitle?: string;
      questions?: IncomingQuestion[];
      responses?: IncomingResponseItem[];
    };

    if (!Array.isArray(responses) || responses.length === 0) {
      res.status(400).json({ error: 'Se requiere al menos una respuesta para analizar.' });
      return;
    }

    const ai = createGeminiClient();
    const cappedResponses = responses.slice(0, 120);
    const questionMap = new Map<string, IncomingQuestion>();
    if (Array.isArray(questions)) {
      for (const q of questions) {
        questionMap.set(q.id, q);
      }
    }

    const formattedResponses = cappedResponses.map((r, idx) => {
      const answerLines: string[] = [];
      if (r.answers && typeof r.answers === 'object') {
        for (const [qId, val] of Object.entries(r.answers)) {
          const q = questionMap.get(qId);
          const qLabel = q ? `${q.label} [${q.category}]` : qId;
          if (val !== '' && val !== null && val !== undefined) {
            answerLines.push(`  - ${qLabel}: ${String(val)}`);
          }
        }
      }
      return [
        `Respuesta #${idx + 1} (ID: ${r.id})`,
        `Tipo de estancia: ${r.stayType || 'No especificado'} | Nota media: ${typeof r.overallRating === 'number' ? r.overallRating.toFixed(1) : 'N/A'}/5 | NPS: ${typeof r.npsScore === 'number' && r.npsScore >= 0 ? r.npsScore : 'N/A'}/10`,
        r.openComment ? `Comentario libre: "${r.openComment.slice(0, 1500)}"` : 'Comentario libre: (Sin comentario escrito)',
        answerLines.length > 0 ? `Respuestas:\n${answerLines.join('\n')}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    });

    const prompt = `Analiza las siguientes ${cappedResponses.length} respuestas de la encuesta de satisfacción "${surveyTitle || 'Encuesta del hotel'}" para el hotel "${hotelName || 'Hotel'}".

Debes devolver un análisis ejecutivo riguroso y accionable en español para la dirección del hotel, basado estrictamente en los datos recibidos.

Datos de respuestas recibidas:
${formattedResponses.join('\n\n---\n\n')}

Instrucciones:
1. Redacta un resumen ejecutivo claro (3-4 frases) con los hallazgos principales.
2. Clasifica el sentimiento total contando exactamente cuántas respuestas son Positivas, Neutras y Negativas (la suma debe coincidir con ${cappedResponses.length}).
3. Identifica las principales fortalezas reales mencionadas por los huéspedes (máx. 5).
4. Identifica las áreas de mejora prioritarias indicando departamento responsable (Recepción, Limpieza, Habitaciones, Restauración, Mantenimiento, Instalaciones o Dirección) y prioridad (Alta, Media o Baja) (máx. 5).
5. Propón un plan de acción concreto con 3 a 5 medidas prácticas de aplicación inmediata.
6. Extrae entre 3 y 8 temas recurrentes con su sentimiento predominante y cantidad de menciones.
7. Para cada respuesta (usando exactamente su ID), devuelve su clasificación de sentimiento (Positivo, Neutro o Negativo), tema principal y un resumen breve de 1 línea.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'Eres un director senior de experiencia del huésped y calidad hotelera. Analizas encuestas de hoteles en español con precisión cuantitativa y recomendaciones operativas realistas. Nunca inventes comentarios que no existan en los datos proporcionados.',
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            executiveSummary: {
              type: Type.STRING,
              description: 'Resumen ejecutivo de la satisfacción hotelera en español.',
            },
            sentiment: {
              type: Type.OBJECT,
              properties: {
                positive: { type: Type.INTEGER },
                neutral: { type: Type.INTEGER },
                negative: { type: Type.INTEGER },
              },
              required: ['positive', 'neutral', 'negative'],
            },
            strengths: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  detail: { type: Type.STRING },
                  mentions: { type: Type.INTEGER },
                },
                required: ['title', 'detail', 'mentions'],
              },
            },
            improvements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  area: { type: Type.STRING },
                  department: { type: Type.STRING },
                  priority: { type: Type.STRING },
                  detail: { type: Type.STRING },
                },
                required: ['area', 'department', 'priority', 'detail'],
              },
            },
            actionPlan: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            themes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  topic: { type: Type.STRING },
                  sentiment: { type: Type.STRING },
                  count: { type: Type.INTEGER },
                },
                required: ['topic', 'sentiment', 'count'],
              },
            },
            responseSentiments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  responseId: { type: Type.STRING },
                  sentiment: { type: Type.STRING },
                  mainTopic: { type: Type.STRING },
                  briefSummary: { type: Type.STRING },
                },
                required: ['responseId', 'sentiment', 'mainTopic', 'briefSummary'],
              },
            },
          },
          required: [
            'executiveSummary',
            'sentiment',
            'strengths',
            'improvements',
            'actionPlan',
            'themes',
            'responseSentiments',
          ],
        },
      },
    });

    const rawText = (response.text ?? '').trim();
    if (!rawText) {
      res.status(502).json({ error: 'El servicio de análisis devolvió una respuesta vacía.' });
      return;
    }

    const parsed = JSON.parse(rawText);
    res.json(parsed);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error en /api/analyze-opinions:', message);
    if (message === 'GEMINI_API_KEY_MISSING') {
      res.status(500).json({
        error: 'No se encontró GEMINI_API_KEY configurada en el servidor. Revisa Settings > Secrets.',
      });
      return;
    }
    if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
      res.status(429).json({
        error: 'Se ha superado temporalmente la cuota de análisis IA. Inténtalo de nuevo en unos momentos.',
      });
      return;
    }
    if (message.includes('403') || message.includes('API_KEY_INVALID') || message.includes('PERMISSION_DENIED')) {
      res.status(403).json({
        error: 'La clave de API de Gemini no es válida o no tiene permisos. Verifícala en Settings > Secrets.',
      });
      return;
    }
    res.status(500).json({ error: `No se pudo completar el análisis automático: ${message}` });
  }
});

async function startServer() {
  const PORT = 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CID server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
