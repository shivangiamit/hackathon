const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Whisper Service - Speech to Text
 * Handles audio transcription with automatic language detection
 */
class WhisperService {
  /**
   * Transcribe audio file to text with language detection
   * Supports: MP3, MP4, MPEG, MPGA, M4A, WAV, WEBM
   * 
   * @param {Buffer | string} audio - Audio file buffer or file path
   * @param {string} language - Optional language code (e.g., 'en', 'hi', 'mr')
   * @returns {Object} - { text, language, duration, confidence }
   */
  async transcribeAudio(audio, language = null) {
    try {
      console.log('🎤 Transcribing audio with Whisper...');

      // Convert buffer or file path to proper format for API
      let audioBuffer;
      let filename = 'audio.wav';

      if (typeof audio === 'string') {
        // File path provided
        if (!fs.existsSync(audio)) {
          throw new Error(`Audio file not found: ${audio}`);
        }
        audioBuffer = fs.readFileSync(audio);
        filename = path.basename(audio);
      } else if (Buffer.isBuffer(audio)) {
        // Buffer provided
        audioBuffer = audio;
      } else {
        throw new Error('Audio must be Buffer or file path');
      }

      // Prepare request parameters
      const params = {
        file: audioBuffer,
        model: 'whisper-1',
        response_format: 'json'
      };

      // Add language if specified (improves accuracy)
      if (language) {
        params.language = language;
      }

      // Call Whisper API
      const response = await openai.audio.transcriptions.create(params);

      console.log(`✅ Transcription complete:`);
      console.log(`   Text: ${response.text.substring(0, 50)}...`);
      console.log(`   Language: ${response.language || 'auto-detected'}`);

      return {
        success: true,
        text: response.text,
        language: response.language || 'unknown',
        duration: Math.round(audioBuffer.length / 32000), // Approximate
        confidence: 0.95, // Whisper doesn't provide confidence, using default
        timestamp: new Date()
      };
    } catch (error) {
      console.error('❌ Whisper transcription error:', error);
      return {
        success: false,
        error: error.message,
        text: null,
        language: null
      };
    }
  }

  /**
   * Transcribe audio with verbose output (includes timestamps)
   * Useful for debugging and understanding processing
   * 
   * @param {Buffer | string} audio - Audio file
   * @param {string} language - Optional language code
   * @returns {Object} - Detailed transcription with timing info
   */
  async transcribeAudioVerbose(audio, language = null) {
    try {
      console.log('🎤 Transcribing with verbose output...');

      let audioBuffer;
      if (typeof audio === 'string') {
        audioBuffer = fs.readFileSync(audio);
      } else if (Buffer.isBuffer(audio)) {
        audioBuffer = audio;
      } else {
        throw new Error('Audio must be Buffer or file path');
      }

      const startTime = Date.now();

      const params = {
        file: audioBuffer,
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment']
      };

      if (language) {
        params.language = language;
      }

      const response = await openai.audio.transcriptions.create(params);

      const processingTime = Date.now() - startTime;

      console.log(`✅ Verbose transcription complete:`);
      console.log(`   Processing time: ${processingTime}ms`);
      console.log(`   Duration: ${response.duration}s`);
      console.log(`   Segments: ${response.segments?.length || 0}`);

      return {
        success: true,
        text: response.text,
        language: response.language || 'unknown',
        duration: response.duration,
        segments: response.segments || [],
        processingTime,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('❌ Verbose transcription error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Detect language from audio without transcribing
   * Useful for UI language selection
   * 
   * @param {Buffer | string} audio - Audio file
   * @returns {string} - Detected language code (e.g., 'en', 'hi', 'es')
   */
  async detectLanguage(audio) {
    try {
      console.log('🔍 Detecting language from audio...');

      let audioBuffer;
      if (typeof audio === 'string') {
        audioBuffer = fs.readFileSync(audio);
      } else if (Buffer.isBuffer(audio)) {
        audioBuffer = audio;
      } else {
        throw new Error('Audio must be Buffer or file path');
      }

      // Transcribe with language detection
      const response = await openai.audio.transcriptions.create({
        file: audioBuffer,
        model: 'whisper-1'
      });

      const detectedLanguage = response.language || 'unknown';
      console.log(`✅ Detected language: ${detectedLanguage}`);

      return detectedLanguage;
    } catch (error) {
      console.error('❌ Language detection error:', error);
      return 'unknown';
    }
  }

  /**
   * Supported languages in Whisper
   * Language codes and names
   */
  getSupportedLanguages() {
    return {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'pl': 'Polish',
      'tr': 'Turkish',
      'ru': 'Russian',
      'zh': 'Chinese',
      'ja': 'Japanese',
      'ko': 'Korean',
      'hi': 'Hindi',
      'ar': 'Arabic',
      'ur': 'Urdu',
      'pa': 'Punjabi',
      'ta': 'Tamil',
      'te': 'Telugu',
      'ml': 'Malayalam',
      'kn': 'Kannada',
      'mr': 'Marathi',
      'bn': 'Bengali',
      'gu': 'Gujarati',
      'or': 'Odia',
      'as': 'Assamese',
      'vi': 'Vietnamese',
      'th': 'Thai',
      'id': 'Indonesian',
      'uk': 'Ukrainian',
      'cs': 'Czech',
      'el': 'Greek',
      'he': 'Hebrew',
      'nl': 'Dutch',
      'ro': 'Romanian',
      'sv': 'Swedish',
      'da': 'Danish',
      'fi': 'Finnish',
      'hu': 'Hungarian',
      'no': 'Norwegian'
    };
  }

  /**
   * Get language name from code
   * @param {string} code - Language code (e.g., 'en', 'hi')
   * @returns {string} - Language name
   */
  getLanguageName(code) {
    const languages = this.getSupportedLanguages();
    return languages[code.toLowerCase()] || 'Unknown';
  }

  /**
   * Format supported languages for UI
   * @returns {Array} - Array of { code, name } objects
   */
  getLanguagesForUI() {
    const languages = this.getSupportedLanguages();
    return Object.entries(languages).map(([code, name]) => ({
      code,
      name
    }));
  }
}

module.exports = new WhisperService();