import axios from "axios";
import { generateAIResponse } from "./aiService";

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

/**
 * Get user's current location
 */
export const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => {
          console.error("Geolocation error:", err);
          // Default to Ahmedabad
          resolve({ lat: 23.0225, lng: 72.5714 });
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      resolve({ lat: 23.0225, lng: 72.5714 });
    }
  });
};

/**
 * Mandi database with coordinates
 */
const MANDI_DATABASE = [
  {
    id: 1,
    name: "APMC Ahmedabad",
    district: "Ahmedabad",
    state: "Gujarat",
    lat: 23.0258,
    lng: 72.5873,
    type: "Wholesale",
  },
  {
    id: 2,
    name: "APMC Gandhinagar",
    district: "Gandhinagar",
    state: "Gujarat",
    lat: 23.2156,
    lng: 72.6369,
    type: "Wholesale",
  },
  {
    id: 3,
    name: "APMC Mehsana",
    district: "Mehsana",
    state: "Gujarat",
    lat: 23.588,
    lng: 72.3693,
    type: "Wholesale",
  },
  {
    id: 4,
    name: "APMC Rajkot",
    district: "Rajkot",
    state: "Gujarat",
    lat: 22.3039,
    lng: 70.8022,
    type: "Wholesale",
  },
  {
    id: 5,
    name: "APMC Surat",
    district: "Surat",
    state: "Gujarat",
    lat: 21.1702,
    lng: 72.8311,
    type: "Wholesale",
  },
  {
    id: 6,
    name: "APMC Vadodara",
    district: "Vadodara",
    state: "Gujarat",
    lat: 22.3072,
    lng: 73.1812,
    type: "Wholesale",
  },
  {
    id: 7,
    name: "APMC Anand",
    district: "Anand",
    state: "Gujarat",
    lat: 22.5645,
    lng: 72.9289,
    type: "Wholesale",
  },
  {
    id: 8,
    name: "APMC Bharuch",
    district: "Bharuch",
    state: "Gujarat",
    lat: 21.7051,
    lng: 72.9959,
    type: "Wholesale",
  },
];

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10; // Distance in km
};

/**
 * Calculate actual transport fare
 * Based on real Gujarat rates - optimized for realistic scenarios
 */
const calculateTransportFare = (distanceKm, quantityKg) => {
  // For very small quantities (< 50kg), assume farmer carries it themselves or uses bike
  if (quantityKg < 50) {
    // Bike/personal transport - minimal cost
    const fare = Math.max(20, distanceKm * 2);
    return {
      vehicle: "bike",
      distanceKm,
      trips: 1,
      farePerTrip: fare,
      totalFare: Math.round(fare),
      farePerKg: Math.round((fare / quantityKg) * 100) / 100,
    };
  }

  // Fare rates per km based on vehicle type
  const rates = {
    auto: { baseRate: 20, perKm: 8, maxLoad: 150 },
    tempo: { baseRate: 80, perKm: 12, maxLoad: 800 },
    truck: { baseRate: 300, perKm: 18, maxLoad: 5000 },
  };

  // Determine best vehicle based on quantity
  let selectedVehicle = "auto";
  if (quantityKg > 800) selectedVehicle = "truck";
  else if (quantityKg > 150) selectedVehicle = "tempo";

  const rate = rates[selectedVehicle];
  const trips = Math.ceil(quantityKg / rate.maxLoad);
  // One-way fare (farmers usually have return load or empty return is cheaper)
  const farePerTrip = rate.baseRate + distanceKm * rate.perKm;
  const totalFare = farePerTrip * trips * 1.5; // 1.5x for return (discounted)

  return {
    vehicle: selectedVehicle,
    distanceKm,
    trips,
    farePerTrip: Math.round(farePerTrip),
    totalFare: Math.round(totalFare),
    farePerKg: Math.round((totalFare / quantityKg) * 100) / 100,
  };
};

/**
 * Get commodity prices per KG - more realistic pricing
 */
const getCommodityPricesPerKg = (commodity) => {
  const today = new Date().toISOString().split("T")[0];

  // Base prices in ₹/kg - realistic market rates
  const basePrices = {
    Tomato: 35,
    Potato: 22,
    Onion: 30,
    Rice: 40,
    Wheat: 32,
    Cotton: 70,
    "Chilli Red": 180,
    Brinjal: 28,
    Cabbage: 18,
    Cauliflower: 25,
    Carrot: 30,
    "Green Chilli": 50,
    Garlic: 100,
    Ginger: 65,
    Ladyfinger: 35,
  };

  const basePrice = basePrices[commodity] || 30;

  // Generate prices for each mandi with variation based on distance from major city
  return MANDI_DATABASE.map((mandi, index) => {
    // Closer mandis might have more competition = lower prices
    // Farther mandis might have better prices due to less supply
    const variation = 0.9 + Math.random() * 0.25; // 0.9 to 1.15
    const pricePerKg = Math.round(basePrice * variation * 100) / 100;

    return {
      mandiId: mandi.id,
      market: mandi.name,
      district: mandi.district,
      state: mandi.state,
      lat: mandi.lat,
      lng: mandi.lng,
      commodity,
      pricePerKg,
      minPrice: Math.round(pricePerKg * 0.9 * 100) / 100,
      maxPrice: Math.round(pricePerKg * 1.1 * 100) / 100,
      arrivalDate: today,
      demandLevel: ["High", "Medium", "Low"][Math.floor(Math.random() * 3)],
      tradingHours: "6 AM - 2 PM",
    };
  });
};

/**
 * Find nearest mandis with prices and fare calculation
 */
export const findNearestMandis = async (commodity, quantityKg = 100) => {
  const userLocation = await getCurrentLocation();
  const prices = getCommodityPricesPerKg(commodity);

  // Calculate distance and fare for each mandi
  const mandisWithDetails = prices.map((price) => {
    const distance = calculateDistance(
      userLocation.lat,
      userLocation.lng,
      price.lat,
      price.lng
    );
    const transport = calculateTransportFare(distance, quantityKg);

    // Calculate profit
    const grossRevenue = price.pricePerKg * quantityKg;
    const netProfit = grossRevenue - transport.totalFare;
    const profitPerKg = Math.round((netProfit / quantityKg) * 100) / 100;

    return {
      ...price,
      distance,
      transport,
      grossRevenue: Math.round(grossRevenue),
      transportCost: transport.totalFare,
      netProfit: Math.round(netProfit),
      profitPerKg,
      profitMargin: Math.round((netProfit / grossRevenue) * 100),
      isProfitable: netProfit > 0,
    };
  });

  // Sort by: First profitable ones (by profit), then unprofitable ones (by loss)
  return mandisWithDetails.sort((a, b) => {
    if (a.isProfitable && !b.isProfitable) return -1;
    if (!a.isProfitable && b.isProfitable) return 1;
    return b.netProfit - a.netProfit;
  });
};

/**
 * Get smart selling recommendation
 */
export const getSmartSellingRecommendation = async (
  commodity,
  quantityKg,
  weatherData = null
) => {
  const mandis = await findNearestMandis(commodity, quantityKg);
  const bestMandi = mandis[0];
  const nearestMandi = [...mandis].sort((a, b) => a.distance - b.distance)[0];

  // Check if ALL mandis show loss
  const allLoss = mandis.every((m) => m.netProfit < 0);
  const profitableMandis = mandis.filter((m) => m.netProfit > 0);

  // Determine recommendation
  let recommendation = {
    action: "SELL",
    urgency: "medium",
    reason: "",
    warning: null,
  };

  if (allLoss) {
    recommendation.action = "HOLD OR INCREASE QUANTITY";
    recommendation.urgency = "low";
    recommendation.reason = `Transport costs exceed revenue for ${quantityKg}kg. Consider selling larger quantities or waiting for better prices.`;
    recommendation.warning = `At ${quantityKg}kg, transport costs are too high. Try increasing quantity to 200+ kg for better margins.`;
  } else if (profitableMandis.length === 1) {
    recommendation.action = "SELL NOW";
    recommendation.urgency = "high";
    recommendation.reason = `Only ${profitableMandis[0].market} offers profit. Act quickly!`;
  } else {
    // Check if prices are favorable
    const avgPrice =
      mandis.reduce((sum, m) => sum + m.pricePerKg, 0) / mandis.length;
    if (bestMandi.pricePerKg > avgPrice * 1.1) {
      recommendation.action = "SELL NOW";
      recommendation.urgency = "high";
      recommendation.reason = `Prices at ${bestMandi.market} are excellent. Good time to sell!`;
    } else if (bestMandi.netProfit > quantityKg * bestMandi.pricePerKg * 0.7) {
      recommendation.action = "SELL";
      recommendation.urgency = "medium";
      recommendation.reason = "Prices are good. Recommended to sell this week.";
    } else {
      recommendation.action = "SELL";
      recommendation.urgency = "low";
      recommendation.reason = "Prices are stable. Good for regular selling.";
    }
  }

  // Weather-based advice
  if (weatherData?.rainForecast) {
    recommendation.weatherAdvice =
      "Rain expected - transport early morning to avoid delays.";
  }

  // Calculate minimum quantity for profit
  let minQuantityForProfit = quantityKg;
  if (allLoss) {
    // Simple calculation: find quantity where revenue = transport cost
    const nearestDistance = nearestMandi.distance;
    const pricePerKg = bestMandi.pricePerKg;
    // Rough estimate: transport cost of ₹80 + ₹12/km for tempo
    minQuantityForProfit =
      Math.ceil((80 + nearestDistance * 12 * 1.5) / pricePerKg) + 10;
  }

  return {
    recommendation,
    bestOption: bestMandi.isProfitable
      ? {
        mandi: bestMandi.market,
        distance: bestMandi.distance,
        pricePerKg: bestMandi.pricePerKg,
        transportFare: bestMandi.transportCost,
        netProfit: bestMandi.netProfit,
        profitPerKg: bestMandi.profitPerKg,
        vehicle: bestMandi.transport.vehicle,
        bestTime: "Arrive before 8 AM for best prices",
        isProfitable: true,
      }
      : {
        mandi: bestMandi.market,
        distance: bestMandi.distance,
        pricePerKg: bestMandi.pricePerKg,
        transportFare: bestMandi.transportCost,
        netProfit: bestMandi.netProfit,
        profitPerKg: bestMandi.profitPerKg,
        vehicle: bestMandi.transport.vehicle,
        bestTime: "Not recommended - increase quantity",
        isProfitable: false,
      },
    nearestOption: {
      mandi: nearestMandi.market,
      distance: nearestMandi.distance,
      pricePerKg: nearestMandi.pricePerKg,
      transportFare: nearestMandi.transportCost,
      netProfit: nearestMandi.netProfit,
      profitPerKg: nearestMandi.profitPerKg,
      isProfitable: nearestMandi.netProfit > 0,
    },
    allMandis: mandis.slice(0, 5), // Top 5 options
    summary: {
      totalQuantity: quantityKg,
      commodity,
      avgMarketPrice:
        Math.round(
          (mandis.reduce((sum, m) => sum + m.pricePerKg, 0) / mandis.length) *
          100
        ) / 100,
      bestPossibleProfit: bestMandi.netProfit,
      transportSavings: Math.abs(
        bestMandi.transportCost - nearestMandi.transportCost
      ),
      allLoss,
      minQuantityForProfit: allLoss ? minQuantityForProfit : null,
      profitableMandisCount: profitableMandis.length,
    },
  };
};

/**
 * Get all commodities list
 */
export const getCommoditiesList = () => {
  return [
    "Tomato",
    "Potato",
    "Onion",
    "Rice",
    "Wheat",
    "Cotton",
    "Chilli Red",
    "Brinjal",
    "Cabbage",
    "Cauliflower",
    "Carrot",
    "Green Chilli",
    "Garlic",
    "Ginger",
    "Ladyfinger",
  ];
};

export default {
  getCurrentLocation,
  findNearestMandis,
  getSmartSellingRecommendation,
  getCommoditiesList,
};
