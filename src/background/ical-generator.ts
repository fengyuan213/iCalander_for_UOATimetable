// Using ical-generator library for more reliable iCal generation
import ical, { ICalCalendar } from 'ical-generator';
import { parse } from 'date-fns';

// Define the structured data types
interface Session {
    dateRange: string;
    dayOfWeek: string;
    timeRange: string;
    location: string;
}

interface ClassType {
    type: string;
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

/**
 * Generate iCal data from structured timetable data
 * @param timetableData The structured timetable data
 * @param timezone Optional timezone (defaults to Australia/Adelaide)
 * @returns iCal formatted string
 */
export function parseAndGenerateIcs(timetableData: TimetableData, timezone?: string): string {
    // Create a new calendar with the specified timezone or default to Adelaide
    const calendar: ICalCalendar = ical({
        prodId: { company: 'Timetable to iCal Extension', product: 'UOA Timetable' },
        name: 'University Timetable',
        timezone: timezone || 'Australia/Adelaide'
    });

    // Make sure timetableData and its properties are defined
    if (!timetableData) {
        console.error('TimetableData is undefined');
        return calendar.toString(); // Return empty calendar
    }

    // Ensure courses array exists
    const courses = timetableData.courses || [];

    // Process structured data
    if (courses.length > 0) {
        for (const course of courses) {
            // Ensure classTypes array exists
            const classTypes = course.classTypes || [];

            for (const classType of classTypes) {
                // Ensure sessions array exists
                const sessions = classType.sessions || [];

                for (const session of sessions) {
                    try {
                        addStructuredSession(calendar, course.name, classType.type, session);
                    } catch (error) {
                        console.error('Error adding session:', error);
                        // Continue with other sessions even if one fails
                    }
                }
            }
        }
    }

    // Return the calendar as a string
    return calendar.toString();
}

/**
 * Add events to the calendar from a structured session
 */
function addStructuredSession(calendar: ICalCalendar, courseName: string, classType: string, session: Session): void {
    // Parse the date range - format: "03 Mar - 07 Apr"
    const [startDateStr, endDateStr] = parseSessionDateRange(session.dateRange);

    // Parse the time range - format: "4:00 PM - 5:00 PM"
    const [startTimeStr, endTimeStr] = parseSessionTimeRange(session.timeRange);

    // Generate weekly occurrences
    const eventDates = generateEventDates(startDateStr, endDateStr, session.dayOfWeek);

    // Add each occurrence as an event
    eventDates.forEach(date => {
        try {
            // Create start and end times for this occurrence
            const startDateTime = createDateTime(date, startTimeStr);
            const endDateTime = createDateTime(date, endTimeStr);

            // Add the event
            calendar.createEvent({
                start: startDateTime,
                end: endDateTime,
                summary: `${courseName} - ${classType}`,
                location: session.location,
                description: `${classType} for ${courseName}`
            });
        } catch (error) {
            console.error('Error creating event for date:', date, error);
        }
    });
}

/**
 * Split date range into start and end dates
 */
function parseSessionDateRange(dateRange: string): [string, string] {
    const parts = dateRange.split('-').map(part => part.trim());
    return [parts[0], parts[1] || parts[0]];
}

/**
 * Split time range into start and end times
 */
function parseSessionTimeRange(timeRange: string): [string, string] {
    const parts = timeRange.split('-').map(part => part.trim());
    return [parts[0], parts[1] || parts[0]];
}

/**
 * Generate all dates for a recurring event
 */
function generateEventDates(startDateStr: string, endDateStr: string, dayOfWeek: string): Date[] {
    // Map day names to day numbers (0 = Sunday, 1 = Monday, etc. in JavaScript Date)
    const days: Record<string, number> = {
        'Monday': 1,
        'Tuesday': 2,
        'Wednesday': 3,
        'Thursday': 4,
        'Friday': 5,
        'Saturday': 6,
        'Sunday': 0
    };

    // Parse date strings
    const currentYear = new Date().getFullYear();
    let startDate: Date;
    let endDate: Date;

    try {
        startDate = parse(`${startDateStr} ${currentYear}`, 'dd MMM yyyy', new Date());
        endDate = parse(`${endDateStr} ${currentYear}`, 'dd MMM yyyy', new Date());

        // If the end date is before the start date, assume it's in the next year
        if (endDate < startDate) {
            endDate = parse(`${endDateStr} ${currentYear + 1}`, 'dd MMM yyyy', new Date());
        }
    } catch (error) {
        console.error('Error parsing dates:', error);
        throw new Error(`Could not parse date range: ${startDateStr} - ${endDateStr}`);
    }

    // Generate all occurrences
    const dates: Date[] = [];
    const targetDay = days[dayOfWeek];

    if (targetDay === undefined) {
        throw new Error(`Invalid day of week: ${dayOfWeek}`);
    }

    // Start with the first date
    let currentDate = new Date(startDate);

    // Adjust to the first occurrence of the target day
    const dayOffset = (targetDay - currentDate.getDay() + 7) % 7;
    currentDate.setDate(currentDate.getDate() + dayOffset);

    // Add all occurrences until the end date
    while (currentDate <= endDate) {
        dates.push(new Date(currentDate));
        // Move to next week
        currentDate.setDate(currentDate.getDate() + 7);
    }

    return dates;
}

/**
 * Create a date-time by combining a date and a time string
 */
function createDateTime(date: Date, timeStr: string): Date {
    const dateTime = new Date(date);

    // Handle various time formats
    let hours = 0;
    let minutes = 0;

    // Try multiple patterns
    // Pattern 1: "4:00 PM" or "4:00PM"
    const pattern1 = /(\d+):(\d+)\s*(AM|PM|am|pm)/i;
    // Pattern 2: "16:00" (24-hour format)
    const pattern2 = /(\d+):(\d+)/;

    let match = timeStr.match(pattern1);

    if (match) {
        hours = parseInt(match[1], 10);
        minutes = parseInt(match[2], 10);
        const period = match[3].toUpperCase();

        // Convert to 24-hour format
        if (period === 'PM' && hours < 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
    } else {
        match = timeStr.match(pattern2);
        if (match) {
            hours = parseInt(match[1], 10);
            minutes = parseInt(match[2], 10);
        } else {
            console.error(`Could not parse time: ${timeStr}, using default of 00:00`);
        }
    }

    dateTime.setHours(hours, minutes, 0, 0);
    return dateTime;
}