import { describe, expect, it } from 'bun:test';
import { type TranscribeMeetingInput } from '../schema';
import { transcribeMeeting } from '../handlers/transcribe_meeting';

// Test audio data - base64 encoded sample data of different sizes
const smallAudioData = Buffer.from('small audio content for testing').toString('base64');
const mediumAudioData = Buffer.from('medium sized audio content for testing purposes - this is longer content to simulate a medium audio chunk that would generate partial transcripts'.repeat(50)).toString('base64');
const largeAudioData = Buffer.from('large audio content for testing purposes - this represents a complete audio recording that should generate full transcripts'.repeat(200)).toString('base64');

describe('transcribeMeeting', () => {
    it('should transcribe small audio and return partial transcript', async () => {
        const input: TranscribeMeetingInput = {
            workspace_id: 1,
            audio_data: smallAudioData
        };

        const result = await transcribeMeeting(input);

        expect(result.partial_transcript).toContain('Welcome to the meeting');
        expect(result.partial_transcript).toContain('[Workspace 1]');
        expect(result.is_complete).toBe(false);
        expect(typeof result.partial_transcript).toBe('string');
        expect(result.partial_transcript.length).toBeGreaterThan(0);
    });

    it('should transcribe medium audio and return partial transcript', async () => {
        const input: TranscribeMeetingInput = {
            workspace_id: 2,
            audio_data: mediumAudioData
        };

        const result = await transcribeMeeting(input);

        expect(result.partial_transcript).toContain('Welcome to the meeting');
        expect(result.partial_transcript).toContain('[Workspace 2]');
        expect(result.partial_transcript).toContain('quarterly results');
        expect(result.is_complete).toBe(false);
        expect(result.partial_transcript.length).toBeGreaterThan(50);
    });

    it('should transcribe large audio and return complete transcript', async () => {
        const input: TranscribeMeetingInput = {
            workspace_id: 3,
            audio_data: largeAudioData
        };

        const result = await transcribeMeeting(input);

        expect(result.partial_transcript).toContain('Welcome to the meeting');
        expect(result.partial_transcript).toContain('[Workspace 3]');
        expect(result.partial_transcript).toContain('quarterly results');
        expect(result.partial_transcript).toContain('development update');
        expect(result.is_complete).toBe(true);
        expect(result.partial_transcript.length).toBeGreaterThan(100);
    });

    it('should include workspace context in transcript', async () => {
        const input: TranscribeMeetingInput = {
            workspace_id: 999,
            audio_data: smallAudioData
        };

        const result = await transcribeMeeting(input);

        expect(result.partial_transcript).toContain('[Workspace 999]');
        expect(result.partial_transcript.startsWith('[Workspace 999]')).toBe(true);
    });

    it('should handle processing delay appropriately', async () => {
        const input: TranscribeMeetingInput = {
            workspace_id: 1,
            audio_data: mediumAudioData
        };

        const startTime = Date.now();
        await transcribeMeeting(input);
        const endTime = Date.now();

        const processingTime = endTime - startTime;
        expect(processingTime).toBeGreaterThan(50); // Should have some processing delay
        expect(processingTime).toBeLessThan(3000); // But not too long for tests
    });

    it('should throw error for missing audio data', async () => {
        const input: TranscribeMeetingInput = {
            workspace_id: 1,
            audio_data: ''
        };

        await expect(transcribeMeeting(input)).rejects.toThrow(/audio data is required/i);
    });

    it('should throw error for invalid workspace ID', async () => {
        const input: TranscribeMeetingInput = {
            workspace_id: 0,
            audio_data: smallAudioData
        };

        await expect(transcribeMeeting(input)).rejects.toThrow(/valid workspace id is required/i);
    });

    it('should throw error for negative workspace ID', async () => {
        const input: TranscribeMeetingInput = {
            workspace_id: -1,
            audio_data: smallAudioData
        };

        await expect(transcribeMeeting(input)).rejects.toThrow(/valid workspace id is required/i);
    });

    it('should throw error for invalid base64 audio data', async () => {
        const input: TranscribeMeetingInput = {
            workspace_id: 1,
            audio_data: 'invalid-base64-data-with-special-chars-that-are-not-base64-!!!-this-should-be-long-enough-to-pass-size-validation-but-fail-base64-decoding'
        };

        await expect(transcribeMeeting(input)).rejects.toThrow(/invalid base64 audio data/i);
    });

    it('should throw error for audio data that is too small', async () => {
        const tinyAudioData = Buffer.from('x').toString('base64'); // Very small buffer
        const input: TranscribeMeetingInput = {
            workspace_id: 1,
            audio_data: tinyAudioData
        };

        await expect(transcribeMeeting(input)).rejects.toThrow(/audio data too small/i);
    });

    it('should throw error for audio data that is too large', async () => {
        // Create a buffer larger than 50MB
        const hugeBuffer = Buffer.alloc(51 * 1024 * 1024, 'x');
        const hugeAudioData = hugeBuffer.toString('base64');
        const input: TranscribeMeetingInput = {
            workspace_id: 1,
            audio_data: hugeAudioData
        };

        await expect(transcribeMeeting(input)).rejects.toThrow(/audio data too large/i);
    });

    it('should return consistent structure for all valid inputs', async () => {
        const inputs = [
            { workspace_id: 1, audio_data: smallAudioData },
            { workspace_id: 2, audio_data: mediumAudioData },
            { workspace_id: 3, audio_data: largeAudioData }
        ];

        for (const input of inputs) {
            const result = await transcribeMeeting(input);
            
            expect(result).toHaveProperty('partial_transcript');
            expect(result).toHaveProperty('is_complete');
            expect(typeof result.partial_transcript).toBe('string');
            expect(typeof result.is_complete).toBe('boolean');
            expect(result.partial_transcript.length).toBeGreaterThan(0);
        }
    });

    it('should handle different workspace IDs correctly', async () => {
        const workspaceIds = [1, 100, 9999];
        
        for (const workspaceId of workspaceIds) {
            const input: TranscribeMeetingInput = {
                workspace_id: workspaceId,
                audio_data: smallAudioData
            };

            const result = await transcribeMeeting(input);
            expect(result.partial_transcript).toContain(`[Workspace ${workspaceId}]`);
        }
    });
});