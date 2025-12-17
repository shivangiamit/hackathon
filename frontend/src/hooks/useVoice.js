import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * useVoice Hook
 * Handles audio recording, transcription, and playback
 */
export const useVoice = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const [language, setLanguage] = useState('en');
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const recordingStartRef = useRef(null);
  const durationTimerRef = useRef(null);
  const audioPlayerRef = useRef(null);

  /**
   * Start recording audio
   */
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setDuration(0);
      audioChunksRef.current = [];

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Create media recorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recordingStartRef.current = Date.now();

      // Collect audio chunks
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Start duration timer
      durationTimerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - recordingStartRef.current) / 1000));
      }, 100);

      mediaRecorderRef.current.start();
      setIsRecording(true);
      console.log('🎤 Recording started...');

    } catch (err) {
      const errorMsg = err.name === 'NotAllowedError'
        ? 'Microphone permission denied'
        : `Recording error: ${err.message}`;
      setError(errorMsg);
      console.error('❌ Recording error:', err);
    }
  }, []);

  /**
   * Stop recording
   */
  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      // Clear duration timer
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }

      // Stop recording
      mediaRecorderRef.current.onstop = () => {
        // Create audio blob
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setRecordedAudio(audioBlob);
        
        // Stop all tracks
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        
        setIsRecording(false);
        console.log(`✅ Recording stopped (${duration}s)`);
        resolve(audioBlob);
      };

      mediaRecorderRef.current.stop();
    });
  }, [duration]);

  /**
   * Send audio to backend for transcription and processing
   */
  const processAudio = useCallback(async (audioBlob) => {
    try {
      if (!audioBlob) {
        setError('No audio to process');
        return null;
      }

      setIsProcessing(true);
      setError(null);
      setTranscript('');

      // Create FormData
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.wav');
      formData.append('language', language);
      formData.append('userId', 'farmer_001'); // Can be dynamic

      console.log(`📤 Sending audio to server (${(audioBlob.size / 1024).toFixed(2)} KB)...`);

      // Send to backend
      const response = await fetch('http://localhost:5000/api/voice/chat', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      console.log('✅ Processing complete!');
      console.log(`   Query: ${result.query}`);
      console.log(`   Response: ${result.response.substring(0, 50)}...`);

      // Set transcript
      setTranscript(result.query);

      return result;

    } catch (err) {
      const errorMsg = `Processing error: ${err.message}`;
      setError(errorMsg);
      console.error('❌ Processing error:', err);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [language]);

  /**
   * Complete voice chat: record → process → play response
   */
  const voiceChat = useCallback(async () => {
    try {
      setError(null);

      // Start recording
      await startRecording();

      // Wait for user to speak (prompt to stop)
      return {
        stop: async () => {
          const audioBlob = await stopRecording();
          const result = await processAudio(audioBlob);
          
          if (result && result.audio) {
            // Auto-play response
            playAudio(result.audio);
          }
          
          return result;
        }
      };

    } catch (err) {
      setError(err.message);
      console.error('❌ Voice chat error:', err);
    }
  }, [startRecording, stopRecording, processAudio]);

  /**
   * Play audio response
   */
  const playAudio = useCallback((base64Audio) => {
    try {
      setError(null);

      // Decode base64 to binary
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      // Create audio blob
      const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create or update audio element
      if (!audioPlayerRef.current) {
        audioPlayerRef.current = new Audio();
        audioPlayerRef.current.onplay = () => setIsPlaying(true);
        audioPlayerRef.current.onended = () => setIsPlaying(false);
        audioPlayerRef.current.onerror = (err) => {
          setError(`Playback error: ${err.message}`);
          setIsPlaying(false);
        };
      }

      audioPlayerRef.current.src = audioUrl;
      audioPlayerRef.current.play();
      console.log('🔊 Playing audio...');

    } catch (err) {
      setError(`Playback error: ${err.message}`);
      console.error('❌ Playback error:', err);
    }
  }, []);

  /**
   * Stop audio playback
   */
  const stopAudio = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      setIsPlaying(false);
      console.log('⏹️ Audio stopped');
    }
  }, []);

  /**
   * Toggle recording
   */
  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  /**
   * Get supported languages
   */
  const getSupportedLanguages = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/voice/languages');
      const result = await response.json();
      return result.languages || [];
    } catch (err) {
      console.error('❌ Error fetching languages:', err);
      return [];
    }
  }, []);

  /**
   * Get available voices
   */
  const getAvailableVoices = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/voice/voices');
      const result = await response.json();
      return result.voices || [];
    } catch (err) {
      console.error('❌ Error fetching voices:', err);
      return [];
    }
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Stop recording if active
      if (isRecording && mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }

      // Stop audio playback
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }

      // Clear timers
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }

      // Clean up object URLs
      if (audioPlayerRef.current?.src) {
        URL.revokeObjectURL(audioPlayerRef.current.src);
      }
    };
  }, [isRecording]);

  return {
    // State
    isRecording,
    isProcessing,
    isPlaying,
    duration,
    transcript,
    error,
    language,
    recordedAudio,

    // Recording
    startRecording,
    stopRecording,
    toggleRecording,

    // Processing
    processAudio,
    voiceChat,

    // Playback
    playAudio,
    stopAudio,

    // Settings
    setLanguage,

    // Info
    getSupportedLanguages,
    getAvailableVoices
  };
};