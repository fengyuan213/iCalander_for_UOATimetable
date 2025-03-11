<script lang="ts">
    // Define Chrome API types
    type ChromeTab = {
        id?: number;
        url?: string;
    };

    type ExecuteScriptResult = {
        result: any;
    };

    // Define structured timetable data types
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

    // For internal state values (not passed from outside)
    let loading = $state(false);
    let extracting = $state(false);
    let timetableData = $state<TimetableData | null>(null);
    let formattedText = $state("");
    let statusMessage = $state("");
    let error = $state("");

    function extractTimetable() {
        extracting = true;
        statusMessage = "Extracting timetable data...";
        error = "";

        chrome.tabs.query(
            { active: true, currentWindow: true },
            (tabs: ChromeTab[]) => {
                const tabId = tabs[0]?.id;

                if (!tabId) {
                    error = "No active tab found";
                    extracting = false;
                    return;
                }

                chrome.scripting.executeScript(
                    {
                        target: { tabId },
                        func: scrapePageData,
                    },
                    (results: ExecuteScriptResult[] | undefined) => {
                        if (chrome.runtime.lastError) {
                            error = `Error: ${chrome.runtime.lastError.message}`;
                            extracting = false;
                            return;
                        }

                        const data = results?.[0]?.result;
                        if (!data) {
                            error =
                                "Could not find timetable data on this page";
                            extracting = false;
                            return;
                        }

                        // Store the structured data
                        timetableData = data as TimetableData;

                        // Convert structured data to text for preview
                        if (timetableData?.courses?.length > 0) {
                            // Format the structured data for display
                            let text = "";

                            timetableData.courses.forEach((course) => {
                                text += `${course.name}\n\n`;

                                course.classTypes.forEach((classType) => {
                                    text += `${classType.type}\n`;

                                    classType.sessions.forEach((session) => {
                                        text += `${session.dateRange} ${session.dayOfWeek} ${session.timeRange}\n${session.location}\n\n`;
                                    });
                                });
                            });

                            formattedText = text;
                        } else {
                            // Use raw text if no structured data
                            formattedText = timetableData?.rawText || "";
                        }

                        extracting = false;
                        statusMessage =
                            "Timetable data extracted successfully!";
                    },
                );
            },
        );
    }

    function generateIcal() {
        if (!timetableData) {
            error = "No timetable data to process";
            return;
        }

        loading = true;
        statusMessage = "Generating iCal file...";

        // Pass the timetableData object directly - Chrome messaging can handle complex objects
        chrome.runtime.sendMessage(
            {
                action: "processTimetable",
                data: timetableData, // Pass structured data directly, no need for JSON.stringify
            },
            (response: { success?: boolean; error?: string }) => {
                loading = false;

                if (response?.error) {
                    error = `Error: ${response.error}`;
                    return;
                }

                statusMessage = "iCal file generated successfully!";
            },
        );
    }

    // This function will be injected into the page
    function scrapePageData(): TimetableData {
        // Initialize the structured timetable data
        const timetableData: TimetableData = {
            courses: [],
            rawText: "",
        };

        let rawText = "";

        // Target the specific accordion items (LI elements) that contain class data
        const courseItems = document.querySelectorAll("li.c-accordion__item");

        if (courseItems && courseItems.length > 0) {
            // Found the accordion items
            courseItems.forEach((item) => {
                try {
                    // Extract course title from the heading
                    const courseHeading = item.querySelector(
                        ".c-accordion__heading",
                    );
                    const courseName =
                        courseHeading?.textContent?.trim() || "Unknown Course";

                    // Add to raw text
                    rawText += `${courseName}\n`;

                    // Create a new course
                    const course: Course = {
                        name: courseName,
                        classTypes: [],
                    };

                    // Extract tables for each class type (Seminar, Workshop, etc.)
                    const tables = item.querySelectorAll("table.c-table");
                    tables.forEach((table) => {
                        // Get class type (Seminar, Workshop, etc.)
                        const classTypeElement =
                            table.querySelector("thead strong");
                        const classTypeName =
                            classTypeElement?.textContent?.trim() ||
                            "Unknown Type";

                        // Add to raw text
                        rawText += `${classTypeName}\n`;

                        // Create a new class type
                        const classType: ClassType = {
                            type: classTypeName,
                            sessions: [],
                        };

                        // Get session details from table rows
                        const rows = table.querySelectorAll("tbody tr");
                        rows.forEach((row) => {
                            const cells = row.querySelectorAll("td");
                            if (cells.length >= 4) {
                                // Extract content from each cell, with null checks
                                const dateRange =
                                    cells[0]?.textContent?.trim() || "";
                                const dayOfWeek =
                                    cells[1]?.textContent?.trim() || "";
                                const timeRange =
                                    cells[2]?.textContent?.trim() || "";
                                const location =
                                    cells[3]?.textContent?.trim() || "";

                                // Add to raw text
                                rawText += `${dateRange} ${dayOfWeek} ${timeRange}\n${location}\n\n`;

                                // Create a new session
                                const session: Session = {
                                    dateRange,
                                    dayOfWeek,
                                    timeRange,
                                    location,
                                };

                                classType.sessions.push(session);
                            }
                        });

                        // Add the class type to the course
                        course.classTypes.push(classType);
                    });

                    rawText += "\n";

                    // Add the course to the timetable data
                    timetableData.courses.push(course);
                } catch (err) {
                    console.error("Error extracting course data:", err);
                }
            });
        }
        console.log(timetableData);
        // Store the raw text
        timetableData.rawText = rawText;

        return timetableData;
    }
</script>

<div class="container">
    <h1>Timetable to iCal</h1>

    {#if error}
        <div class="error">{error}</div>
    {/if}

    {#if statusMessage}
        <div class="status">{statusMessage}</div>
    {/if}

    <div class="actions">
        <button onclick={() => extractTimetable()} disabled={extracting}>
            {extracting ? "Extracting..." : "Extract Timetable"}
        </button>

        <button
            onclick={() => generateIcal()}
            disabled={!timetableData || loading}
        >
            {loading ? "Generating..." : "Generate iCal"}
        </button>
    </div>
    <h3>Usage</h3>
    <p>1. Login to myadelaide</p>
    <p>
        2. Locate to: STUDIES &rarr; Timetable then click CLASSLIST at the top
        right corner
    </p>
    <p>3. Click Extract Timetable and Generate iCal</p>
    {#if formattedText}
        <div class="preview">
            <h2>Extracted Data Preview</h2>
            <pre>{formattedText.slice(0, 300)}...</pre>
        </div>
    {/if}
</div>

<style>
    .container {
        padding: 1rem;
        width: 400px;
    }

    h1 {
        font-size: 1.5rem;
        margin-bottom: 1rem;
        text-align: center;
    }

    .error {
        background: #ffebee;
        color: #c62828;
        padding: 0.5rem;
        margin-bottom: 1rem;
        border-radius: 4px;
    }

    .status {
        background: #e8f5e9;
        color: #2e7d32;
        padding: 0.5rem;
        margin-bottom: 1rem;
        border-radius: 4px;
    }

    .actions {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1rem;
    }

    button {
        flex: 1;
        padding: 0.5rem;
        background: #1976d2;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }

    button:disabled {
        background: #bdbdbd;
        cursor: not-allowed;
    }

    .preview {
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        padding: 0.5rem;
    }

    .preview h2 {
        font-size: 1rem;
        margin-top: 0;
        margin-bottom: 0.5rem;
    }

    .preview pre {
        white-space: pre-wrap;
        font-size: 0.8rem;
        max-height: 200px;
        overflow-y: auto;
        background: #f5f5f5;
        padding: 0.5rem;
        border-radius: 4px;
    }
</style>
