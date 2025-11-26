

import { GoogleGenerativeAI } from "@google/generative-ai";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// const GEMINI_API_KEY = "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Cache para el conocimiento base
let knowledgeBaseCache = null;
let lastLoadTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

const loadKnowledgeBase = async () => {
    // Usar cache si está disponible y no ha expirado
    if (knowledgeBaseCache && (Date.now() - lastLoadTime) < CACHE_DURATION) {
        console.log(' Usando knowledge base desde cache');
        return knowledgeBaseCache;
    }

    try {
        // Determinar la URL base
        let knowledgeBaseUrl;

        if (process.env.NODE_ENV === 'development') {
            // Desarrollo local
            knowledgeBaseUrl = 'http://localhost:8888/knowledge-base.txt';
        } else {
            // Producción - usar URL absoluta
            const siteUrl = process.env.URL;
            knowledgeBaseUrl = `${siteUrl}/knowledge-base.txt`;
        }

        console.log(' Cargando knowledge base desde:', knowledgeBaseUrl);

        const response = await fetch(knowledgeBaseUrl);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const knowledgeBase = await response.text();

        // Validar que el contenido no esté vacío
        if (!knowledgeBase || knowledgeBase.trim().length === 0) {
            throw new Error('El archivo knowledge-base.txt está vacío');
        }

        // Actualizar cache
        knowledgeBaseCache = knowledgeBase;
        lastLoadTime = Date.now();

        console.log(' Knowledge base cargado correctamente');
        console.log(' Tamaño del contenido:', knowledgeBase.length, 'caracteres');

        return knowledgeBase;

    } catch (error) {
        console.error(' Error cargando knowledge base:', error.message);

        // Fallback robusto
        const fallbackContent = `
DESARROLLADOR FULL-STACK - INFORMACIÓN POR DEFECTO

HABILIDADES TÉCNICAS:
• Frontend: React, Next.js, TypeScript, JavaScript, Tailwind CSS
• Backend: Node.js, Express, Python, FastAPI
• Bases de datos: PostgreSQL, MongoDB, Supabase
• Mobile: React Native, Expo
• Herramientas: Git, Docker, AWS, Vercel, Netlify

PROYECTOS DESTACADOS:
NOTA: Verificar el archivo knowledge-base.txt para detalles completos.

EXPERIENCIA:
• 0.5+ años en desarrollo web y móvil
• Experiencia en startups y empresas tecnológicas
• Proyectos freelance para clientes internacionales

NOTA: Esta es información por defecto. Por favor verifica que el archivo knowledge-base.txt esté disponible en la carpeta public/.
`;

        console.log('🔄 Usando contenido por defecto');
        return fallbackContent;
    }
};

export async function handler(event, context) {
    // Manejar preflight OPTIONS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Método no permitido' })
        };
    }

    try {
        const { message, history = [] } = JSON.parse(event.body);

        console.log(' Iniciando función chat-gemini...');
        console.log(' API Key configurada:', !!GEMINI_API_KEY);
        console.log(' Mensaje:', message);

        if (!GEMINI_API_KEY) {
            throw new Error('API Key no configurada');
        }

        if (!message) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'El campo "message" es requerido' })
            };
        }

        // Cargar la base de conocimiento DESDE EL ARCHIVO
        const knowledgeBase = await loadKnowledgeBase();
        console.log(' Knowledge base cargado, tamaño:', knowledgeBase.length);

        const systemContext = `Eres un asistente virtual especializado en responder sobre el portafolio de un desarrollador.

INFORMACIÓN DEL DESARROLLADOR:
${knowledgeBase}

INSTRUCCIONES:
- Responde de manera amigable y profesional
- Usa solo la información proporcionada
- Sé conciso pero informativo
- Usa emojis apropiados
- Responde en español
- Si no sabes algo, sugiere contactar directamente`;

        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024,
            }
        });

        // Construir conversación
        const contents = [
            {
                role: "user",
                parts: [{ text: systemContext }]
            },
            {
                role: "model",
                parts: [{ text: "¡Hola! 👋 Soy el asistente virtual. Estoy aquí para contarte sobre las habilidades, proyectos y experiencia del desarrollador. ¿En qué puedo ayudarte?" }]
            }
        ];

        // Agregar historial
        history.forEach((msg) => {
            contents.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            });
        });

        // Agregar mensaje actual
        contents.push({
            role: 'user',
            parts: [{ text: message }]
        });

        console.log(' Enviando request a Gemini...');
        const result = await model.generateContent({ contents });
        const reply = result.response.text();
        console.log(' Respuesta recibida');

        return {
            statusCode: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                reply,
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error(' Error completo:', error);

        // Respuesta de fallback mejorada
        const userMessage = JSON.parse(event.body)?.message?.toLowerCase() || '';

        let fallbackReply = "¡Hola! Soy el asistente virtual. ";

        if (userMessage.includes('habilidad') || userMessage.includes('tecnolog')) {
            fallbackReply += "Tengo experiencia en React, TypeScript, Node.js, Python, PostgreSQL y MongoDB.";
        } else if (userMessage.includes('proyecto')) {
            fallbackReply += "He trabajado en proyectos de e-commerce, dashboards analytics y aplicaciones móviles.";
        } else if (userMessage.includes('contact')) {
            fallbackReply += "Puedes contactarme a través del formulario en mi portafolio o por email.";
        } else {
            fallbackReply += "Puedo contarte sobre mis habilidades técnicas, proyectos realizados y experiencia. ¿Qué te gustaría saber?";
        }

        return {
            statusCode: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                reply: fallbackReply,
                error: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
}


