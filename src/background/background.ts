// Import our iCal generation function
import { parseAndGenerateIcs } from './ical-generator';

// Define the structured timetable data types
interface Session {
    dateRange: string;
    dayOfWeek: string;
    timeRange: string;
    location: string;
}

interface ClassType {
    type: string; // "Seminar", "Workshop", "Lecture", etc.
    sessions: Session[];
}

interface Course {
    name: string;
    classTypes: ClassType[];
}

interface TimetableData {
    courses: Course[];
    rawText: string;
}

// Define the expected message type with TimetableData
interface TimetableRequest {
    action: string;
    data: TimetableData;  // Only accept TimetableData now
}

// Add type definitions for Chrome API
declare global {
    interface Window {
        chrome: typeof chrome;
    }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((
    request: TimetableRequest,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: { success?: boolean; error?: string }) => void
) => {
    if (request.action === 'processTimetable') {
        try {
            // Process the timetable data and generate iCal
            // The parseAndGenerateIcs function now only accepts TimetableData
            const icalData = parseAndGenerateIcs(request.data);

            // Create a downloadable blob directly using chrome.downloads.download
            const blob = new Blob([icalData], { type: 'text/calendar' });

            // Use a data URL instead of a blob URL
            const reader = new FileReader();
            reader.onload = function () {
                const dataUrl = reader.result as string;

                // Trigger the download
                chrome.downloads.download({
                    url: dataUrl,
                    filename: 'timetable.ics',
                    saveAs: true
                }, () => {
                    if (chrome.runtime.lastError) {
                        sendResponse({ error: chrome.runtime.lastError.message });
                    } else {
                        sendResponse({ success: true });
                    }
                });
            };

            reader.onerror = function () {
                sendResponse({ error: 'Failed to create file for download' });
            };

            // Start reading the blob as a data URL
            reader.readAsDataURL(blob);

            return true; // Keep the message channel open for the async response
        } catch (error: unknown) {
            let errorMessage = 'Unknown error';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            sendResponse({ error: errorMessage });
        }
    }

    return false;
}); 