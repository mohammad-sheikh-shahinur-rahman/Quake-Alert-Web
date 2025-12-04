import { GoogleGenAI, Type } from "@google/genai";
import { EarthquakeFeature } from "../types";

// Safety check for process.env to prevent browser crash if not defined
const apiKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : '';
const ai = new GoogleGenAI({ apiKey: apiKey });

export const getSafetyAnalysis = async (recentQuakes: EarthquakeFeature[]): Promise<string> => {
  // Take top 5 significant quakes to avoid token overflow
  const significantQuakes = recentQuakes
    .sort((a, b) => b.properties.mag - a.properties.mag)
    .slice(0, 5)
    .map(q => `- Magnitude ${q.properties.mag} at ${q.properties.place}`);

  const prompt = `
    Recent earthquakes data:
    ${significantQuakes.join('\n')}

    Act as a safety expert. Provide a concise summary in Bengali (Bangla) about these recent seismic activities.
    Then, provide 3 very important, short bullet points on earthquake safety tips in Bengali.
    Keep the tone calm but alert. Do not use markdown formatting like ** bold, just plain text or simple bullets.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 } // Low latency
      }
    });
    return response.text || "বর্তমানে কোনো বিশ্লেষণ পাওয়া যাচ্ছে না।";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "নেটওয়ার্ক সমস্যার কারণে বিশ্লেষণ দেখানো যাচ্ছে না। অনুগ্রহ করে পরে আবার চেষ্টা করুন।";
  }
};

export const getSafetyChatResponse = async (userMessage: string): Promise<string> => {
  const prompt = `
    User question: "${userMessage}"
    
    You are a helpful, calm, and knowledgeable earthquake safety expert assistant.
    Answer the user's question in Bengali (Bangla).
    Keep the answer concise, practical, and easy to understand.
    If the question is not related to safety, disasters, or earthquakes, politely guide them back to the topic.
    Do not use markdown formatting like ** bold, just plain text.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    return response.text || "দুঃখিত, আমি এখন উত্তর দিতে পারছি না।";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "নেটওয়ার্ক সমস্যার কারণে উত্তর দেওয়া যাচ্ছে না।";
  }
};

// Helper to convert File to Base64
const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64Data = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const identifyLocationFromImage = async (file: File): Promise<{ lat: number; lng: number; name: string } | null> => {
  try {
    const imagePart = await fileToGenerativePart(file);
    const prompt = `
      Identify the geographic location shown in this image. 
      If you can identify a specific landmark, city, or place, return its latitude and longitude coordinates and a short name (in English).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [imagePart, { text: prompt }]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            identified: { type: Type.BOOLEAN, description: "Whether the location was identified" },
            lat: { type: Type.NUMBER, description: "Latitude" },
            lng: { type: Type.NUMBER, description: "Longitude" },
            name: { type: Type.STRING, description: "Name of the location" },
          },
          required: ["identified"],
        }
      }
    });

    if (!response.text) return null;
    
    const data = JSON.parse(response.text);
    
    if (data.identified && typeof data.lat === 'number' && typeof data.lng === 'number') {
        return {
            lat: data.lat,
            lng: data.lng,
            name: data.name || 'Identified Location'
        };
    }
    
    return null;
  } catch (error) {
    console.error("Gemini Vision Error:", error);
    return null;
  }
};