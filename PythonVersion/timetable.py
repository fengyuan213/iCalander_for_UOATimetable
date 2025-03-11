
import re
import pytz
from zoneinfo import ZoneInfo
from icalendar import Calendar, Event
from datetime import datetime, timedelta


# Define function to parse the raw string and generate .ics file
def pop_first(s):
    lines = s.split('\n')  # Split the string into lines
    first_line = lines.pop(0)  # Remove and get the first line
    remaining_text = '\n'.join(lines)  # Join the remaining lines back into a string
    return first_line, remaining_text


def parse_and_generate_ics(raw_input):

    # remove trilling and front space
    raw_input = '\n'.join([line.strip() for line in raw_input.split('\n')])
    tz = pytz.timezone('UTC')

    # Split the input into blocks for each course
    blocks = raw_input.strip().split("\n\n")

    # Initialize calendar
    calendar = Calendar()

    # Helper function to add events to the calendar
    def add_event_to_calendar(name, start_date, end_date, day_of_week, start_time, end_time, location):
        # Convert day names to weekday numbers, with Monday as 0
        days = {
            'Monday': 0,
            'Tuesday': 1,
            'Wednesday': 2,
            'Thursday': 3,
            'Friday': 4,
            'Saturday': 5,
            'Sunday': 6
        }

        start_date = f"{start_date} {datetime.today().year}"
        end_date = f"{end_date} {datetime.today().year}"

        # start_date_dt = datetime.strptime(start_date, '%d %b %Y').replace(tzinfo=adelaide_tz)
        # end_date_dt = datetime.strptime(end_date, '%d %b %Y').replace(tzinfo=adelaide_tz)
        start_date_dt = datetime.strptime(start_date, '%d %b %Y')
        end_date_dt = datetime.strptime(end_date, '%d %b %Y')
        if end_date_dt < start_date_dt:
            end_date_dt = end_date_dt.replace(year=end_date_dt.year + 1)
        current_date = start_date_dt

        while current_date <= end_date_dt:
            if current_date.weekday() == days[day_of_week]:
                event = Event()

                event.add('summary', name)
                event.add('dtstart',
                          datetime.combine(current_date, datetime.strptime(start_time, '%I:%M %p').time()).astimezone(
                              tz))
                event.add('dtend',
                          datetime.combine(current_date, datetime.strptime(end_time, '%I:%M %p').time()).astimezone(tz))
                event.add('dtstamp', datetime.now().astimezone(tz))
                event.add('location', location)
                event.add('description', "")

                # event.name = name
                # event.begin = datetime.combine(current_date, datetime.strptime(start_time, '%I:%M %p').time())
                # event.end = datetime.combine(current_date, datetime.strptime(end_time, '%I:%M %p').time())
                # event.location = location
                calendar.add_component(event)
                # calendar.events.add(event)
            current_date += timedelta(days=1)

    # Regex pattern to extract information
    pattern = re.compile(
        r"(.*?)\n(\d{2} \w{3}) - (\d{2} \w{3}) (\w+day) (\d{1,2}:\d{2} (?:AM|PM)) - (\d{1,2}:\d{2} (?:AM|PM))\n(.*?)$",
        re.MULTILINE)
    pattern = re.compile(
        r"(?:(.*?)\n)?(\d{2} \w{3}) - (\d{2} \w{3}) (\w+day) (\d{1,2}:\d{2} (?:AM|PM)) - (\d{1,2}:\d{2} (?:AM|PM))\n(.*?)(?=\n|$)",
        re.MULTILINE)

    pattern = re.compile(
        r"(?:(.*?)\n)?(\d{2} \w{3})(?: - (\d{2} \w{3}))? (\w+day) (\d{1,2}:\d{2} (?:AM|PM)) - (\d{1,2}:\d{2} (?:AM|PM))\n(.*?)(?=\n|$)",
        re.MULTILINE)
    #pattern = re.compile( r"(?:(.*?)\n)?(\d{2} \w{3})(?: - (\d{2} \w{3}))? (\w+day) (\d{1,2}:\d{2} (?:AM|PM)) - (\d{1,2}:\d{2} (?:AM|PM))\n(.*?)(?=\n|$|\n\d{2} \w{3})",re.MULTILINE)
    for block in blocks:
        #block = "w"

        name, remaining = pop_first(block)
        #while remaining != "":
        #    timeText, remaining = pop_first(remaining)
        #    locationText, remaining = pop_first(remaining)
        ##   for match in pattern.finditer(timeText):
        #        name1, start_date, end_date, day_of_week, start_time, end_time, location = match.groups()
        #        add_event_to_calendar(name, start_date, end_date, day_of_week, start_time, end_time, location)
        for match in pattern.finditer(remaining):
            name1, start_date, end_date, day_of_week, start_time, end_time, location = match.groups()
            if end_date is None:
                end_date = start_date
            add_event_to_calendar(name, start_date, end_date, day_of_week, start_time, end_time, location)

    # Return the generated calendar
    return calendar.to_ical()


def parse_raw_to_file(raw_input,filename):
    calendar = parse_and_generate_ics(raw_input)

    with open(filename, 'wb') as f:
        f.write(calendar)
