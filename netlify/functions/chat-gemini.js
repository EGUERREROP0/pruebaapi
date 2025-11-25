import { GoogleGenerativeAI } from "@google/generative-ai";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Cargar API key desde variables de entorno de Netlify
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const loadKnowledgeBase = async () => {
    return `
DESARROLLADOR FULL-STACK

HABILIDADES TÉCNICAS:
• Frontend: React, Next.js, TypeScript, JavaScript, Tailwind CSS
• Backend: Node.js, Express, Python, FastAPI
• Bases de datos: PostgreSQL, MongoDB, Supabase
• Mobile: React Native, Expo
• Herramientas: Git, Docker, AWS, Vercel, Netlify

PROYECTOS DESTACADOS:
1. E-commerce moderno con carrito y pasarela de pago
2. Dashboard administrativo con gráficos en tiempo real
3. Aplicación móvil para gestión de tareas
4. API REST con autenticación JWT y documentación

EXPERIENCIA:
• 3+ años en desarrollo web y móvil
• Experiencia en startups y empresas tecnológicas
• Proyectos freelance para clientes internacionales

CONTACTO:
• Email: contacto@portfolio.com
• LinkedIn: linkedin.com/in/tuperfil
• GitHub: github.com/tuusuario
`;
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

        console.log('🔧 Iniciando función chat-gemini...');
        console.log('🔑 API Key configurada:', !!GEMINI_API_KEY);
        console.log('📨 Mensaje:', message);

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

        const knowledgeBase = await loadKnowledgeBase();

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

        console.log('🚀 Enviando request a Gemini...');
        const result = await model.generateContent({ contents });
        const reply = result.response.text();
        console.log('✅ Respuesta recibida');

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
        console.error('❌ Error completo:', error);

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