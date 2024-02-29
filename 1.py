from icalendar import Calendar, Event
from datetime import datetime, timedelta
import pytz

# Create a new calendar
cal = Calendar()

# Set the timezone to UTC for this example, but this can be adjusted to any timezone.
tz = pytz.timezone('UTC')


# Function to add events to the calendar
def add_event(summary, description, location, start_date, end_date, start_time, end_time, day_of_week=None):
    # Calculate the number of days to add to start_date for the first occurrence
    if day_of_week:
        start_date += timedelta(days=(day_of_week - start_date.weekday() + 7) % 7)
    current_date = start_date

    while current_date <= end_date:
        event = Event()
        event.add('summary', summary)
        event.add('dtstart', datetime.combine(current_date, start_time).astimezone(tz))
        event.add('dtend', datetime.combine(current_date, end_time).astimezone(tz))
        event.add('dtstamp', datetime.now().astimezone(tz))
        event.add('location', location)
        event.add('description', description)

        cal.add_component(event)

        if day_of_week is not None:
            current_date += timedelta(days=7)
        else:
            break


# Add events to the calendar
events_info = [
    {
        "summary": "MATHS 3025 - Professional Practice III Workshop",
        "description": "Weekly Workshop",
        "location": "Engineering & Mathematics EM212, Teaching Room",
        "start_date": datetime(2023, 3, 1),
        "end_date": datetime(2023, 4, 5),
        "start_time": datetime.strptime("14:00", "%H:%M").time(),
        "end_time": datetime.strptime("16:00", "%H:%M").time(),
        "day_of_week": 4  # Friday
    },
    # Add other events here if needed
    {
        "summary": "COMP SCI 3007 - Artificial Intelligence UG Lecture",
        "description": "Weekly Lecture",
        "location": "Helen Mayo Nth 103N, Florey Lecture Theatre",
        "start_date": datetime(2023, 4, 22),
        "end_date": datetime(2023, 5, 27),
        "start_time": datetime.strptime("15:00", "%H:%M").time(),
        "end_time": datetime.strptime("16:00", "%H:%M").time(),
        "day_of_week": 0  # Monday
    },
    # You can add more events here following the same structure.
]
for event_info in events_info:
    add_event(**event_info)

# Save the calendar to an .ics file
filename = "my_calendar.ics"
with open(filename, 'wb') as f:
    f.write(cal.to_ical())