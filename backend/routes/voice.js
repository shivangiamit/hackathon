const express = require('express');
const router = express.Router();
const multer = require('multer');
const whisperService = require('../services/whisperService');
const ttsService = require('../services/ttsService');
const aiService = require('../services/aiService');
const memoryService = require('../services/memoryService');
const { SensorHistory } = require('../models/SensorHistory');

// Multer config for audio uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit (Whisper limit)
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm',
      'audio/ogg', 'audio/flac', 'audio/aac'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}`));
    }
  }
});

/**
 * POST /api/voice/transcribe
 * Convert speech (audio) to text
 * 
 * Request:
 *   - file: audio file (multipart)
 *   - language: optional language code (e.g., 'en', 'hi')
 * 
 * Response:
 *   { text, language, timestamp, duration }
 */
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided'
      });
    }

    const language = req.body.language || null;
    console.log(`\n🎤 Transcribing audio (${(req.file.size / 1024).toFixed(2)} KB)`);

    // Transcribe using Whisper
    const result = await whisperService.transcribeAudio(req.file.buffer, language);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    console.log(`✅ Transcription: "${result.text}"`);
    console.log(`   Language: ${result.language}`);

    res.json({
      success: true,
      text: result.text,
      language: result.language,
      duration: result.duration,
      confidence: result.confidence,
      timestamp: result.timestamp
    });

  } catch (error) {
    console.error('❌ Transcription error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/voice/chat
 * Complete voice chat: transcribe → process → synthesize
 * 
 * Request:
 *   - file: audio file (multipart)
 *   - userId: farmer ID (optional)
 *   - language: language code (optional, auto-detected)
 * 
 * Response:
 *   {
 *     query: transcribed text,
 *     language: detected language,
 *     response: AI text response,
 *     audioBuffer: base64 encoded audio,
 *     audioFormat: mp3/wav/etc,
 *     insights: { ... },
 *     actions: [ ... ],
 *     alerts: [ ... ]
 *   }
 */
router.post('/chat', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided'
      });
    }

    const userId = req.body.userId || 'farmer_001';
    const requestedLanguage = req.body.language || null;

    console.log(`\n🎤 Voice chat started for ${userId}`);

    // ============ STEP 1: TRANSCRIBE AUDIO ============
    const transcription = await whisperService.transcribeAudio(
      req.file.buffer,
      requestedLanguage
    );

    if (!transcription.success) {
      return res.status(500).json({
        success: false,
        error: `Transcription failed: ${transcription.error}`
      });
    }

    const query = transcription.text;
    const detectedLanguage = transcription.language;

    console.log(`📝 Transcribed: "${query}"`);
    console.log(`🌍 Language: ${detectedLanguage}`);

    // ============ STEP 2: PROCESS QUERY ============
    // Get current sensor data
    const latestSensor = await SensorHistory.getLatestReading(userId);

    if (!latestSensor) {
      return res.status(400).json({
        success: false,
        error: 'No sensor data available'
      });
    }

    const currentSensors = {
      moisture: latestSensor.moisture,
      ph: latestSensor.ph,
      nitrogen: latestSensor.nitrogen,
      phosphorus: latestSensor.phosphorus,
      potassium: latestSensor.potassium,
      temperature: latestSensor.temperature,
      humidity: latestSensor.humidity,
      crop: latestSensor.cropType,
      motorStatus: latestSensor.motorStatus,
      manualMode: latestSensor.manualMode
    };

    console.log(`🧠 Processing query through LangGraph...`);

    // Process through AI
    const aiResult = await aiService.processQuery(userId, query, currentSensors);

    if (!aiResult.success) {
      return res.status(500).json({
        success: false,
        error: `AI processing failed: ${aiResult.error}`,
        query,
        language: detectedLanguage
      });
    }

    const aiResponse = aiResult.response;
    console.log(`💬 AI Response: "${aiResponse.substring(0, 50)}..."`);

    // ============ STEP 3: SYNTHESIZE SPEECH ============
    const voice = req.body.voice || 'nova';
    const speed = parseFloat(req.body.speed) || 1.0;

    console.log(`🔊 Synthesizing speech (${voice}, speed: ${speed})...`);

    const ttsResult = await ttsService.textToSpeech(aiResponse, {
      language: detectedLanguage,
      voice,
      format: 'mp3',
      speed
    });

    if (!ttsResult.success) {
      return res.status(500).json({
        success: false,
        error: `Speech synthesis failed: ${ttsResult.error}`,
        query,
        response: aiResponse
      });
    }

    console.log(`✅ Voice chat complete!`);

    // ============ RESPONSE ============
    res.json({
      success: true,
      
      // Original query
      query,
      language: detectedLanguage,
      
      // AI response
      response: aiResponse,
      insights: aiResult.insights,
      actions: aiResult.actions,
      alerts: aiResult.alerts,
      
      // Audio response
      audio: ttsResult.audioBuffer.toString('base64'),
      audioFormat: ttsResult.audioFormat,
      audioSize: ttsResult.size,
      
      // Metadata
      conversationId: aiResult.conversationId,
      processingTime: aiResult.processingTime + ttsResult.processingTime,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('❌ Voice chat error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/voice/synthesize
 * Convert text to speech only
 * 
 * Request:
 *   - text: text to convert
 *   - voice: voice name (nova, echo, alloy, etc.)
 *   - language: language code
 *   - speed: 0.25 - 4.0
 * 
 * Response:
 *   { audio (base64), audioFormat, audioSize }
 */
router.post('/synthesize', async (req, res) => {
  try {
    const { text, voice = 'nova', language = 'en', speed = 1.0 } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Text cannot be empty'
      });
    }

    console.log(`🔊 Synthesizing: "${text.substring(0, 50)}..."`);

    const result = await ttsService.textToSpeech(text, {
      language,
      voice,
      format: 'mp3',
      speed
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      audio: result.audioBuffer.toString('base64'),
      audioFormat: result.audioFormat,
      audioSize: result.size,
      voice,
      language,
      speed,
      processingTime: result.processingTime
    });

  } catch (error) {
    console.error('❌ Synthesis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/voice/languages
 * Get supported languages
 */
router.get('/languages', (req, res) => {
  const languages = whisperService.getLanguagesForUI();

  res.json({
    success: true,
    count: languages.length,
    languages
  });
});

/**
 * GET /api/voice/voices
 * Get available TTS voices
 */
router.get('/voices', (req, res) => {
  const voices = ttsService.getVoicesForUI();

  res.json({
    success: true,
    count: voices.length,
    voices
  });
});

/**
 * GET /api/voice/info
 * Get voice system information
 */
router.get('/info', (req, res) => {
  res.json({
    success: true,
    system: {
      stt: 'OpenAI Whisper API',
      tts: 'OpenAI TTS API',
      supportedLanguages: Object.keys(whisperService.getSupportedLanguages()).length,
      supportedVoices: Object.keys(ttsService.getSupportedVoices()).length,
      supportedFormats: Object.keys(ttsService.getSupportedFormats()).length,
      maxAudioSize: '25MB',
      pricing: {
        whisper: '$0.02 per minute',
        tts: '$0.015 per 1K characters'
      }
    }
  });
});

module.exports = router;