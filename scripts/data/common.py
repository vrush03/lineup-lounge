"""Helpers for the Ballpark question generator (gen_ballpark.py)."""
import urllib.parse

CRICSHEET = {'name': 'Cricsheet ball-by-ball data', 'url': 'https://cricsheet.org/', 'license': 'ODC-By 1.0'}
# For "how long to watch every ball" questions.
SECONDS_PER_BALL = 40


def wiki(title):
    """A source for a Wikipedia page, by its title ('List_of_Test_cricket_records')."""
    return {'name': f"Wikipedia: {title.replace('_', ' ')}",
            'url': 'https://en.wikipedia.org/wiki/' + urllib.parse.quote(title),
            'license': 'CC BY-SA 4.0'}


def topics(q):
    """A question's topics: one name, or a list when it mentions more than one subject."""
    return q['topic'] if isinstance(q['topic'], list) else [q['topic']]
