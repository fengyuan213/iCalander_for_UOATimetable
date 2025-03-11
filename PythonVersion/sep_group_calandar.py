from timetable import parse_raw_to_file

raw_input = """
SEP Sprint Review & Planning Meeting
19 Aug Monday 5:10 PM - 5:35 PM
Engineering Nth N218, Teaching Room
2 Sep Thursday 4:00 PM - 5:00 PM
Engineering Nth N218, Teaching Room
30 Sep Thursday 4:00 PM - 5:00 PM
Engineering Nth N218, Teaching Room
14 Oct Thursday 4:00 PM - 5:00 PM
Engineering Nth N218, Teaching Room


COMP SCI 3315 - Computer Vision UG Workshop
15 Mar Friday 4:00 PM - 5:00 PM
Hughes 323, Teaching Room
05 Apr Friday 4:00 PM - 5:00 PM
Hughes 323, Teaching Room
10 May Friday 4:00 PM - 5:00 PM
Hughes 323, Teaching Room
31 May Friday 4:00 PM - 5:00 PM
Hughes 323, Teaching Room
"""

parse_raw_to_file(raw_input, "sep_group_calendar.ics")
