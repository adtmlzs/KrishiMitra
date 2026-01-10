import { findNearestMandis, getCommoditiesList } from "./marketService";

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"; // Llama 4 Scout

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 2 sec before requests

const LANGUAGE_NAMES = {
  "en-IN": "English",
  "hi-IN": "Hindi",
  "gu-IN": "Gujarati",
  "ta-IN": "Tamil",
  "te-IN": "Telugu",
  "kn-IN": "Kannada",
  "mr-IN": "Marathi",
  "bn-IN": "Bengali",
  "pa-IN": "Punjabi",
};

const generateAIResponse = async (
  prompt,
  language = "en-IN",
  context = {},
  retries = 0
) => {
  // Rate limit protection
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    );
  }
  lastRequestTime = Date.now();

  const targetLang = LANGUAGE_NAMES[language] || "English";
  const languageInstruction =
    language !== "en-IN"
      ? `\nIMPORTANT: Provide the response in ${targetLang} language. Keep JSON keys in English, but translate ALL values (descriptions, names, tips, advice) to ${targetLang}.`
      : "";

  const finalPrompt = prompt + languageInstruction;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are Krishi Mitra, a helpful agricultural AI assistant.",
          },
          { role: "user", content: finalPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    // Handle rate limiting
    if (response.status === 429) {
      if (retries >= 3) {
        console.error(
          "Max retries exceeded for AI service. Switching to fallback."
        );
        return null;
      }
      const waitTime = Math.pow(2, retries) * 2000; // 2s, 4s, 8s
      console.warn(
        `Rate limited, waiting ${waitTime / 1000} seconds... (Attempt ${
          retries + 1
        }/3)`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return generateAIResponse(prompt, language, context, retries + 1);
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content;

    if (result) {
      return result;
    }
    throw new Error("Invalid response from AI");
  } catch (error) {
    console.error("AI Service Error:", error);
    return null;
  }
};

export { generateAIResponse };

/**
 * Get AI Disease Analysis and Treatment Plan
 */
export const getAIDiseaseAnalysis = async (
  disease,
  cropType = "Tomato",
  farmArea = 0.8,
  language = "en-IN"
) => {
  const prompt = `You are an agricultural expert. Analyze this crop disease and provide a COMPLETE treatment plan.

Disease Detected: ${disease.name}
Scientific Name: ${disease.scientificName || "Unknown"}
Affected Crop: ${cropType}
Farm Area: ${farmArea} hectares
Severity: ${disease.severity || "Medium"}
Symptoms: ${disease.symptoms || "Not specified"}

Provide a detailed JSON response with this EXACT structure (no markdown, just JSON):
{
  "diagnosis": {
    "confirmed": true,
    "confidence": 85,
    "stage": "Early/Moderate/Advanced",
    "spreadRisk": "Low/Medium/High"
  },
  "immediateActions": [
    "Action 1 to take right now",
    "Action 2 to take right now"
  ],
  "treatmentPlan": {
    "organic": [
      {"name": "Treatment name", "dosage": "X ml/L", "frequency": "Every X days", "cost": 150}
    ],
    "chemical": [
      {"name": "Treatment name", "dosage": "X g/L", "frequency": "Every X days", "cost": 300}
    ]
  },
  "prevention": [
    "Prevention tip 1",
    "Prevention tip 2"
  ],
  "monitoring": {
    "schedule": "Check every 2 days",
    "signsToWatch": ["Sign 1", "Sign 2"]
  },
  "recoveryTimeline": "7-14 days with proper treatment",
  "totalEstimatedCost": 500,
  "successRate": "85% with early intervention"
}`;

  const response = await generateAIResponse(prompt, language);

  if (response) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse AI disease response", e);
    }
  }

  return getDefaultDiseaseAnalysis(disease, farmArea);
};

/**
 * Get AI Irrigation Recommendation
 */
export const getAIIrrigationRecommendation = async (
  soilData,
  weatherData,
  cropType = "Tomato",
  language = "en-IN"
) => {
  const prompt = `You are an irrigation expert. Analyze this data and provide irrigation recommendation.

Soil Conditions:
- Moisture: ${soilData.moisture}%
- Temperature: ${soilData.temperature}°C
- pH: ${soilData.ph}

Weather Forecast:
- Current Temp: ${weatherData?.temperature || 28}°C
- Humidity: ${weatherData?.humidity || 60}%
- Rain Expected: ${weatherData?.rainForecast ? "Yes" : "No"}

Crop: ${cropType}

Provide JSON response (no markdown):
{
  "recommendation": "Irrigate Now/Skip Today/Schedule Tomorrow",
  "reason": "Brief explanation",
  "waterAmount": "X liters per hectare",
  "bestTime": "5-7 AM or 5-7 PM",
  "duration": "20-30 minutes",
  "method": "Drip/Sprinkler/Flood",
  "weeklySchedule": [
    {"day": "Monday", "irrigate": true, "time": "6 AM", "duration": "25 min"},
    {"day": "Tuesday", "irrigate": false, "reason": "Rain expected"}
  ],
  "waterSavingTips": ["Tip 1", "Tip 2"],
  "alerts": ["Alert if any"]
}`;

  const response = await generateAIResponse(prompt, language);
  if (response) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse AI irrigation response:", e);
    }
  }

  return getDefaultIrrigationRecommendation(soilData);
};

/**
 * Get AI Weekly Action Plan
 */
export const getAIWeeklyActionPlan = async (farmData, language = "en-IN") => {
  const { crop, area, soilMoisture, weather, growthStage } = farmData;

  const prompt = `You are a farm advisor. Create a detailed weekly action plan.

Farm Details:
- Crop: ${crop || "Tomato"}
- Area: ${area || 0.8} hectares
- Growth Stage: ${growthStage || "Vegetative"}
- Soil Moisture: ${soilMoisture || 45}%
- Current Weather: ${weather?.temperature || 28}°C, ${
    weather?.humidity || 60
  }% humidity
- Rain Forecast: ${
    weather?.rainForecast ? "Expected in 2-3 days" : "No rain expected"
  }

Generate a week's farm activities as JSON (no markdown):
{
  "weekOf": "Current week",
  "actions": [
    {
      "day": "Monday",
      "date": "Dec 4",
      "tasks": [
        {"time": "6 AM", "task": "Morning irrigation", "priority": "high", "completed": false},
        {"time": "10 AM", "task": "Check for pests", "priority": "medium", "completed": false}
      ]
    }
  ],
  "keyAlerts": ["Important alert 1"],
  "weatherAdvisory": "Brief weather-based advice",
  "expectedOutcomes": "What to expect this week"
}`;

  const response = await generateAIResponse(prompt, language);
  if (response) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse AI weekly plan:", e);
    }
  }

  return getDefaultWeeklyPlan();
};

/**
 * Get AI Crop Tracking Recommendations
 */
export const getAICropTracking = async (
  cropType,
  currentStage,
  daysSinceSowing,
  language = "en-IN"
) => {
  const prompt = `You are a crop growth expert. Provide complete tracking guidance.

Crop: ${cropType}
Current Stage: ${currentStage}
Days Since Sowing: ${daysSinceSowing}

Provide JSON (no markdown):
{
  "currentStage": {
    "name": "Vegetative",
    "progress": 45,
    "daysRemaining": 15,
    "description": "Plants are actively growing leaves"
  },
  "nextMilestone": {
    "stage": "Flowering",
    "expectedIn": "15 days",
    "preparation": ["Prep task 1", "Prep task 2"]
  },
  "todaysTasks": [
    {"task": "Task description", "priority": "high", "reason": "Why this is important"}
  ],
  "irrigationSchedule": {
    "frequency": "Every 2-3 days",
    "amount": "15-20 liters per plant",
    "nextIrrigation": "Tomorrow 6 AM"
  },
  "fertilizerSchedule": {
    "currentWeek": "Apply NPK 19:19:19",
    "dosage": "5g per plant",
    "method": "Drip fertigation",
    "nextApplication": "Dec 10"
  },
  "pestWatch": ["Pest to watch for"],
  "harvestForecast": {
    "expectedDate": "Feb 15, 2025",
    "daysRemaining": 72,
    "expectedYield": "25-30 tons per hectare"
  }
}`;

  const response = await generateAIResponse(prompt, language);
  if (response) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse AI crop tracking:", e);
    }
  }

  return getDefaultCropTracking(cropType, daysSinceSowing);
};

/**
 * Get Market Analysis
 */
export const getMarketAnalysis = async (
  crop = "Tomato",
  location = "Gujarat",
  language = "en-IN"
) => {
  const mandis = findNearestMandis(location.lat, location.lng);
  const marketContext = mandis
    .slice(0, 3)
    .map((m) => `${m.market}: ₹${m.modal_price}/quintal (${m.distance}km)`)
    .join("\n");

  const prompt = `Analyze market trends for ${crop} in ${
    location.city || location
  }.
  
Recent Market Data:
${marketContext}

Provide JSON response:
{
  "trend": "Bullish/Bearish/Stable",
  "priceForecast": {
    "nextWeek": "Expected price (number)",
    "nextMonth": "Expected price (number)"
  },
  "bestMarket": "Name of best market",
  "sellingAdvice": "Short advice on where/when to sell"
}`;

  const response = await generateAIResponse(prompt, language);
  if (response) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error(e);
    }
  }
  return null;
};

/**
 * Get AI Crop Recommendation based on all factors
 */
export const getAICropRecommendation = async (farmData, language = "en-IN") => {
  const {
    soilType,
    farmArea,
    waterAvailability,
    weather,
    forecast,
    season,
    location,
  } = farmData;

  // 1. Fetch real market data for common crops to ground the AI
  let marketContext = "CURRENT MARKET DATA (Gujarat Mandis):";
  try {
    const commodities = [
      "Tomato",
      "Potato",
      "Onion",
      "Wheat",
      "Rice",
      "Cotton",
      "Chilli Red",
      "Cauliflower",
      "Cabbage",
    ];
    const marketPromises = commodities.map((c) => findNearestMandis(c, 1000)); // 1 ton basis
    const marketResults = await Promise.all(marketPromises);

    marketResults.forEach((mandiList, index) => {
      if (mandiList && mandiList.length > 0) {
        const best = mandiList[0]; // Best profitable mandi
        marketContext += `\n- ${commodities[index]}: ₹${
          best.pricePerKg
        }/kg at ${best.market}. Transport: ₹${
          best.transportCost
        } for 1 ton. Net Profit potential: ${
          best.isProfitable ? "High" : "Low"
        }.`;
      }
    });
  } catch (err) {
    console.error("Error fetching market context:", err);
    marketContext += "\n(Market data unavailable, use general estimates)";
  }

  const prompt = `You are an expert agricultural advisor in India. Your task is to recommend the 5 BEST crops strictly based on the specific farm conditions provided below.

CRITICAL INSTRUCTIONS:
1. **Analyze Soil Type**: ONLY recommend crops compatible with ${soilType} soil. If the soil is "Black", prioritize Cotton, Groundnut. If "Sandy", prioritize Potato, Groundnut. If "Clay", prioritize Rice, Wheat.
2. **Analyze Water**: If Water Availability is "Low" (Rainfed), DO NOT recommend water-intensive crops like Rice or Sugarcane. Recommend drought-resistant crops like Millets, Pulses, or Castor.
3. **Analyze Season**: ONLY recommend crops suitable for the ${season} season.
4. **Use Market Data**: Use the provided market prices to calculate realistic profits.

CURRENT FARM DATA:
- Location: ${location || "Gujarat, India"}
- Season: ${season}
- Soil Type: ${soilType}
- Water Availability: ${waterAvailability}
- Farm Area: ${farmArea} hectares
- Weather: ${weather?.temp || 25}°C, ${weather?.humidity || 60}% humidity

MARKET INTELLIGENCE (Use these prices):
${marketContext}

Provide JSON response with exactly 5 recommendations customized for this specific farm:
{
  "recommendations": [
    {
      "crop": "Crop Name",
      "score": 95,
      "verdict": "HIGHLY RECOMMENDED",
      "seasonMatch": true,
      "soilMatch": true,
      "waterMatch": true,
      "reasons": ["Specific reason why this fits ${soilType} soil", "Specific reason regarding ${waterAvailability} water"],
      "duration": 90,
      "yieldPerHectare": "25 tons",
      "currentMarketPrice": 35,
      "expectedRevenue": 875000,
      "cultivationCost": 80000,
      "transportCost": 15000,
      "netProfit": 780000,
      "roi": 820,
      "risks": ["Specific risk"],
      "tips": ["Growing tip"]
    }
  ],
  "seasonalAdvice": "Advice specific to ${season} season",
  "marketTrend": "Trend based on provided prices",
  "bestTime": "Best sowing time for these crops"
}`;

  const response = await generateAIResponse(prompt, language);
  if (response) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Ensure all crops have proper calculations
        if (parsed.recommendations) {
          parsed.recommendations = parsed.recommendations.map((rec, index) => {
            // ALWAYS calculate profit correctly: Revenue - Cultivation Cost - Transport Cost
            const revenue = rec.expectedRevenue || 0;
            const cultivationCost = rec.cultivationCost || 0;
            const transportCost = rec.transportCost || 0;
            const calculatedProfit = revenue - cultivationCost - transportCost;

            // Calculate ROI correctly: (Profit / Investment) * 100
            const totalInvestment = cultivationCost + transportCost;
            const calculatedROI =
              totalInvestment > 0
                ? Math.round((calculatedProfit / totalInvestment) * 100)
                : 0;

            return {
              ...rec,
              rank: index + 1,
              netProfit: calculatedProfit,
              roi: calculatedROI,
              profitPerHectare: Math.round(calculatedProfit / farmArea),
            };
          });
        }
        return parsed;
      }
    } catch (e) {
      console.error("Failed to parse AI crop recommendation:", e);
    }
  }

  return getDefaultCropRecommendation(farmData);
};

// Fallback functions
const getDefaultDiseaseAnalysis = (disease, farmArea) => ({
  diagnosis: {
    confirmed: true,
    confidence: 80,
    stage: "Moderate",
    spreadRisk: "Medium",
  },
  immediateActions: [
    "Remove and destroy severely affected leaves",
    "Increase plant spacing for air circulation",
    "Avoid overhead watering",
  ],
  treatmentPlan: {
    organic: [
      {
        name: "Neem Oil Spray",
        dosage: "5ml/L water",
        frequency: "Every 5-7 days",
        cost: 150,
      },
      {
        name: "Copper Fungicide",
        dosage: "3g/L water",
        frequency: "Every 7 days",
        cost: 200,
      },
    ],
    chemical: [
      {
        name: "Mancozeb 75% WP",
        dosage: "2.5g/L water",
        frequency: "Every 10 days",
        cost: 300,
      },
      {
        name: "Chlorothalonil",
        dosage: "2g/L water",
        frequency: "Every 7 days",
        cost: 350,
      },
    ],
  },
  prevention: [
    "Use certified disease-free seeds",
    "Practice crop rotation (3-4 years)",
    "Maintain proper plant spacing",
    "Apply preventive fungicide during humid weather",
  ],
  recoveryTimeline: "10-14 days with consistent treatment",
  monitoringSchedule: [
    { day: 1, action: "Apply first treatment, mark affected areas" },
    { day: 3, action: "Check for new infections" },
    { day: 7, action: "Reapply treatment, assess recovery" },
    { day: 14, action: "Final assessment, adjust strategy if needed" },
  ],
  totalEstimatedCost: Math.round(500 * farmArea),
  successRate: "80-85% with proper treatment",
});

const getDefaultIrrigationRecommendation = (soilData) => ({
  recommendation:
    soilData.moisture < 35
      ? "Irrigate Now"
      : soilData.moisture < 50
      ? "Schedule Tomorrow"
      : "Skip Today",
  reason:
    soilData.moisture < 35
      ? "Soil moisture critically low"
      : "Adequate moisture levels",
  waterAmount: "500-600 liters per hectare",
  bestTime: "5:30 - 7:00 AM",
  duration: "25-30 minutes",
  method: "Drip Irrigation",
  weeklySchedule: [
    { day: "Monday", irrigate: true, time: "6 AM", duration: "25 min" },
    { day: "Tuesday", irrigate: false, reason: "Recovery day" },
    { day: "Wednesday", irrigate: true, time: "6 AM", duration: "25 min" },
    { day: "Thursday", irrigate: false, reason: "Recovery day" },
    { day: "Friday", irrigate: true, time: "6 AM", duration: "25 min" },
    { day: "Saturday", irrigate: false, reason: "Weekend rest" },
    { day: "Sunday", irrigate: true, time: "7 AM", duration: "20 min" },
  ],
  waterSavingTips: [
    "Use mulching to reduce evaporation",
    "Irrigate during cooler hours",
    "Check for pipe leaks regularly",
  ],
  alerts:
    soilData.moisture < 30 ? ["Critical: Immediate irrigation required"] : [],
});

const getDefaultWeeklyPlan = () => ({
  weekOf:
    new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric" }) +
    " week",
  actions: [
    {
      day: "Monday",
      date: new Date().toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
      }),
      tasks: [
        {
          time: "6 AM",
          task: "Morning irrigation - 25 minutes",
          priority: "high",
          completed: false,
        },
        {
          time: "9 AM",
          task: "Inspect plants for pests/diseases",
          priority: "medium",
          completed: false,
        },
      ],
    },
    {
      day: "Tuesday",
      date: new Date(Date.now() + 86400000).toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
      }),
      tasks: [
        {
          time: "7 AM",
          task: "Weed removal around plants",
          priority: "medium",
          completed: false,
        },
        {
          time: "5 PM",
          task: "Apply organic fertilizer",
          priority: "high",
          completed: false,
        },
      ],
    },
    {
      day: "Wednesday",
      date: new Date(Date.now() + 2 * 86400000).toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
      }),
      tasks: [
        {
          time: "6 AM",
          task: "Morning irrigation - 25 minutes",
          priority: "high",
          completed: false,
        },
        {
          time: "10 AM",
          task: "Check soil moisture levels",
          priority: "low",
          completed: false,
        },
      ],
    },
  ],
  keyAlerts: ["Monitor for early blight symptoms due to humidity"],
  weatherAdvisory: "Warm weather expected, ensure adequate irrigation",
  expectedOutcomes: "Healthy vegetative growth, prepare for flowering stage",
});

const getDefaultCropTracking = (cropType, daysSinceSowing) => ({
  currentStage: {
    name:
      daysSinceSowing < 20
        ? "Seedling"
        : daysSinceSowing < 45
        ? "Vegetative"
        : "Flowering",
    progress: Math.min(100, (daysSinceSowing / 90) * 100),
    daysRemaining: Math.max(0, 45 - daysSinceSowing),
    description: "Plants developing well",
  },
  nextMilestone: {
    stage: daysSinceSowing < 45 ? "Flowering" : "Fruiting",
    expectedIn: `${Math.max(5, 45 - daysSinceSowing)} days`,
    preparation: ["Ensure adequate nutrients", "Prepare support structures"],
  },
  todaysTasks: [
    {
      task: "Check plant health",
      priority: "high",
      reason: "Early detection prevents losses",
    },
    {
      task: "Monitor soil moisture",
      priority: "medium",
      reason: "Consistent moisture improves yield",
    },
  ],
  irrigationSchedule: {
    frequency: "Every 2-3 days",
    amount: "15-20 liters per plant",
    nextIrrigation: "Tomorrow 6 AM",
  },
  fertilizerSchedule: {
    currentWeek: "Balanced NPK application",
    dosage: "5g per plant",
    method: "Drip fertigation",
    nextApplication: new Date(Date.now() + 5 * 86400000).toLocaleDateString(
      "en-IN",
      { month: "short", day: "numeric" }
    ),
  },
  pestWatch: ["Aphids", "Whiteflies", "Leaf miners"],
  harvestForecast: {
    expectedDate: new Date(
      Date.now() + (90 - daysSinceSowing) * 86400000
    ).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    daysRemaining: Math.max(0, 90 - daysSinceSowing),
    expectedYield: "25-30 tons per hectare",
  },
});

// Default fallback for crop recommendation
const getDefaultCropRecommendation = ({
  soilType,
  farmArea,
  waterAvailability,
  season,
}) => {
  const crops = [
    {
      crop: "Tomato",
      score: 90,
      duration: 90,
      yieldPerHectare: "25 tons",
      currentMarketPrice: 35,
      cultivationCost: 80000,
      seasonMatch: true,
      soilMatch: soilType === "Loamy",
      waterMatch: waterAvailability !== "Low",
    },
    {
      crop: "Wheat",
      score: 85,
      duration: 130,
      yieldPerHectare: "4 tons",
      currentMarketPrice: 28,
      cultivationCost: 35000,
      seasonMatch: season === "Rabi",
      soilMatch: true,
      waterMatch: true,
    },
    {
      crop: "Onion",
      score: 82,
      duration: 120,
      yieldPerHectare: "15 tons",
      currentMarketPrice: 28,
      cultivationCost: 60000,
      seasonMatch: true,
      soilMatch: true,
      waterMatch: true,
    },
    {
      crop: "Potato",
      score: 80,
      duration: 100,
      yieldPerHectare: "20 tons",
      currentMarketPrice: 22,
      cultivationCost: 70000,
      seasonMatch: season === "Rabi",
      soilMatch: soilType !== "Clay",
      waterMatch: true,
    },
    {
      crop: "Cauliflower",
      score: 78,
      duration: 90,
      yieldPerHectare: "25 tons",
      currentMarketPrice: 22,
      cultivationCost: 60000,
      seasonMatch: season === "Rabi",
      soilMatch: true,
      waterMatch: waterAvailability !== "Low",
    },
  ];

  return {
    recommendations: crops.map((c, i) => {
      const revenue =
        parseFloat(c.yieldPerHectare) * 1000 * c.currentMarketPrice * farmArea;
      const cost = c.cultivationCost * farmArea;
      const transport = revenue * 0.02;
      const profit = revenue - cost - transport;
      return {
        ...c,
        rank: i + 1,
        verdict:
          i === 0 ? "HIGHLY RECOMMENDED" : i < 3 ? "RECOMMENDED" : "CONSIDER",
        expectedRevenue: Math.round(revenue),
        transportCost: Math.round(transport),
        netProfit: Math.round(profit),
        profitPerHectare: Math.round(profit / farmArea),
        roi: Math.round((profit / cost) * 100),
        reasons: ["Suitable for current conditions", "Good market demand"],
        risks: ["Weather dependency", "Price fluctuation"],
        tips: ["Use quality seeds", "Follow proper spacing"],
      };
    }),
    seasonalAdvice: `${season} season is ideal for growing winter vegetables and grains.`,
    marketTrend:
      "Vegetable prices showing upward trend due to festival season.",
    bestTime: "Start sowing within the next 2 weeks for best results.",
  };
};

export default {
  generateAIResponse,
  getAIDiseaseAnalysis,
  getAIIrrigationRecommendation,
  getAIWeeklyActionPlan,
  getAICropTracking,
  getAICropRecommendation,
};
