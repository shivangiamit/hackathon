const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { ChatOpenAI } = require('@langchain/openai');
const { StateGraph, Annotation, START, END } = require('@langchain/langgraph');
const { PromptTemplate, ChatPromptTemplate } = require('@langchain/core/prompts');
const { RunnableSequence } = require('@langchain/core/runnables');
const memoryService = require('./memoryService');
const { getSystemPrompt, getSimpleQueryPrompt, getComplexQueryPrompt, getRetryPrompt } = require('../prompts/systemPrompt');
const { getFewShotPrompt, getExamplesByType } = require('../prompts/fewShotExamples');
const { getJudgePrompt, getRetryPrompt: getJudgeRetryPrompt } = require('../prompts/judgePrompt');
const Conversation = require('../models/Conversation');

/**
 * State Annotation for LangGraph
 */
const StateAnnotation = Annotation.Root({
  query: Annotation({
    value: String,
    default: () => ''
  }),
  userId: Annotation({
    value: String,
    default: () => 'farmer_001'
  }),
  currentSensors: Annotation({
    value: Object,
    default: () => ({})
  }),
  queryType: Annotation({
    value: String,
    default: () => 'general'
  }),
  enrichedContext: Annotation({
    value: Object,
    default: () => null
  }),
  timestamp: Annotation({
    value: Number,
    default: () => Date.now()
  }),
  classification: Annotation({
    value: Object,
    default: () => null
  }),
  aiResponse: Annotation({
    value: String,
    default: () => ''
  }),
  judgement: Annotation({
    value: Object,
    default: () => null
  }),
  retryCount: Annotation({
    value: Number,
    default: () => 0
  }),
  formattedResponse: Annotation({
    value: Object,
    default: () => null
  }),
  conversationId: Annotation({
    value: String,
    default: () => ''
  }),
  stage: Annotation({
    value: String,
    default: () => 'start'
  }),
  error: Annotation({
    value: String,
    default: () => ''
  })
});

class AIService {
  constructor() {
    // Initialize LLMs using LangChain
    this.gemini = new ChatGoogleGenerativeAI({
      model: 'gemini-2.5-flash',
      apiKey: process.env.GOOGLE_API_KEY,
      maxOutputTokens: 2048
    });

    this.gpt4mini = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      apiKey: process.env.OPENAI_API_KEY,
      maxTokens: 1000
    });

    // Initialize StateGraph with Annotation
    this.graph = new StateGraph(StateAnnotation);
    this._buildGraph();
  }

  /**
   * Build the LangGraph with nodes and edges
   */
  _buildGraph() {
    // Add nodes first
    this.graph.addNode('node1_contextBuilder', this.node1_contextBuilder.bind(this));
    this.graph.addNode('node2_queryClassifier', this.node2_queryClassifier.bind(this));
    this.graph.addNode('node3_responseGenerator', this.node3_responseGenerator.bind(this));
    this.graph.addNode('node4_judgeEvaluator', this.node4_judgeEvaluator.bind(this));
    this.graph.addNode('node4_1_enhancedRetry', this.node4_1_enhancedRetry.bind(this));
    this.graph.addNode('node5_responseFormatter', this.node5_responseFormatter.bind(this));
    this.graph.addNode('node6_storageAndLearning', this.node6_storageAndLearning.bind(this));

    // Add edges using START and END constants
    this.graph.addEdge(START, 'node1_contextBuilder');
    this.graph.addEdge('node1_contextBuilder', 'node2_queryClassifier');
    this.graph.addEdge('node2_queryClassifier', 'node3_responseGenerator');
    this.graph.addEdge('node3_responseGenerator', 'node4_judgeEvaluator');

    // Conditional edge: Judge decision
    this.graph.addConditionalEdges(
      'node4_judgeEvaluator',
      (state) => {
        if (state.judgement?.score >= 85) {
          return 'node5_responseFormatter';
        } else {
          return 'node4_1_enhancedRetry';
        }
      },
      {
        'node5_responseFormatter': 'node5_responseFormatter',
        'node4_1_enhancedRetry': 'node4_1_enhancedRetry'
      }
    );

    // Conditional edge: After retry
    this.graph.addConditionalEdges(
      'node4_1_enhancedRetry',
      (state) => {
        if (state.retryCount >= 1) {
          return 'node5_responseFormatter';
        } else {
          return 'node4_judgeEvaluator';
        }
      },
      {
        'node4_judgeEvaluator': 'node4_judgeEvaluator',
        'node5_responseFormatter': 'node5_responseFormatter'
      }
    );

    this.graph.addEdge('node5_responseFormatter', 'node6_storageAndLearning');
    this.graph.addEdge('node6_storageAndLearning', END);

    // Compile graph
    this.compiledGraph = this.graph.compile();
  }

  /**
   * ==================== NODE 1: Context Builder ====================
   */
  async node1_contextBuilder(state) {
    console.log('📋 NODE 1: Context Builder - Building enriched context...');

    try {
      const enrichedContext = await memoryService.buildEnrichedContext(
        state.userId,
        state.query,
        state.currentSensors,
        state.queryType
      );

      return {
        ...state,
        enrichedContext,
        timestamp: Date.now(),
        stage: 'context_built'
      };
    } catch (error) {
      console.error('❌ NODE 1 Error:', error);
      return {
        ...state,
        error: `Context building failed: ${error.message}`,
        stage: 'error'
      };
    }
  }

  /**
   * ==================== NODE 2: Query Classifier ====================
   */
  async node2_queryClassifier(state) {
    console.log('🔍 NODE 2: Query Classifier - Classifying query...');

    try {
      const classificationPrompt = PromptTemplate.fromTemplate(`You are an agricultural query classifier. Classify this farmer's query.

Query: "{query}"

Respond ONLY with JSON (no markdown):
{{
  "type": "watering|disease|fertilizer|pest|weather|ph|nutrients|general",
  "complexity": "simple|complex",
  "intent": "question|alert|prediction|comparison",
  "requiresSubQueries": true|false,
  "subQueries": ["q1", "q2"] or []
}}`);

      const chain = classificationPrompt.pipe(this.gemini);
      const result = await chain.invoke({ query: state.query });

      let classification = {
        type: state.queryType || 'general',
        complexity: 'simple',
        intent: 'question',
        requiresSubQueries: false,
        subQueries: []
      };

      try {
        const responseText = result.content || result.text || '';
        const cleanedText = responseText.replace(/```json\n?|\n?```/g, '').trim();
        classification = JSON.parse(cleanedText);
      } catch (parseError) {
        console.warn('Warning: Could not parse classification JSON, using defaults');
      }

      return {
        ...state,
        classification,
        stage: 'classified'
      };
    } catch (error) {
      console.error('❌ NODE 2 Error:', error);
      return {
        ...state,
        classification: {
          type: state.queryType || 'general',
          complexity: 'simple',
          intent: 'question',
          requiresSubQueries: false,
          subQueries: []
        },
        stage: 'classified'
      };
    }
  }

  /**
   * ==================== NODE 3: Response Generator ====================
   */
  async node3_responseGenerator(state) {
    const { query, classification, enrichedContext, currentSensors } = state;
    const complexity = classification.complexity;

    console.log(`💬 NODE 3: Response Generator [${complexity.toUpperCase()}]...`);

    try {
      let response;

      if (complexity === 'complex') {
        response = await this._handleComplexQuery(state);
      } else {
        response = await this._handleSimpleQuery(state);
      }

      return {
        ...state,
        aiResponse: response,
        stage: 'response_generated',
        retryCount: 0
      };
    } catch (error) {
      console.error('❌ NODE 3 Error:', error);
      return {
        ...state,
        error: `Response generation failed: ${error.message}`,
        stage: 'error'
      };
    }
  }

  /**
   * Handle simple queries
   */
  async _handleSimpleQuery(state) {
    const { query, enrichedContext, currentSensors } = state;
    const formattedContext = memoryService.formatContextForAI(enrichedContext);

    const systemPrompt = getSystemPrompt(currentSensors.crop);
    const fewShotPrompt = getFewShotPrompt('simple');

    const fullPrompt = `${systemPrompt}

${fewShotPrompt}

# FARMER'S CURRENT SITUATION:
${formattedContext}

# FARMER'S QUESTION:
${query}

Provide a direct, practical answer with specific recommendations.`;

    const messages = [
      {
        role: 'user',
        content: fullPrompt
      }
    ];

    const result = await this.gemini.invoke(messages);
    return result.content || result.text || '';
  }

  /**
   * Handle complex queries
   */
  async _handleComplexQuery(state) {
    const { query, enrichedContext, currentSensors, classification } = state;
    const formattedContext = memoryService.formatContextForAI(enrichedContext);

    const systemPrompt = getSystemPrompt(currentSensors.crop);
    const fewShotPrompt = getFewShotPrompt('complex');

    let subQueryContext = '';
    if (classification.requiresSubQueries && classification.subQueries.length > 0) {
      subQueryContext = `\n\nBreak down analysis into these areas:\n${classification.subQueries
        .map((sq, i) => `${i + 1}. ${sq}`)
        .join('\n')}`;
    }

    const fullPrompt = `${systemPrompt}

${fewShotPrompt}

# FARMER'S CURRENT SITUATION:
${formattedContext}

# COMPLEX QUESTION:
${query}
${subQueryContext}

This is a complex query requiring detailed analysis. Show your reasoning step-by-step and provide comprehensive recommendations.`;

    const messages = [
      {
        role: 'user',
        content: fullPrompt
      }
    ];

    const result = await this.gemini.invoke(messages);
    return result.content || result.text || '';
  }

  /**
   * ==================== NODE 4: Judge Evaluator ====================
   */
  async node4_judgeEvaluator(state) {
    const { query, aiResponse, enrichedContext } = state;

    console.log('⚖️  NODE 4: Judge Evaluator - Scoring response...');

    try {
      const judgePrompt = getJudgePrompt(query, aiResponse, enrichedContext);

      const messages = [
        {
          role: 'user',
          content: judgePrompt
        }
      ];

      const result = await this.gpt4mini.invoke(messages);
      const responseText = result.content || result.text || '';

      let judgement = {
        score: 75,
        breakdown: {},
        strengths: [],
        weaknesses: ['Could not evaluate'],
        suggestions: [],
        reasoning: 'Evaluation failed'
      };

      try {
        const cleanedText = responseText.replace(/```json\n?|\n?```/g, '').trim();
        judgement = JSON.parse(cleanedText);
      } catch (parseError) {
        console.warn('Warning: Could not parse judge JSON');
      }

      console.log(`📊 Judge Score: ${judgement.score}/100`);

      return {
        ...state,
        judgement,
        stage: judgement.score >= 85 ? 'judge_approved' : 'judge_rejected'
      };
    } catch (error) {
      console.error('❌ NODE 4 Error:', error);
      return {
        ...state,
        judgement: {
          score: 75,
          reasoning: 'Judge unavailable, proceeding with caution'
        },
        stage: 'judge_approved_with_warning'
      };
    }
  }

  /**
   * ==================== NODE 4.1: Enhanced Retry ====================
   */
  async node4_1_enhancedRetry(state) {
    const { query, judgement, enrichedContext, currentSensors, retryCount } = state;

    console.log(`🔄 NODE 4.1: Enhanced Retry (Attempt ${retryCount + 1})...`);

    if (retryCount >= 1) {
      console.log('⚠️  Max retries reached, proceeding with current response');
      return {
        ...state,
        stage: 'max_retries_reached'
      };
    }

    try {
      const retryPrompt = getJudgeRetryPrompt(query, state.aiResponse, judgement, enrichedContext);
      const systemPrompt = getSystemPrompt(currentSensors.crop);

      const fullPrompt = `${systemPrompt}

${retryPrompt}`;

      const messages = [
        {
          role: 'user',
          content: fullPrompt
        }
      ];

      const result = await this.gemini.invoke(messages);
      const improvedResponse = result.content || result.text || state.aiResponse;

      return {
        ...state,
        aiResponse: improvedResponse,
        retryCount: retryCount + 1,
        stage: 'response_improved'
      };
    } catch (error) {
      console.error('❌ NODE 4.1 Error:', error);
      return {
        ...state,
        stage: 'retry_failed'
      };
    }
  }

  /**
   * ==================== NODE 5: Response Formatter ====================
   */
  async node5_responseFormatter(state) {
    console.log('✨ NODE 5: Response Formatter - Formatting response...');

    try {
      const { aiResponse, enrichedContext, judgement } = state;

      const formatted = {
        response: aiResponse,
        insights: this._extractInsights(aiResponse, enrichedContext),
        actions: this._extractActions(aiResponse),
        alerts: this._extractAlerts(aiResponse, enrichedContext)
      };

      return {
        ...state,
        formattedResponse: formatted,
        stage: 'response_formatted'
      };
    } catch (error) {
      console.error('❌ NODE 5 Error:', error);

      return {
        ...state,
        formattedResponse: {
          response: state.aiResponse,
          insights: {},
          actions: [],
          alerts: []
        },
        stage: 'response_formatted_with_error'
      };
    }
  }

  /**
   * Extract insights from response
   */
  _extractInsights(response, enrichedContext) {
    const insights = {};
    const { trends, pastConversations } = enrichedContext;

    if (trends) {
      for (const [param, data] of Object.entries(trends)) {
        if (data && data.direction && response.toLowerCase().includes(param)) {
          insights[`${param}_trend`] = `${param} is ${data.direction} by ${Math.abs(data.change).toFixed(2)}`;
        }
      }
    }

    if (pastConversations && pastConversations.length > 0) {
      const lastSuccess = pastConversations.find(c => c.wasSuccessful);
      if (lastSuccess) {
        insights.history = `Last successful: ${lastSuccess.query} (${lastSuccess.daysAgo}d ago)`;
      }
    }

    return insights;
  }

  /**
   * Extract actionable items
   */
  _extractActions(response) {
    const actions = [];

    const actionPatterns = [
      /\d+\.\s+([^.\n]+)/g,
      /[-•]\s+([^.\n]+)/g
    ];

    for (const pattern of actionPatterns) {
      let match;
      while ((match = pattern.exec(response)) !== null) {
        const action = match[1].trim();
        if (action.length > 10 && action.length < 150) {
          actions.push({
            action,
            priority: this._determinePriority(action)
          });
        }
      }
    }

    return actions.slice(0, 5);
  }

  /**
   * Determine priority
   */
  _determinePriority(actionText) {
    const urgent = ['immediately', 'urgent', 'critical', 'now', 'today', 'asap'];
    const high = ['soon', 'quickly', 'within 1-2 days', 'important'];

    const text = actionText.toLowerCase();

    if (urgent.some(w => text.includes(w))) return 'urgent';
    if (high.some(w => text.includes(w))) return 'high';
    if (text.includes('within')) return 'medium';

    return 'low';
  }

  /**
   * Extract alerts
   */
  _extractAlerts(response, enrichedContext) {
    const alerts = [];
    const { anomalies } = enrichedContext;

    if (anomalies && anomalies.length > 0) {
      anomalies
        .filter(a => a.severity === 'high')
        .forEach(a => {
          alerts.push(`⚠️  ${a.message}`);
        });
    }

    const criticalKeywords = ['critical', 'dangerous', 'must', 'immediately', 'urgent'];
    const responseLower = response.toLowerCase();

    if (criticalKeywords.some(k => responseLower.includes(k.toLowerCase()))) {
      const criticalSentences = response.match(/[^.!?]*(?:critical|dangerous|must|immediately|urgent)[^.!?]*[.!?]/gi);
      if (criticalSentences) {
        criticalSentences.slice(0, 2).forEach(sentence => {
          const clean = sentence.trim();
          if (!alerts.includes(clean)) {
            alerts.push(clean);
          }
        });
      }
    }

    return alerts.slice(0, 3);
  }

  /**
   * ==================== NODE 6: Storage & Learning ====================
   */
  async node6_storageAndLearning(state) {
    console.log('💾 NODE 6: Storage & Learning - Saving conversation...');

    try {
      const { userId, query, aiResponse, formattedResponse, enrichedContext, classification, judgement, timestamp } = state;

      const conversationData = {
        userId,
        query,
        queryType: classification.type,
        queryComplexity: classification.complexity,
        sensorSnapshot: enrichedContext.currentSensors,
        cropType: enrichedContext.currentSensors.crop,

        contextUsed: {
          pastConversationsCount: enrichedContext.pastConversations?.length || 0,
          sensorTrendDays: 30,
          similarQueriesFound: enrichedContext.similarQueries?.length || 0
        },

        langgraphState: {
          classificationResult: classification,
          subQueries: classification.subQueries || [],
          judgeScore: judgement?.score || 0,
          retriesNeeded: state.retryCount || 0,
          processingTimeMs: Date.now() - timestamp
        },

        aiResponse,
        confidence: judgement?.score || 75,
        reasoning: [
          judgement?.reasoning || 'Response generated and evaluated',
          ...Object.values(formattedResponse?.insights || {})
        ].filter(r => typeof r === 'string'),
        recommendations: formattedResponse?.actions || [],

        tags: [classification.type, classification.complexity, ...(classification.subQueries || [])]
      };

      const savedConversation = await memoryService.storeConversation(conversationData);

      return {
        ...state,
        conversationId: savedConversation._id.toString(),
        stage: 'complete'
      };
    } catch (error) {
      console.error('❌ NODE 6 Error:', error);
      return {
        ...state,
        stage: 'complete_with_error'
      };
    }
  }

  /**
   * ==================== MAIN ORCHESTRATOR ====================
   */
  async processQuery(userId, query, currentSensors) {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 STARTING LANGGRAPH WORKFLOW');
    console.log('='.repeat(60) + '\n');

    const startTime = Date.now();

    try {
      const initialState = {
        query,
        userId: userId || 'farmer_001',
        currentSensors,
        queryType: 'general',
        enrichedContext: null,
        timestamp: startTime,
        classification: null,
        aiResponse: null,
        judgement: null,
        retryCount: 0,
        formattedResponse: null,
        conversationId: null,
        stage: 'start',
        error: null
      };

      const finalState = await this.compiledGraph.invoke(initialState);

      const processingTime = Date.now() - startTime;
      console.log(`\n✅ WORKFLOW COMPLETE (${processingTime}ms)\n`);

      return {
        success: !finalState.error,
        conversationId: finalState.conversationId,
        response: finalState.formattedResponse?.response || 'Unable to process query',
        insights: finalState.formattedResponse?.insights || {},
        actions: finalState.formattedResponse?.actions || [],
        alerts: finalState.formattedResponse?.alerts || [],
        processingTime,
        error: finalState.error
      };
    } catch (error) {
      console.error('\n❌ WORKFLOW FAILED:', error.message);

      const processingTime = Date.now() - startTime;
      return {
        success: false,
        error: error.message,
        response: 'I apologize, but I encountered an issue processing your query. Please try again.',
        processingTime
      };
    }
  }
}

module.exports = new AIService();