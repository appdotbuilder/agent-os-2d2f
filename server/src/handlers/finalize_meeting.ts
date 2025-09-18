import { db } from '../db';
import { notesTable } from '../db/schema';
import { type FinalizeMeetingInput, type Note } from '../schema';

export interface MeetingFinalizationResponse {
    note: Note;
    summary: string;
    entities: Record<string, any>;
    extracted_actions: Array<{
        title: string;
        priority: 'low' | 'med' | 'high';
        due_at?: Date;
    }>;
}

// Simple mock AI processing functions - in a real app these would call AI services
const generateSummary = (transcript: string): string => {
    // Mock summary generation - extract first sentence or create basic summary
    const sentences = transcript.split('. ').filter(s => s.trim().length > 0);
    if (sentences.length === 0) return 'Meeting transcript processed.';
    
    const firstSentence = sentences[0].trim();
    const wordCount = transcript.split(' ').length;
    
    return `Meeting summary: ${firstSentence}${firstSentence.endsWith('.') ? '' : '.'} (${wordCount} words transcribed)`;
};

const extractEntities = (transcript: string): Record<string, any> => {
    // Mock entity extraction - look for common patterns
    const entities: Record<string, any> = {
        decisions: [],
        risks: [],
        people: [],
        dates: []
    };

    // Extract people (words that start with capital letters and might be names)
    const words = transcript.split(/\s+/);
    const potentialNames = words.filter(word => 
        /^[A-Z][a-z]+$/.test(word) && 
        !['The', 'This', 'That', 'We', 'They', 'Meeting', 'Today'].includes(word)
    );
    entities['people'] = [...new Set(potentialNames)].slice(0, 5); // Limit to 5 unique names

    // Extract dates (broader pattern matching)
    const datePatterns = [
        /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*\d{4})?\b/gi,
        /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
        /\b\d{1,2}-\d{1,2}-\d{2,4}\b/g
    ];
    
    let allDateMatches: string[] = [];
    datePatterns.forEach(pattern => {
        const matches = transcript.match(pattern);
        if (matches) {
            allDateMatches = allDateMatches.concat(matches);
        }
    });
    entities['dates'] = [...new Set(allDateMatches)];

    // Extract decisions (sentences containing decision keywords)
    const decisionKeywords = ['decided', 'agreed', 'concluded', 'resolved'];
    const sentences = transcript.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
    entities['decisions'] = sentences.filter(sentence => 
        decisionKeywords.some(keyword => sentence.toLowerCase().includes(keyword))
    ).slice(0, 3);

    return entities;
};

const extractActions = (transcript: string): Array<{ title: string; priority: 'low' | 'med' | 'high'; due_at?: Date }> => {
    // Mock action extraction - look for action words and tasks
    const actionKeywords = ['need to', 'should', 'will', 'must', 'action item', 'follow up', 'todo'];
    const sentences = transcript.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
    
    const actions = sentences
        .filter(sentence => 
            actionKeywords.some(keyword => sentence.toLowerCase().includes(keyword))
        )
        .slice(0, 3) // Limit to 3 actions
        .map((sentence, index) => ({
            title: sentence.length > 100 ? sentence.substring(0, 97) + '...' : sentence,
            priority: (index === 0 ? 'high' : index === 1 ? 'med' : 'low') as 'low' | 'med' | 'high',
            due_at: undefined // Could be enhanced to extract dates
        }));

    return actions;
};

export const finalizeMeeting = async (input: FinalizeMeetingInput): Promise<MeetingFinalizationResponse> => {
    try {
        // Generate AI-processed content
        const summary = generateSummary(input.transcript);
        const entities = extractEntities(input.transcript);
        const extracted_actions = extractActions(input.transcript);

        // Create markdown content for the note
        const content_md = `# ${input.title}

## Summary
${summary}

## Transcript
${input.transcript}

## Key People
${entities['people'].length > 0 ? entities['people'].join(', ') : 'None identified'}

## Decisions Made
${entities['decisions'].length > 0 ? entities['decisions'].map((d: string) => `- ${d}`).join('\n') : 'None identified'}

## Action Items
${extracted_actions.length > 0 ? extracted_actions.map(a => `- ${a.title} (Priority: ${a.priority})`).join('\n') : 'None identified'}`;

        // Insert the note into the database
        const result = await db.insert(notesTable)
            .values({
                workspace_id: input.workspace_id,
                title: input.title,
                source: 'meeting',
                content_md: content_md,
                transcript_text: input.transcript,
                summary_text: summary,
                entities: entities as Record<string, unknown>,
                created_by: input.created_by
            })
            .returning()
            .execute();

        const note = result[0];

        return {
            note: {
                ...note,
                entities: note.entities as Record<string, unknown>,
                created_at: new Date(note.created_at),
                updated_at: new Date(note.updated_at)
            },
            summary,
            entities,
            extracted_actions
        };
    } catch (error) {
        console.error('Meeting finalization failed:', error);
        throw error;
    }
};