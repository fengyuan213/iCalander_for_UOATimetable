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
        selected?: boolean;
    }

    interface ClassType {
        type: string; // "Seminar", "Workshop", "Lecture", etc.
        sessions: Session[];
        selected?: boolean;
    }

    interface Course {
        name: string;
        classTypes: ClassType[];
        selected?: boolean;
    }

    interface TimetableData {
        courses: Course[];
        rawText: string;
    }

    // Common timezones with a focus on Australia
    interface Timezone {
        value: string;
        label: string;
    }

    const timezones: Timezone[] = [
        { value: "Australia/Adelaide", label: "Adelaide" },
        { value: "Australia/Sydney", label: "Sydney/Melbourne" },
        { value: "Australia/Brisbane", label: "Brisbane" },
        { value: "Australia/Perth", label: "Perth" },
        { value: "Australia/Darwin", label: "Darwin" },
        { value: "Asia/Shanghai", label: "China" },
        { value: "Asia/Tokyo", label: "Japan" },
        { value: "Asia/Singapore", label: "Singapore" },
        { value: "Europe/London", label: "London" },
        { value: "America/New_York", label: "New York" },
        { value: "America/Los_Angeles", label: "Los Angeles" },
    ];

    // For internal state values (not passed from outside)
    let loading = $state(false);
    let extracting = $state(false);
    let timetableData = $state<TimetableData | null>(null);
    let formattedText = $state("");
    let statusMessage = $state("");
    let error = $state("");
    let selectedTimezone = $state("Australia/Adelaide");
    let showAdvancedOptions = $state(false);
    let currentStep = $state(1); // 1: Instructions, 2: Options, 3: Complete
    let isOnCorrectPage = $state(false);
    let currentUrl = $state("");

    // Check if we're on the correct page when the popup opens
    function checkCurrentPage() {
        chrome.tabs.query(
            { active: true, currentWindow: true },
            (tabs: ChromeTab[]) => {
                const url = tabs[0]?.url || "";
                currentUrl = url;

                // Check if we're on the right page (looking for adelaide.edu.au and timetable in the URL)
                const isOnTimetablePage =
                    url.includes("myadelaide.uni.adelaide.edu.au") &&
                    url.includes("#/home/studies/timetable");

                // If we're on the timetable page, check if we're in the right view mode
                if (isOnTimetablePage) {
                    const tabId = tabs[0]?.id;
                    if (tabId) {
                        chrome.scripting.executeScript(
                            {
                                target: { tabId },
                                func: () => {
                                    // Check if we're in CLASSLIST view mode
                                    const viewSwitchDiv =
                                        document.querySelector(
                                            "div[class*='view-switch-btn']",
                                        );
                                    if (viewSwitchDiv) {
                                        // Check if it's the list view and not weekly view
                                        const isListView =
                                            viewSwitchDiv.classList.contains(
                                                "view-list",
                                            );
                                        const isWeeklyView =
                                            viewSwitchDiv.classList.contains(
                                                "view-weekly",
                                            );

                                        // Get button text for logging
                                        const buttonElement =
                                            viewSwitchDiv.querySelector(
                                                "button",
                                            );
                                        const buttonText = buttonElement
                                            ? buttonElement.textContent?.trim()
                                            : "";

                                        console.log("View switch found:", {
                                            isListView,
                                            isWeeklyView,
                                            buttonText,
                                            classList: viewSwitchDiv.className,
                                        });

                                        // We should be in list view with CLASS LIST button
                                        const isCorrectView =
                                            isListView &&
                                            buttonText
                                                ?.toUpperCase()
                                                .includes("CLASS LIST");

                                        // Also check if the content we need is present
                                        const hasAccordionItems =
                                            document.querySelectorAll(
                                                "li.c-accordion__item",
                                            ).length > 0;
                                        const hasTimetableTables =
                                            document.querySelectorAll(
                                                "table.c-table",
                                            ).length > 0;

                                        return {
                                            isCorrectView,
                                            hasAccordionItems,
                                            hasTimetableTables,
                                            buttonText,
                                            viewClass: viewSwitchDiv.className,
                                        };
                                    }

                                    // If we can't find the view switch, fall back to just checking for content
                                    const hasAccordionItems =
                                        document.querySelectorAll(
                                            "li.c-accordion__item",
                                        ).length > 0;
                                    const hasTimetableTables =
                                        document.querySelectorAll(
                                            "table.c-table",
                                        ).length > 0;

                                    return {
                                        isCorrectView: false,
                                        hasAccordionItems,
                                        hasTimetableTables,
                                        buttonText: "Not found",
                                        viewClass: "Not found",
                                    };
                                },
                            },
                            (results: ExecuteScriptResult[] | undefined) => {
                                if (results && results[0]?.result) {
                                    const result = results[0].result;
                                    console.log("Page check result:", result);

                                    // Set isOnCorrectPage based on the combination of factors
                                    isOnCorrectPage =
                                        isOnTimetablePage &&
                                        (result.isCorrectView ||
                                            (result.hasAccordionItems &&
                                                result.hasTimetableTables));
                                }
                            },
                        );
                    }
                } else {
                    // Not even on the timetable page
                    isOnCorrectPage = false;
                }
            },
        );
    }

    // Run the check when the popup opens
    checkCurrentPage();

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

                        // Store the structured data and mark all items as selected by default
                        timetableData = data as TimetableData;
                        if (timetableData?.courses) {
                            timetableData.courses.forEach((course) => {
                                course.selected = true;
                                course.classTypes?.forEach((classType) => {
                                    classType.selected = true;
                                    classType.sessions?.forEach((session) => {
                                        session.selected = true;
                                    });
                                });
                            });
                        }

                        // If we've successfully extracted data, move to the next step
                        currentStep = 2;
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

        // Filter the timetable data to only include selected items
        const filteredData = filterSelectedItems(timetableData);

        // Stringify the filtered data
        const jsonData = JSON.stringify(filteredData);

        // Pass the timetableData with timezone
        chrome.runtime.sendMessage(
            {
                action: "processTimetable",
                data: jsonData,
                timezone: selectedTimezone,
            },
            (response: { success?: boolean; error?: string }) => {
                loading = false;

                if (response?.error) {
                    error = `Error: ${response.error}`;
                    return;
                }

                currentStep = 3;
                statusMessage = "iCal file generated successfully!";
            },
        );
    }

    // Filter timetable data to only include selected items
    function filterSelectedItems(data: TimetableData): TimetableData {
        const filtered: TimetableData = {
            courses: [],
            rawText: data.rawText,
        };

        data.courses.forEach((course) => {
            if (course.selected) {
                const filteredCourse: Course = {
                    name: course.name,
                    classTypes: [],
                };

                course.classTypes.forEach((classType) => {
                    if (classType.selected) {
                        const filteredClassType: ClassType = {
                            type: classType.type,
                            sessions: [],
                        };

                        classType.sessions.forEach((session) => {
                            if (session.selected) {
                                filteredClassType.sessions.push({
                                    dateRange: session.dateRange,
                                    dayOfWeek: session.dayOfWeek,
                                    timeRange: session.timeRange,
                                    location: session.location,
                                });
                            }
                        });

                        if (filteredClassType.sessions.length > 0) {
                            filteredCourse.classTypes.push(filteredClassType);
                        }
                    }
                });

                if (filteredCourse.classTypes.length > 0) {
                    filtered.courses.push(filteredCourse);
                }
            }
        });

        return filtered;
    }

    // Toggle selection for a course and all its children
    function toggleCourse(courseIndex: number) {
        if (!timetableData || !timetableData.courses) return;

        // Store a local reference to ensure TypeScript knows it's not null
        const data = timetableData;
        const newSelected = !data.courses[courseIndex].selected;
        data.courses[courseIndex].selected = newSelected;

        // Use the local reference in callbacks
        data.courses[courseIndex].classTypes.forEach((classType, ctIndex) => {
            data.courses[courseIndex].classTypes[ctIndex].selected =
                newSelected;

            classType.sessions.forEach((session, sIndex) => {
                data.courses[courseIndex].classTypes[ctIndex].sessions[
                    sIndex
                ].selected = newSelected;
            });
        });
    }

    // Toggle selection for a class type and all its sessions
    function toggleClassType(courseIndex: number, classTypeIndex: number) {
        if (!timetableData || !timetableData.courses) return;

        // Store a local reference
        const data = timetableData;
        const newSelected =
            !data.courses[courseIndex].classTypes[classTypeIndex].selected;
        data.courses[courseIndex].classTypes[classTypeIndex].selected =
            newSelected;

        // Update all sessions using local reference
        data.courses[courseIndex].classTypes[classTypeIndex].sessions.forEach(
            (session, sIndex) => {
                data.courses[courseIndex].classTypes[classTypeIndex].sessions[
                    sIndex
                ].selected = newSelected;
            },
        );

        // Check if all class types are selected
        let allSelected = true;
        data.courses[courseIndex].classTypes.forEach((ct) => {
            if (!ct.selected) allSelected = false;
        });

        data.courses[courseIndex].selected = allSelected;
    }

    // Toggle selection for a session
    function toggleSession(
        courseIndex: number,
        classTypeIndex: number,
        sessionIndex: number,
    ) {
        if (!timetableData || !timetableData.courses) return;

        // Store a local reference
        const data = timetableData;
        const newSelected =
            !data.courses[courseIndex].classTypes[classTypeIndex].sessions[
                sessionIndex
            ].selected;
        data.courses[courseIndex].classTypes[classTypeIndex].sessions[
            sessionIndex
        ].selected = newSelected;

        // Check if all sessions are selected
        let allSessionsSelected = true;
        data.courses[courseIndex].classTypes[classTypeIndex].sessions.forEach(
            (s) => {
                if (!s.selected) allSessionsSelected = false;
            },
        );

        data.courses[courseIndex].classTypes[classTypeIndex].selected =
            allSessionsSelected;

        // Check if all class types are selected
        let allClassTypesSelected = true;
        data.courses[courseIndex].classTypes.forEach((ct) => {
            if (!ct.selected) allClassTypesSelected = false;
        });

        data.courses[courseIndex].selected = allClassTypesSelected;
    }

    // Reset to start
    function resetApp() {
        currentStep = 1;
        timetableData = null;
        statusMessage = "";
        error = "";
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
    <header>
        <h1>Timetable to iCal</h1>
        {#if currentStep > 1 && timetableData && timetableData.courses && timetableData.courses.length > 0}
            <p class="course-count">
                {timetableData.courses.length} courses found
            </p>
        {/if}
    </header>

    {#if error}
        <div class="error">
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{error}</span>
        </div>
    {/if}

    {#if statusMessage}
        <div class="status">
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span>{statusMessage}</span>
        </div>
    {/if}

    <div class="stepper">
        <div class={`step ${currentStep >= 1 ? "active" : ""}`}>
            <div class="step-number">1</div>
            <div class="step-label">Extract</div>
        </div>
        <div class="step-line"></div>
        <div class={`step ${currentStep >= 2 ? "active" : ""}`}>
            <div class="step-number">2</div>
            <div class="step-label">Customize</div>
        </div>
        <div class="step-line"></div>
        <div class={`step ${currentStep >= 3 ? "active" : ""}`}>
            <div class="step-number">3</div>
            <div class="step-label">Download</div>
        </div>
    </div>

    {#if currentStep === 1}
        <div class="step-content">
            <div class="instructions">
                <h3>How to use:</h3>
                <ol>
                    <li>Login to MyAdelaide</li>
                    <li>Navigate to: STUDIES &rarr; Timetable</li>
                    <li>Click CLASSLIST at the top right corner</li>
                    <li>Click the Extract button below</li>
                </ol>

                {#if !isOnCorrectPage}
                    <div class="wrong-page-alert">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        {#if currentUrl.includes("myadelaide.uni.adelaide.edu.au") && currentUrl.includes("#/home/studies/timetable")}
                            <span
                                >Please click on the "CLASS LIST" button in the
                                top right corner of the timetable page to view
                                the list format.</span
                            >
                        {:else}
                            <span
                                >You are not on the timetable page. Please
                                navigate to MyAdelaide → STUDIES → Timetable →
                                CLASS LIST.</span
                            >
                        {/if}
                    </div>
                {/if}
            </div>

            <div class="actions">
                <button
                    class="primary-button"
                    onclick={() => extractTimetable()}
                    disabled={extracting || !isOnCorrectPage}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                        ></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    {extracting ? "Extracting..." : "Extract Timetable"}
                </button>
            </div>
        </div>
    {:else if currentStep === 2}
        <div class="step-content">
            <div class="options">
                <div class="timezone-selector">
                    <label for="timezone">Timezone:</label>
                    <select id="timezone" bind:value={selectedTimezone}>
                        {#each timezones as tz}
                            <option value={tz.value}>{tz.label}</option>
                        {/each}
                    </select>
                </div>

                <div class="toggle-section">
                    <button
                        onclick={() =>
                            (showAdvancedOptions = !showAdvancedOptions)}
                        class="toggle-btn"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            {#if showAdvancedOptions}
                                <path d="M19 9l-7 7-7-7"></path>
                            {:else}
                                <path d="M9 18l6-6-6-6"></path>
                            {/if}
                        </svg>
                        {showAdvancedOptions
                            ? "Hide Course Selection"
                            : "Show Course Selection"}
                    </button>
                </div>

                {#if showAdvancedOptions && timetableData?.courses}
                    <div class="course-selection">
                        {#each timetableData.courses as course, courseIndex}
                            <div class="course-item">
                                <label class="course-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={course.selected}
                                        onclick={() =>
                                            toggleCourse(courseIndex)}
                                    />
                                    <span class="course-name"
                                        >{course.name}</span
                                    >
                                </label>

                                <div class="class-types">
                                    {#each course.classTypes as classType, classTypeIndex}
                                        <div class="class-type-item">
                                            <label class="class-type-checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={classType.selected}
                                                    onclick={() =>
                                                        toggleClassType(
                                                            courseIndex,
                                                            classTypeIndex,
                                                        )}
                                                />
                                                <span class="class-type-name"
                                                    >{classType.type}</span
                                                >
                                            </label>

                                            <div class="sessions">
                                                {#each classType.sessions as session, sessionIndex}
                                                    <div class="session-item">
                                                        <label
                                                            class="session-checkbox"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={session.selected}
                                                                onclick={() =>
                                                                    toggleSession(
                                                                        courseIndex,
                                                                        classTypeIndex,
                                                                        sessionIndex,
                                                                    )}
                                                            />
                                                            <span
                                                                class="session-details"
                                                            >
                                                                {session.dayOfWeek}&nbsp;
                                                                {session.timeRange}
                                                                -
                                                                {session.location}
                                                            </span>
                                                        </label>
                                                    </div>
                                                {/each}
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            <div class="actions">
                <button class="secondary-button" onclick={() => resetApp()}>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M1 4v6h6"></path>
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                    </svg>
                    Start Over
                </button>
                <button
                    class="primary-button"
                    onclick={() => generateIcal()}
                    disabled={loading}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M8 17l4 4 4-4"></path>
                        <path d="M12 12v9"></path>
                        <path
                            d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"
                        ></path>
                    </svg>
                    {loading ? "Generating..." : "Generate iCal"}
                </button>
            </div>
        </div>
    {:else if currentStep === 3}
        <div class="step-content">
            <div class="completion">
                <div class="success-icon">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                </div>
                <h3>iCal File Generated!</h3>
                <p>
                    Your timetable has been successfully converted to iCal
                    format.
                </p>
                <p>The file should have been downloaded automatically.</p>
            </div>

            <div class="actions">
                <button class="secondary-button" onclick={() => resetApp()}>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M1 4v6h6"></path>
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                    </svg>
                    Start Over
                </button>
            </div>
        </div>
    {/if}
</div>

<style>
    .container {
        padding: 1.25rem;
        width: 400px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            Helvetica, Arial, sans-serif;
        color: #333;
    }

    header {
        text-align: center;
        margin-bottom: 1rem;
    }

    h1 {
        font-size: 1.5rem;
        margin: 0 0 0.25rem 0;
        color: #2563eb;
    }

    .course-count {
        font-size: 0.875rem;
        color: #6b7280;
        margin: 0;
    }

    h3 {
        font-size: 1.1rem;
        margin-top: 0;
        margin-bottom: 0.75rem;
        color: #374151;
    }

    .error {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: #fef2f2;
        color: #b91c1c;
        padding: 0.75rem;
        margin-bottom: 1rem;
        border-radius: 0.375rem;
        border-left: 4px solid #ef4444;
    }

    .status {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: #ecfdf5;
        color: #047857;
        padding: 0.75rem;
        margin-bottom: 1rem;
        border-radius: 0.375rem;
        border-left: 4px solid #10b981;
    }

    .wrong-page-alert {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
        background: #fff7ed;
        color: #c2410c;
        padding: 0.75rem;
        margin: 1rem 0;
        border-radius: 0.375rem;
        border-left: 4px solid #f97316;
        font-size: 0.875rem;
    }

    .wrong-page-alert svg {
        margin-top: 0.125rem;
        flex-shrink: 0;
    }

    .stepper {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
    }

    .step {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .step-number {
        width: 2rem;
        height: 2rem;
        background-color: #e5e7eb;
        color: #6b7280;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        margin-bottom: 0.25rem;
    }

    .step.active .step-number {
        background-color: #2563eb;
        color: white;
    }

    .step-label {
        font-size: 0.75rem;
        color: #6b7280;
    }

    .step.active .step-label {
        color: #2563eb;
        font-weight: 500;
    }

    .step-line {
        flex-grow: 1;
        height: 2px;
        background-color: #e5e7eb;
        margin: 0 0.5rem;
    }

    .step-content {
        padding: 1rem;
        background-color: #f9fafb;
        border-radius: 0.5rem;
        margin-bottom: 1rem;
    }

    .instructions ol {
        margin: 0;
        padding-left: 1.5rem;
    }

    .instructions li {
        margin-bottom: 0.5rem;
    }

    .actions {
        display: flex;
        gap: 0.75rem;
        margin-top: 1.25rem;
    }

    button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.625rem 1rem;
        border-radius: 0.375rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        font-size: 0.875rem;
    }

    .primary-button {
        background-color: #2563eb;
        color: white;
        border: none;
        flex: 1;
    }

    .primary-button:hover {
        background-color: #1d4ed8;
    }

    .primary-button:disabled {
        background-color: #93c5fd;
        cursor: not-allowed;
    }

    .secondary-button {
        background-color: #ffffff;
        color: #4b5563;
        border: 1px solid #d1d5db;
    }

    .secondary-button:hover {
        background-color: #f3f4f6;
    }

    .options {
        margin-top: 0.5rem;
    }

    .timezone-selector {
        display: flex;
        align-items: center;
        margin-bottom: 1rem;
    }

    .timezone-selector label {
        margin-right: 0.75rem;
        font-weight: 500;
        color: #374151;
        flex-shrink: 0;
    }

    select {
        padding: 0.5rem;
        border-radius: 0.375rem;
        border: 1px solid #d1d5db;
        flex-grow: 1;
        background-color: white;
        color: #374151;
    }

    select:focus {
        outline: none;
        border-color: #2563eb;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }

    .toggle-section {
        margin-bottom: 1rem;
    }

    .toggle-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        padding: 0.5rem 0.75rem;
        cursor: pointer;
        font-size: 0.875rem;
        width: 100%;
        color: #4b5563;
        font-weight: 500;
        transition: all 0.15s ease;
    }

    .toggle-btn:hover {
        background: #f3f4f6;
    }

    .course-selection {
        margin-top: 1rem;
        max-height: 300px;
        overflow-y: auto;
        background-color: white;
        border: 1px solid #e5e7eb;
        border-radius: 0.375rem;
        padding: 0.75rem;
    }

    .course-item {
        margin-bottom: 1rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid #f3f4f6;
    }

    .course-item:last-child {
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
    }

    .course-checkbox {
        font-weight: 600;
        display: flex;
        align-items: center;
        margin-bottom: 0.5rem;
        color: #1f2937;
    }

    .course-checkbox input {
        margin-right: 0.5rem;
    }

    .class-types {
        margin-left: 1.5rem;
    }

    .class-type-item {
        margin-bottom: 0.75rem;
    }

    .class-type-item:last-child {
        margin-bottom: 0;
    }

    .class-type-checkbox {
        font-weight: 500;
        display: flex;
        align-items: center;
        margin-bottom: 0.5rem;
        color: #374151;
    }

    .class-type-checkbox input {
        margin-right: 0.5rem;
    }

    .sessions {
        margin-left: 1.5rem;
    }

    .session-item {
        margin-bottom: 0.5rem;
    }

    .session-item:last-child {
        margin-bottom: 0;
    }

    .session-checkbox {
        font-size: 0.875rem;
        display: flex;
        align-items: flex-start;
        color: #4b5563;
    }

    .session-checkbox input {
        margin-top: 0.25rem;
        margin-right: 0.5rem;
    }

    .session-details {
        font-size: 0.8125rem;
        line-height: 1.4;
    }

    .completion {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 1rem 0;
    }

    .success-icon {
        color: #10b981;
        margin-bottom: 1rem;
    }

    .completion h3 {
        color: #10b981;
        margin-bottom: 0.75rem;
    }

    .completion p {
        margin: 0 0 0.5rem 0;
        color: #4b5563;
    }
</style>
