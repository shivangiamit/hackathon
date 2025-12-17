const simpleQueryExamples = [
  {
    // Watering Query
    context: {
      query: "Should I water my tomatoes now?",
      queryType: "watering",
      currentSensors: {
        moisture: 35,
        temperature: 28,
        humidity: 65,
        crop: "Tomato"
      },
      trends: {
        moisture: {
          current: 35,
          start: 55,
          change: -20,
          direction: "decreasing"
        }
      }
    },
    idealResponse: `**Yes, water now.**

Your soil moisture is 35% - below the optimal 40-70% range for tomatoes. It has dropped 20% over the past week, which is significant.

**Action Steps:**
1. Irrigate for 15-20 minutes
2. Target moisture level: 60-65%
3. Check again in 2-3 days

**💡 Tip:** At this rate of decrease (about 3% daily), consider watering every 2-3 days to maintain consistent moisture. Tomatoes need steady water to prevent blossom end rot.`
  },

  {
    // pH Status Query
    context: {
      query: "Is my soil pH okay?",
      queryType: "ph",
      currentSensors: {
        ph: 5.8,
        crop: "Tomato"
      },
      trends: {
        ph: {
          current: 5.8,
          start: 6.2,
          change: -0.4,
          direction: "decreasing"
        }
      }
    },
    idealResponse: `**Your pH is slightly low but manageable.**

Current pH is 5.8, just below the optimal 6.0-6.8 range for tomatoes. It's dropped 0.4 points recently, indicating increasing acidity.

**Action Steps:**
1. Add 100-150g of garden lime per square meter
2. Mix into top 10cm of soil
3. Recheck pH in 1-2 weeks

**Why it matters:** Slightly acidic soil can reduce nutrient availability, especially calcium and magnesium. This can lead to blossom end rot in tomatoes.`
  },

  {
    // Fertilizer Query
    context: {
      query: "Do I need to add fertilizer?",
      queryType: "fertilizer",
      currentSensors: {
        nitrogen: 120,
        phosphorus: 45,
        potassium: 160,
        crop: "Tomato"
      },
      trends: {
        nitrogen: {
          current: 120,
          start: 180,
          change: -60,
          direction: "decreasing"
        }
      }
    },
    idealResponse: `**Yes, add nitrogen-rich fertilizer.**

Your nitrogen is 120 ppm - below optimal (150-200 ppm for tomatoes). It has dropped significantly from 180 ppm. Phosphorus and potassium levels are good.

**Action Steps:**
1. Apply NPK 19-19-19 at 50g per plant
2. Dissolve in 2L water and apply to root zone
3. Or use urea at 30g per plant for quick nitrogen boost

**💡 Tip:** Nitrogen supports leafy growth and fruit development. Monitor weekly - if leaves start yellowing, that's another sign of nitrogen deficiency.`
  },

  {
    // Disease Prevention
    context: {
      query: "How do I prevent diseases in my crop?",
      queryType: "general",
      currentSensors: {
        temperature: 32,
        humidity: 85,
        moisture: 75,
        crop: "Tomato"
      }
    },
    idealResponse: `**Your current conditions favor fungal diseases - take preventive action.**

High humidity (85%) + high moisture (75%) + warm temperature (32°C) create ideal conditions for diseases like early blight and leaf mold.

**Preventive Steps:**
1. **Improve air circulation:** Prune lower leaves, space plants properly
2. **Reduce moisture on leaves:** Water at soil level, avoid overhead irrigation
3. **Apply preventive spray:** Neem oil (5ml/L water) weekly or copper fungicide
4. **Monitor daily:** Check undersides of leaves for spots

**⚠️ Alert:** Reduce irrigation slightly to bring moisture to 60-65%. Your humidity is naturally high, so avoid adding more moisture through over-watering.`
  },

  {
    // Motor Status Query
    context: {
      query: "Why isn't the motor running?",
      queryType: "general",
      currentSensors: {
        moisture: 65,
        motorStatus: false,
        manualMode: false,
        crop: "Rice"
      }
    },
    idealResponse: `**Motor is off because moisture is optimal.**

Your current moisture is 65%, which is within the good range for rice (typically 70-90%, but your system may be calibrated differently). The auto-irrigation system only activates when moisture drops below the minimum threshold.

**System Status:**
- ✅ Auto mode: Active
- ✅ Moisture: 65% (Good)
- Motor will start automatically when moisture drops

**If you need to water anyway:**
Switch to Manual Mode in the control panel, then you can start the motor manually.`
  }
];

/**
 * Complex Query Examples - Multi-step reasoning, comparisons
 */
const complexQueryExamples = [
  {
    // Crop Comparison
    context: {
      query: "Should I grow rice or wheat next season? Rice costs ₹40/kg to produce and sells for ₹60/kg. Wheat costs ₹25/kg to produce and sells for ₹45/kg.",
      queryType: "general",
      currentSensors: {
        moisture: 55,
        ph: 6.2,
        temperature: 28,
        crop: "Tomato"
      }
    },
    idealResponse: `**Based on your conditions and economics, I recommend wheat.**

**Analysis:**

**1. Profitability:**
- Rice: ₹20/kg profit (₹60 - ₹40)
- Wheat: ₹20/kg profit (₹45 - ₹25)
- Similar margins, but wheat has lower upfront cost

**2. Your Soil Conditions:**
- pH 6.2: Good for both, but wheat prefers 6.0-7.0 (better match)
- Current moisture 55%: Wheat needs moderate water (30-60%), rice needs high water (70-90%)

**3. Resource Requirements:**
- Rice: High water demand, labor-intensive, needs standing water
- Wheat: Moderate water, less labor, drought-resistant

**4. Climate:**
- Temperature 28°C: Both suitable, but wheat prefers cooler (15-25°C)

**Recommendation:** Wheat is more suitable given your current moisture management and pH. Lower production costs reduce risk. However, if you can maintain standing water and have reliable irrigation, rice could work in warmer months.

**Next Steps:**
1. Test soil structure (rice needs clayey soil)
2. Assess water availability for entire season
3. Check local market demand`
  },

  {
    // Problem Diagnosis
    context: {
      query: "My tomato leaves are turning yellow. What's wrong?",
      queryType: "disease",
      currentSensors: {
        nitrogen: 95,
        ph: 5.2,
        moisture: 80,
        temperature: 30,
        crop: "Tomato"
      },
      trends: {
        nitrogen: {
          change: -55,
          direction: "decreasing"
        },
        moisture: {
          change: 15,
          direction: "increasing"
        }
      }
    },
    idealResponse: `**Multiple issues detected - likely nitrogen deficiency + waterlogging.**

**Analysis:**

**1. Nitrogen Deficiency (Primary cause):**
- Current: 95 ppm (low - optimal is 150-200 ppm)
- Trend: Dropped 55 ppm recently (severe depletion)
- Symptom match: Yellowing starts from lower leaves upward

**2. Waterlogging (Contributing factor):**
- Moisture: 80% (too high - max 70% for tomatoes)
- Trend: Increasing by 15%
- Effect: Reduces root oxygen, limits nutrient uptake

**3. pH Issue (Aggravating factor):**
- Current: 5.2 (too acidic - optimal 6.0-6.8)
- Effect: Reduces nitrogen availability even further

**Treatment Plan:**

**Immediate (Today):**
1. Reduce watering - let soil dry to 60%
2. Apply nitrogen fertilizer (urea 30g/plant or NPK 19-19-19 50g/plant)

**Within 3 days:**
1. Add garden lime (150g/m²) to raise pH
2. Improve drainage if water pools

**Within 1 week:**
1. Remove severely yellowed leaves
2. Monitor new growth

**Expected Recovery:** 5-7 days for new leaves to show green color.

**⚠️ Important:** Address all three issues. Fixing only nitrogen won't help if roots are drowning and pH prevents nutrient uptake.`
  }
];

/**
 * Examples showing good data referencing
 */
const dataReferenceExamples = [
  {
    context: {
      query: "Tell me about my farm's status",
      pastConversations: [
        {
          daysAgo: 3,
          query: "Should I add potassium?",
          wasSuccessful: true
        },
        {
          daysAgo: 7,
          query: "Is watering needed?",
          wasSuccessful: true
        }
      ],
      trends: {
        moisture: { change: -18, direction: "decreasing" },
        ph: { change: 0.3, direction: "increasing" }
      }
    },
    idealResponse: `**Your farm is stable with good management decisions.**

**Recent Patterns:**
- ✅ Your potassium application 3 days ago was successful
- ✅ Your watering schedule 7 days ago maintained good moisture
- 📊 Moisture trending down 18% - you're due for irrigation soon
- 📊 pH rising by 0.3 (likely from your lime/potassium treatment)

**Current Status:** All parameters within acceptable ranges. Continue monitoring moisture - based on the 18% drop trend, you'll need to water in 1-2 days.

**💡 Your irrigation timing has been excellent** - you've maintained consistent moisture without over-watering.`
  }
];

/**
 * Examples showing uncertainty handling
 */
const uncertaintyExamples = [
  {
    context: {
      query: "My plants look weak, what's wrong?",
      currentSensors: {
        moisture: 55,
        ph: 6.5,
        nitrogen: 160,
        temperature: 27
      }
    },
    idealResponse: `**Need more information to diagnose accurately.**

Your sensor readings look normal (moisture 55%, pH 6.5, nitrogen 160 ppm, temp 27°C), so the issue might not be soil-related.

**Could be:**
1. **Pest damage** - Check for aphids, whiteflies on undersides of leaves
2. **Disease** - Look for spots, mold, or discoloration on leaves
3. **Root issues** - Could be root rot if soil drains poorly
4. **Micronutrient deficiency** - Our sensors don't measure iron, magnesium, etc.

**What to check:**
- Are leaves drooping or crispy?
- Any visible insects or spots?
- Does soil drain well after watering?
- Color of leaves (pale green, dark spots, yellowing pattern)?

**Please provide these details** and I can give you a specific diagnosis and treatment plan.`
  }
];

/**
 * Get few-shot examples formatted for LLM prompt
 */
const getFewShotPrompt = (queryType = 'simple') => {
  const examples = queryType === 'complex' ? complexQueryExamples : simpleQueryExamples;
  
  let prompt = '\n# EXAMPLE RESPONSES:\n\n';
  prompt += 'Here are examples of ideal responses to guide your answers:\n\n';
  
  examples.slice(0, 2).forEach((example, i) => {
    prompt += `## Example ${i + 1}:\n`;
    prompt += `**User Query:** "${example.context.query}"\n`;
    prompt += `**Ideal Response:**\n${example.idealResponse}\n\n`;
  });
  
  prompt += '---\n\n';
  prompt += 'Now answer the farmer\'s actual question following this pattern:\n';
  prompt += '- Reference specific sensor data\n';
  prompt += '- Explain reasoning clearly\n';
  prompt += '- Provide actionable steps\n';
  prompt += '- Add helpful tips\n\n';
  
  return prompt;
};

/**
 * Get examples for specific query type
 */
const getExamplesByType = (queryType) => {
  const typeMap = {
    'watering': [simpleQueryExamples[0]],
    'ph': [simpleQueryExamples[1]],
    'fertilizer': [simpleQueryExamples[2]],
    'disease': [simpleQueryExamples[3], complexQueryExamples[1]],
    'general': [simpleQueryExamples[4], complexQueryExamples[0]],
    'complex': complexQueryExamples
  };
  
  return typeMap[queryType] || simpleQueryExamples.slice(0, 2);
};

module.exports = {
  simpleQueryExamples,
  complexQueryExamples,
  dataReferenceExamples,
  uncertaintyExamples,
  getFewShotPrompt,
  getExamplesByType
};